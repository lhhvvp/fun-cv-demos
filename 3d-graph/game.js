import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { HandLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';
import ForceGraph3D from 'https://esm.sh/3d-force-graph';
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from 'postprocessing';
import { AudioManager } from './audioManager.js';
import { SpeechManager } from './SpeechManager.js';

export class Game {
    constructor(renderDiv) {
        this.renderDiv = renderDiv;
        this.gameState = 'loading';
        this.clock = new THREE.Clock();
        
        // Get DOM elements
        this.videoElement = document.getElementById('videoElement');
        this.statusContainer = document.getElementById('statusContainer');
        this.statusText = document.getElementById('statusText');
        this.restartHint = document.getElementById('restartHint');
        this.speechBubble = document.getElementById('speechBubble');
        this.forceGraphContainer = document.getElementById('forceGraphContainer');
        this.interactionModeMenu = document.getElementById('interactionModeMenu');
        this.instructionsBox = document.getElementById('instructionsBox');
        this.instructionsText = document.getElementById('instructionsText');
        
        // Hand tracking properties
        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.hands = [];
        this.lastLandmarkPositions = [[], []];
        this.smoothingFactor = 0.4;
        
        // Three.js properties
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Materials
        this.handLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 8 });
        this.fingertipMaterialHand1 = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        this.fingertipMaterialHand2 = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        
        // Constants
        this.LANDMARK_INDICES = {
            WRIST: 0,
            THUMB_TIP: 4,
            INDEX_FINGER_TIP: 8,
            MIDDLE_FINGER_MCP: 9,
            FINGERTIP_LANDMARKS: [0, 4, 8, 12, 16, 20],
            FINGERTIP_INDICES_FOR_FIST: [8, 12, 16, 20]
        };
        
        this.THRESHOLDS = {
            PINCH_SCREEN: 50,
            NODE_PICK_SCREEN: 80,
            HOVER_SCREEN: 40,
            FIST_CURL_RATIO: 0.75,
            MIN_FINGERS_CURLED_FOR_FIST: 3
        };
        
        this.INTERACTION = {
            ROTATION_SENSITIVITY_X: 0.006,
            ROTATION_SENSITIVITY_Y: 0.004,
            ZOOM_SENSITIVITY: 2.0,
            MIN_CAMERA_DISTANCE_GRAPH: 100,
            MAX_CAMERA_DISTANCE_GRAPH: 1100
        };
        
        // Hand connections for MediaPipe landmarks
        this.handConnections = [
            [0,1],[1,2],[2,3],[3,4], // Thumb
            [0,5],[5,6],[6,7],[7,8], // Index
            [0,9],[9,10],[10,11],[11,12], // Middle
            [0,13],[13,14],[14,15],[15,16], // Ring
            [0,17],[17,18],[18,19],[19,20], // Pinky
            [5,9],[9,13],[13,17] // Palm connections
        ];
        
        // Managers
        this.audioManager = new AudioManager();
        this.speechManager = null;
        
        // Graph properties
        this.forceGraph = null;
        this.graphComposer = null;
        this.bloomEffect = null;
        this.css2DRenderer = null;
        
        // Interaction state
        this.interactionMode = 'drag';
        this.draggedNodeInfo = {
            handIndex: -1,
            node: null,
            screenOffset: new THREE.Vector2(),
            initialNodeWorldPos: new THREE.Vector3()
        };
        this.currentlyHoveredNode = null;
        this.initialZoomWristDistance = null;
        this.initialZoomCameraDistance = null;
        this.isAutoRotating = false;
        this.autoRotateSpeed = 0.8;
        
        // Speech bubble state
        this.speechBubbleTimeout = null;
        this.isSpeechActive = false;
        
        // Instruction text for different modes
        this.instructionTexts = {
            drag: "Pinch thumb and index finger together to grab and drag nodes",
            rotate: "Make a fist and move your hand to rotate the graph",
            zoom: "Use both hands; - move wrists closer/apart to change zoom"
        };
        
        this._init().catch(error => {
            console.error("Initialization failed:", error);
            this._showError("Initialization failed. Check console.");
        });
    }

    async _init() {
        this._setupEventListeners();
        this._setupThree();
        this._setupForceGraph();
        this._setupSpeechRecognition();
        
        await this._loadAssets();
        await this._setupHandTracking();
        await this.videoElement.play();
        
        window.addEventListener('resize', this._onResize.bind(this));
        
        this.gameState = 'tracking';
        this._startGame();
        this._animate();
    }

    _setupEventListeners() {
        // Mode menu click handlers
        this.interactionModeMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('mode-option')) {
                const mode = e.target.dataset.mode;
                this._handleInteractionModeChange(mode);
            }
        });

        // Main click handler for audio resume and restart
        this.renderDiv.addEventListener('click', () => {
            this.audioManager.resumeContext();
            if (this.gameState === 'error' || this.gameState === 'paused') {
                this._restartGame();
            }
        });
    }

    _setupThree() {
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(
            width / -2, width / 2, height / 2, height / -2, 1, 1000
        );
        this.camera.position.z = 100;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.zIndex = '1';
        
        this.renderDiv.appendChild(this.renderer.domElement);

        // Setup lighting
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(0, 0, 100);
        this.scene.add(directionalLight);

        // Setup hand visualization
        for (let i = 0; i < 2; i++) {
            const lineGroup = new THREE.Group();
            lineGroup.visible = false;
            this.scene.add(lineGroup);
            
            this.hands.push({
                landmarks: null,
                anchorPos: new THREE.Vector3(),
                lineGroup,
                isPinching: false,
                pinchScreenPos: new THREE.Vector2(),
                isFistClosed: false,
                lastFistScreenPos: new THREE.Vector2()
            });
        }
    }

    async _loadAssets() {
        console.log("Loading assets...");
        try {
            console.log("No game-specific assets to load for template.");
        } catch (error) {
            console.error("Error loading assets:", error);
            this._showError("Failed to load assets.");
            throw error;
        }
    }

    async _setupHandTracking() {
        try {
            console.log("Setting up Hand Tracking...");
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
            );
            
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: 'GPU'
                },
                numHands: 2,
                runningMode: 'VIDEO'
            });

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            
            this.videoElement.srcObject = stream;

            return new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => {
                    console.log("Webcam metadata loaded.");
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error setting up Hand Tracking or Webcam:', error);
            this._showError(`Webcam/Hand Tracking Error: ${error.message}. Please allow camera access.`);
            throw error;
        }
    }

    _updateHands() {
        if (!this._isHandTrackingReady()) return;

        const videoTime = this.videoElement.currentTime;
        if (videoTime <= this.lastVideoTime) return;
        
        this.lastVideoTime = videoTime;

        try {
            const results = this.handLandmarker.detectForVideo(this.videoElement, performance.now());
            const videoParams = this._getVisibleVideoParameters();
            if (!videoParams) return;

            const { clientWidth: canvasWidth, clientHeight: canvasHeight } = this.renderDiv;

            this._processHandResults(results, videoParams, canvasWidth, canvasHeight);
            this._updateNodeHover(videoParams, canvasWidth, canvasHeight);
            this._handleGlobalInteractionLogic(results, videoParams, canvasWidth, canvasHeight);
            
        } catch (error) {
            console.error("Error during hand detection or processing:", error);
        }
    }

    _isHandTrackingReady() {
        return this.handLandmarker && 
               this.videoElement.srcObject && 
               this.videoElement.readyState >= 2 && 
               this.videoElement.videoWidth > 0;
    }

    _processHandResults(results, videoParams, canvasWidth, canvasHeight) {
        this.hands.forEach((hand, i) => {
            if (results.landmarks?.[i]) {
                this._updateHandLandmarks(hand, i, results.landmarks[i], videoParams, canvasWidth, canvasHeight);
                this._updateHandInteraction(hand, i, videoParams, canvasWidth, canvasHeight);
                this._updateHandLines(i, hand.landmarks, videoParams, canvasWidth, canvasHeight);
                hand.lineGroup.visible = true;
            } else {
                this._resetHandState(hand, i);
            }
        });
    }

    _updateHandLandmarks(hand, handIndex, rawLandmarks, videoParams, canvasWidth, canvasHeight) {
        // Initialize or update smoothed landmarks
        if (!this.lastLandmarkPositions[handIndex] || 
            this.lastLandmarkPositions[handIndex].length !== rawLandmarks.length) {
            this.lastLandmarkPositions[handIndex] = rawLandmarks.map(lm => ({...lm}));
        }

        // Apply smoothing
        hand.landmarks = rawLandmarks.map((lm, idx) => {
            const prevLm = this.lastLandmarkPositions[handIndex][idx];
            const smoothed = {
                x: this.smoothingFactor * lm.x + (1 - this.smoothingFactor) * prevLm.x,
                y: this.smoothingFactor * lm.y + (1 - this.smoothingFactor) * prevLm.y,
                z: this.smoothingFactor * lm.z + (1 - this.smoothingFactor) * prevLm.z
            };
            this.lastLandmarkPositions[handIndex][idx] = {...smoothed};
            return smoothed;
        });

        // Update anchor position
        const palm = hand.landmarks[this.LANDMARK_INDICES.MIDDLE_FINGER_MCP];
        const palmScreenPos = this._projectLandmarkToScreen(palm, videoParams, canvasWidth, canvasHeight);
        if (palmScreenPos) {
            hand.anchorPos.set(palmScreenPos.x, palmScreenPos.y, 1);
        }
    }

    _updateHandInteraction(hand, handIndex, videoParams, canvasWidth, canvasHeight) {
        switch (this.interactionMode) {
            case 'drag':
                this._updateDragMode(hand, handIndex, videoParams, canvasWidth, canvasHeight);
                hand.isFistClosed = false;
                break;
            case 'rotate':
                this._updateRotateMode(hand, handIndex, videoParams, canvasWidth, canvasHeight);
                if (hand.isPinching) this._handlePinchEnd(handIndex);
                hand.isPinching = false;
                break;
            case 'zoom':
                // Zoom is handled globally
                break;
        }
    }

    _updateDragMode(hand, handIndex, videoParams, canvasWidth, canvasHeight) {
        if (hand.landmarks.length <= Math.max(this.LANDMARK_INDICES.THUMB_TIP, this.LANDMARK_INDICES.INDEX_FINGER_TIP)) {
            if (hand.isPinching) this._handlePinchEnd(handIndex);
            hand.isPinching = false;
            return;
        }

        const thumbTip = hand.landmarks[this.LANDMARK_INDICES.THUMB_TIP];
        const indexTip = hand.landmarks[this.LANDMARK_INDICES.INDEX_FINGER_TIP];
        const thumbTipScreen = this._projectLandmarkToScreen(thumbTip, videoParams, canvasWidth, canvasHeight);
        const indexTipScreen = this._projectLandmarkToScreen(indexTip, videoParams, canvasWidth, canvasHeight);

        if (!thumbTipScreen || !indexTipScreen) {
            if (hand.isPinching) this._handlePinchEnd(handIndex);
            hand.isPinching = false;
            return;
        }

        const distance = thumbTipScreen.distanceTo(indexTipScreen);
        const prevPinchState = hand.isPinching;
        hand.isPinching = distance < this.THRESHOLDS.PINCH_SCREEN;

        if (hand.isPinching) {
            hand.pinchScreenPos.lerpVectors(thumbTipScreen, indexTipScreen, 0.5);
        }

        // Handle pinch state changes
        if (hand.isPinching && !prevPinchState) {
            this._handlePinchStart(handIndex, hand.pinchScreenPos);
        } else if (!hand.isPinching && prevPinchState) {
            this._handlePinchEnd(handIndex);
        } else if (hand.isPinching && prevPinchState && 
                   this.draggedNodeInfo.handIndex === handIndex && this.draggedNodeInfo.node) {
            this._handlePinchMove(handIndex, hand.pinchScreenPos);
        }
    }

    _updateRotateMode(hand, handIndex, videoParams, canvasWidth, canvasHeight) {
        const prevFistState = hand.isFistClosed;
        hand.isFistClosed = this._isFist(hand.landmarks);

        const fistReferenceLandmark = hand.landmarks[this.LANDMARK_INDICES.WRIST] || 
                                     hand.landmarks[this.LANDMARK_INDICES.MIDDLE_FINGER_MCP];
        const fistScreenPos = fistReferenceLandmark ? 
            this._projectLandmarkToScreen(fistReferenceLandmark, videoParams, canvasWidth, canvasHeight) : null;

        if (!fistScreenPos) {
            hand.isFistClosed = false;
            return;
        }

        if (hand.isFistClosed && !prevFistState) {
            hand.lastFistScreenPos.copy(fistScreenPos);
            if (this.isAutoRotating) {
                this._toggleAutoRotation(false);
            }
        } else if (hand.isFistClosed && prevFistState) {
            this._handleFistRotation(fistScreenPos, hand.lastFistScreenPos);
            hand.lastFistScreenPos.copy(fistScreenPos);
        }
    }

    _handleFistRotation(currentPos, lastPos) {
        const deltaX = currentPos.x - lastPos.x;
        const deltaY = currentPos.y - lastPos.y;

        if (!this.forceGraph?.controls()?.target || !this.forceGraph?.camera()) return;

        const controls = this.forceGraph.controls();
        const camera = this.forceGraph.camera();
        const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
        const radius = offset.length();
        
        let phi = Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1));
        let theta = Math.atan2(offset.x, offset.z);
        
        theta += deltaX * this.INTERACTION.ROTATION_SENSITIVITY_X;
        phi -= deltaY * this.INTERACTION.ROTATION_SENSITIVITY_Y;
        
        offset.set(
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.cos(theta)
        );
        
        camera.position.copy(controls.target).add(offset);
        camera.lookAt(controls.target);
        controls.update();
    }

    _resetHandState(hand, handIndex) {
        hand.landmarks = null;
        if (hand.lineGroup) hand.lineGroup.visible = false;
        if (hand.isPinching) this._handlePinchEnd(handIndex);
        hand.isPinching = false;
        hand.isFistClosed = false;
    }

    _updateNodeHover(videoParams, canvasWidth, canvasHeight) {
        if (this.interactionMode !== 'drag' || !this.forceGraph) {
            if (this.currentlyHoveredNode) {
                this._setNodeHoverStyle(this.currentlyHoveredNode, false);
                this.currentlyHoveredNode = null;
            }
            return;
        }

        let newHoveredNode = null;
        let minDistanceSq = this.THRESHOLDS.HOVER_SCREEN ** 2;
        const tempNodeScreenPos = new THREE.Vector2();

        this.hands.forEach((hand, handIdx) => {
            if (!hand.landmarks || this.draggedNodeInfo.handIndex === handIdx) return;

            const indexTip = hand.landmarks[this.LANDMARK_INDICES.INDEX_FINGER_TIP];
            if (!indexTip) return;

            const indexTipScreen = this._projectLandmarkToScreen(indexTip, videoParams, canvasWidth, canvasHeight);
            if (!indexTipScreen) return;

            this.forceGraph.graphData().nodes.forEach(node => {
                if (typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') return;

                const nodeScreenPos = this._worldToScreen(node, tempNodeScreenPos);
                if (!nodeScreenPos) return;

                const distanceSq = indexTipScreen.distanceToSquared(nodeScreenPos);
                if (distanceSq < minDistanceSq) {
                    minDistanceSq = distanceSq;
                    newHoveredNode = node;
                }
            });
        });

        if (this.currentlyHoveredNode !== newHoveredNode) {
            if (this.currentlyHoveredNode) {
                this._setNodeHoverStyle(this.currentlyHoveredNode, false);
            }
            if (newHoveredNode) {
                this._setNodeHoverStyle(newHoveredNode, true);
            }
            this.currentlyHoveredNode = newHoveredNode;
        }
    }

    _handleGlobalInteractionLogic(results, videoParams, canvasWidth, canvasHeight) {
        if (this.interactionMode === 'zoom') {
            this._handleZoomMode(results);
            this.hands.forEach((hand, index) => {
                if (hand.isPinching) this._handlePinchEnd(index);
                hand.isPinching = false;
                hand.isFistClosed = false;
            });
        }
    }

    _handleZoomMode(results) {
        if (!results?.landmarks?.[0] || !results?.landmarks?.[1] || 
            !this.hands[0].landmarks || !this.hands[1].landmarks ||
            !this.forceGraph?.controls() || !this.forceGraph?.camera()) {
            this.initialZoomWristDistance = null;
            this.initialZoomCameraDistance = null;
            return;
        }

        const wrist0 = this.hands[0].landmarks[this.LANDMARK_INDICES.WRIST];
        const wrist1 = this.hands[1].landmarks[this.LANDMARK_INDICES.WRIST];
        if (!wrist0 || !wrist1) return;

        const currentWristDist = Math.sqrt(
            (wrist0.x - wrist1.x) ** 2 + 
            (wrist0.y - wrist1.y) ** 2 + 
            (wrist0.z - wrist1.z) ** 2
        );

        const controls = this.forceGraph.controls();
        const camera = this.forceGraph.camera();
        const currentCamDist = camera.position.distanceTo(controls.target);

        if (!this.initialZoomWristDistance || !this.initialZoomCameraDistance) {
            this.initialZoomWristDistance = currentWristDist;
            this.initialZoomCameraDistance = currentCamDist;
            return;
        }

        if (this.initialZoomWristDistance < 0.001) {
            this.initialZoomWristDistance = Math.max(currentWristDist, 0.01);
            this.initialZoomCameraDistance = currentCamDist;
            return;
        }

        let scaleFactor = currentWristDist / this.initialZoomWristDistance;
        scaleFactor = scaleFactor ** this.INTERACTION.ZOOM_SENSITIVITY;
        
        const newCamDist = THREE.MathUtils.clamp(
            this.initialZoomCameraDistance * scaleFactor,
            this.INTERACTION.MIN_CAMERA_DISTANCE_GRAPH,
            this.INTERACTION.MAX_CAMERA_DISTANCE_GRAPH
        );

        if (Math.abs(newCamDist - currentCamDist) > 0.5) {
            const viewDirection = new THREE.Vector3()
                .subVectors(camera.position, controls.target)
                .normalize();
            camera.position.copy(controls.target).addScaledVector(viewDirection, newCamDist);
            controls.update();
        }
    }

    _getVisibleVideoParameters() {
        if (!this.videoElement || this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
            return null;
        }

        const vNatW = this.videoElement.videoWidth;
        const vNatH = this.videoElement.videoHeight;
        const rW = this.renderDiv.clientWidth;
        const rH = this.renderDiv.clientHeight;

        if (vNatW === 0 || vNatH === 0 || rW === 0 || rH === 0) return null;

        const videoAR = vNatW / vNatH;
        const renderDivAR = rW / rH;

        let offsetX, offsetY, visibleWidth, visibleHeight;

        if (videoAR > renderDivAR) {
            // Video wider than container - crop horizontally
            const scale = rH / vNatH;
            const scaledVideoWidth = vNatW * scale;
            const totalCroppedPixelsX = (scaledVideoWidth - rW) / scale;
            
            offsetX = totalCroppedPixelsX / 2;
            offsetY = 0;
            visibleWidth = vNatW - totalCroppedPixelsX;
            visibleHeight = vNatH;
        } else {
            // Video taller than container - crop vertically
            const scale = rW / vNatW;
            const scaledVideoHeight = vNatH * scale;
            const totalCroppedPixelsY = (scaledVideoHeight - rH) / scale;
            
            offsetX = 0;
            offsetY = totalCroppedPixelsY / 2;
            visibleWidth = vNatW;
            visibleHeight = vNatH - totalCroppedPixelsY;
        }

        if (visibleWidth <= 0 || visibleHeight <= 0) {
            console.warn("Calculated visible video dimension is zero or negative.");
            return { offsetX: 0, offsetY: 0, visibleWidth: vNatW, visibleHeight: vNatH, videoNaturalWidth: vNatW, videoNaturalHeight: vNatH };
        }

        return { offsetX, offsetY, visibleWidth, visibleHeight, videoNaturalWidth: vNatW, videoNaturalHeight: vNatH };
    }

    _showStatusScreen(message, color = 'white', showRestartHint = false) {
        this.statusContainer.style.display = 'block';
        this.statusText.innerText = message;
        this.statusText.style.color = color;
        this.restartHint.style.display = showRestartHint ? 'block' : 'none';
    }

    _showError(message) {
        this.statusContainer.style.display = 'block';
        this.statusText.innerText = `ERROR: ${message}`;
        this.statusText.style.color = 'white';
        this.restartHint.style.display = 'block';
        this.gameState = 'error';
        
        this.hands.forEach(hand => {
            if (hand.lineGroup) hand.lineGroup.visible = false;
        });
    }

    _startGame() {
        console.log("Starting tracking automatically...");
        this.audioManager.resumeContext();
        this.speechManager.requestPermissionAndStart();
        this.gameState = 'tracking';
        this.lastVideoTime = -1;
        this.clock.start();
    }

    _restartGame() {
        console.log("Restarting tracking...");
        this.statusContainer.style.display = 'none';
        this.hands.forEach(hand => {
            if (hand.lineGroup) hand.lineGroup.visible = false;
        });
        this.gameState = 'tracking';
        this.lastVideoTime = -1;
        this.clock.start();
    }

    _onResize() {
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        
        // Update camera
        Object.assign(this.camera, {
            left: width / -2,
            right: width / 2,
            top: height / 2,
            bottom: height / -2
        });
        this.camera.updateProjectionMatrix();

        // Update renderers
        this.renderer.setSize(width, height);
        this.css2DRenderer?.setSize(width, height);
    }

    _updateHandLines(handIndex, landmarks, videoParams, canvasWidth, canvasHeight) {
        const hand = this.hands[handIndex];
        const lineGroup = hand.lineGroup;

        // Clear existing geometry
        while (lineGroup.children.length) {
            const child = lineGroup.children[0];
            lineGroup.remove(child);
            child.geometry?.dispose();
        }

        if (!landmarks?.length || !videoParams) {
            lineGroup.visible = false;
            return;
        }

        // Convert landmarks to 3D points
        const points3D = landmarks.map(lm => {
            const lmOriginalX = lm.x * videoParams.videoNaturalWidth;
            const lmOriginalY = lm.y * videoParams.videoNaturalHeight;
            
            const normX = Math.max(0, Math.min(1, (lmOriginalX - videoParams.offsetX) / videoParams.visibleWidth));
            const normY = Math.max(0, Math.min(1, (lmOriginalY - videoParams.offsetY) / videoParams.visibleHeight));
            
            const x = (1 - normX) * canvasWidth - canvasWidth / 2;
            const y = (1 - normY) * canvasHeight - canvasHeight / 2;
            
            return new THREE.Vector3(x, y, 1.1);
        });

        // Draw connection lines
        this.handConnections.forEach(([idx1, idx2]) => {
            const p1 = points3D[idx1];
            const p2 = points3D[idx2];
            if (p1 && p2) {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    p1.clone().setZ(1),
                    p2.clone().setZ(1)
                ]);
                const line = new THREE.Line(geometry, this.handLineMaterial);
                lineGroup.add(line);
            }
        });

        // Draw fingertip circles
        this.LANDMARK_INDICES.FINGERTIP_LANDMARKS.forEach(index => {
            const position = points3D[index];
            if (position) {
                const radius = index === 0 ? 12 : 8; // Larger for wrist
                const geometry = new THREE.CircleGeometry(radius, 16);
                const circle = new THREE.Mesh(geometry, this.fingertipMaterialHand1);
                circle.position.copy(position);
                lineGroup.add(circle);
            }
        });

        lineGroup.visible = true;
    }

    _projectLandmarkToScreen(landmark, videoParams, canvasWidth, canvasHeight) {
        if (!landmark || !videoParams?.videoNaturalWidth || !videoParams.visibleWidth) return null;

        const lmOriginalX = landmark.x * videoParams.videoNaturalWidth;
        const lmOriginalY = landmark.y * videoParams.videoNaturalHeight;
        
        const normX = Math.max(0, Math.min(1, (lmOriginalX - videoParams.offsetX) / videoParams.visibleWidth));
        const normY = Math.max(0, Math.min(1, (lmOriginalY - videoParams.offsetY) / videoParams.visibleHeight));
        
        const screenX = (1 - normX) * canvasWidth - canvasWidth / 2;
        const screenY = (1 - normY) * canvasHeight - canvasHeight / 2;
        
        return new THREE.Vector2(screenX, screenY);
    }

    _worldToScreen(worldPos, targetVector = new THREE.Vector2()) {
        if (!this.forceGraph?.camera()) return null;

        const vector = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
        vector.project(this.forceGraph.camera());
        
        const screenX = vector.x * this.renderDiv.clientWidth / 2;
        const screenY = vector.y * this.renderDiv.clientHeight / 2;
        
        return targetVector.set(screenX, screenY);
    }

    _updateInteractionModeUI() {
        document.querySelectorAll('.mode-option').forEach(option => {
            const mode = option.dataset.mode;
            option.classList.toggle('active', mode === this.interactionMode);
        });
        
        // Update instruction text
        this._updateInstructionText();
    }
    
    _updateInstructionText() {
        if (this.instructionsText && this.instructionTexts[this.interactionMode]) {
            this.instructionsText.textContent = this.instructionTexts[this.interactionMode];
        }
    }

    _handleInteractionModeChange(newMode) {
        if (!['drag', 'rotate', 'zoom'].includes(newMode) || this.interactionMode === newMode) return;

        console.log(`Interaction mode changed to: ${newMode}`);
        this.interactionMode = newMode;
        this._updateInteractionModeUI();

        // Clean up previous mode state
        if (newMode !== 'drag' && this.draggedNodeInfo.node) {
            this._handlePinchEnd(this.draggedNodeInfo.handIndex);
        }

        if (this.isAutoRotating) {
            this._toggleAutoRotation(false);
        }

        // Reset gesture states
        this.hands.forEach((hand, index) => {
            if (newMode !== 'rotate') hand.isFistClosed = false;
            if (newMode !== 'drag') {
                if (hand.isPinching) this._handlePinchEnd(index);
                hand.isPinching = false;
            }
            if (newMode !== 'zoom') {
                this.initialZoomWristDistance = null;
                this.initialZoomCameraDistance = null;
            }
        });
    }

    _handlePinchStart(handIndex, pinchScreenPos) {
        if (this.interactionMode !== 'drag' || !this.forceGraph || this.draggedNodeInfo.node) return;

        const graphData = this.forceGraph.graphData();
        let closestNode = null;
        let minDistanceSq = Infinity;
        const tempNodeScreenPos = new THREE.Vector2();

        graphData.nodes.forEach(node => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') return;

            const nodeScreenPos = this._worldToScreen(node, tempNodeScreenPos);
            if (!nodeScreenPos) return;

            const distanceSq = pinchScreenPos.distanceToSquared(nodeScreenPos);
            if (distanceSq < minDistanceSq && distanceSq < this.THRESHOLDS.NODE_PICK_SCREEN ** 2) {
                minDistanceSq = distanceSq;
                closestNode = node;
            }
        });

        if (closestNode) {
            this.draggedNodeInfo.handIndex = handIndex;
            this.draggedNodeInfo.node = closestNode;
            
            const nodeScreenPos = this._worldToScreen(closestNode, new THREE.Vector2());
            this.draggedNodeInfo.screenOffset = nodeScreenPos ? 
                nodeScreenPos.clone().sub(pinchScreenPos) : 
                new THREE.Vector2();
            
            this.draggedNodeInfo.initialNodeWorldPos.set(closestNode.x, closestNode.y, closestNode.z);
            
            console.log(`Hand ${handIndex} picked up node: ${closestNode.id}`);
            
            // Fix node position
            Object.assign(closestNode, { fx: closestNode.x, fy: closestNode.y, fz: closestNode.z });
            this.forceGraph.graphData().nodes = [...graphData.nodes];
        }
    }

    _handlePinchEnd(handIndex) {
        if (this.interactionMode === 'drag' && 
            this.draggedNodeInfo.handIndex === handIndex && 
            this.draggedNodeInfo.node) {
            
            console.log(`Hand ${handIndex} released node: ${this.draggedNodeInfo.node.id}`);
            
            // Unfix the node
            const { node } = this.draggedNodeInfo;
            delete node.fx;
            delete node.fy;
            delete node.fz;
            
            this.forceGraph.graphData().nodes = [...this.forceGraph.graphData().nodes];
            
            // Reheat simulation
            this.forceGraph.d3ReheatSimulation?.() || this.forceGraph.resumeAnimation?.();
            
            Object.assign(this.draggedNodeInfo, {
                handIndex: -1,
                node: null
            });
        }
    }

    _screenToWorld(screenPos, targetZ, targetVector = new THREE.Vector3()) {
        if (!this.forceGraph?.camera() || !this.renderDiv) return null;

        const graphCamera = this.forceGraph.camera();
        const ndcX = screenPos.x / this.renderDiv.clientWidth * 2;
        const ndcY = screenPos.y / this.renderDiv.clientHeight * 2;

        targetVector.set(ndcX, ndcY, 0.5);
        targetVector.unproject(graphCamera);

        // Create ray and intersect with plane at targetZ
        const ray = new THREE.Ray();
        ray.origin.copy(graphCamera.position);
        ray.direction.copy(targetVector).sub(graphCamera.position).normalize();

        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -targetZ);
        const intersectionPoint = new THREE.Vector3();

        if (ray.intersectPlane(plane, intersectionPoint)) {
            targetVector.copy(intersectionPoint);
        } else {
            targetVector.z = targetZ;
        }

        return targetVector;
    }

    _handlePinchMove(handIndex, currentPinchScreenPos) {
        if (this.interactionMode !== 'drag' || 
            !this.forceGraph || 
            !this.draggedNodeInfo.node || 
            this.draggedNodeInfo.handIndex !== handIndex) return;

        const node = this.draggedNodeInfo.node;
        const targetScreenPos = currentPinchScreenPos.clone().add(this.draggedNodeInfo.screenOffset);
        const newWorldPos = this._screenToWorld(targetScreenPos, this.draggedNodeInfo.initialNodeWorldPos.z);

        if (newWorldPos) {
            Object.assign(node, {
                fx: newWorldPos.x,
                fy: newWorldPos.y,
                fz: newWorldPos.z,
                x: newWorldPos.x,
                y: newWorldPos.y,
                z: newWorldPos.z
            });

            this.forceGraph.graphData().nodes = [...this.forceGraph.graphData().nodes];
            this.forceGraph.d3ReheatSimulation?.();
        }
    }

    _animate() {
        requestAnimationFrame(this._animate.bind(this));

        if (this.gameState === 'tracking') {
            this._updateHands();
        }

        this.renderer.render(this.scene, this.camera);
    }

    start() {
        console.log('Game setup initiated. Waiting for async operations...');
    }

    _updateSpeechBubbleAppearance() {
        if (!this.speechBubble) return;

        const isPlaceholder = this.speechBubble.innerHTML === "..." || this.speechBubble.innerText === "...";
        const showActiveStyling = this.isSpeechActive && !isPlaceholder;

        // Use CSS classes instead of inline styles
        this.speechBubble.classList.toggle('active', showActiveStyling);
        this.speechBubble.classList.toggle('placeholder', isPlaceholder && !showActiveStyling);
    }

    _setupSpeechRecognition() {
        this.speechManager = new SpeechManager(
            (finalTranscript, interimTranscript) => {
                if (!this.speechBubble) return;

                clearTimeout(this.speechBubbleTimeout);

                if (finalTranscript) {
                    this.speechBubble.innerHTML = finalTranscript;
                    this.speechBubble.style.opacity = '1';
                    this._handleSpeechCommand(finalTranscript.toLowerCase().trim());
                    
                    this.speechBubbleTimeout = setTimeout(() => {
                        this.speechBubble.innerHTML = "...";
                        this.speechBubble.style.opacity = '0.7';
                        this._updateSpeechBubbleAppearance();
                    }, 2000);
                } else if (interimTranscript) {
                    this.speechBubble.innerHTML = `<i style="color: #333;">${interimTranscript}</i>`;
                    this.speechBubble.style.opacity = '1';
                } else {
                    this.speechBubbleTimeout = setTimeout(() => {
                        if (this.speechBubble.innerHTML !== "...") {
                            this.speechBubble.innerHTML = "...";
                        }
                        this.speechBubble.style.opacity = '0.7';
                        this._updateSpeechBubbleAppearance();
                    }, 500);
                }

                this._updateSpeechBubbleAppearance();
            },
            (isActive) => {
                this.isSpeechActive = isActive;
                this._updateSpeechBubbleAppearance();
            }
        );

        if (this.speechBubble) {
            this.speechBubble.innerHTML = "...";
            this.speechBubble.style.opacity = '0.7';
            this._updateSpeechBubbleAppearance();
        }
    }

    _handleSpeechCommand(command) {
        const commands = {
            drag: () => this._handleInteractionModeChange('drag'),
            rotate: () => this._handleInteractionModeChange('rotate'),
            zoom: () => this._handleInteractionModeChange('zoom')
        };

        const autoRotateCommands = ['auto rotation', 'autorotation', 'auto rotate'];
        
        if (autoRotateCommands.some(cmd => command.includes(cmd))) {
            this._toggleAutoRotation();
        } else {
            Object.entries(commands).forEach(([key, action]) => {
                if (command.includes(key)) action();
            });
        }
    }

    _setupForceGraph() {
        if (!this.forceGraphContainer) {
            console.error("Force graph container DOM element not found.");
            this._showError("Graph container missing.");
            return;
        }

        try {
            // Setup CSS2DRenderer
            this.css2DRenderer = new CSS2DRenderer();
            this.css2DRenderer.setSize(this.forceGraphContainer.clientWidth, this.forceGraphContainer.clientHeight);
            this.css2DRenderer.domElement.style.position = 'absolute';
            this.css2DRenderer.domElement.style.top = '0px';
            this.css2DRenderer.domElement.style.pointerEvents = 'none';
            
            this.forceGraphContainer.appendChild(this.css2DRenderer.domElement);

            // Create ForceGraph3D
            this.forceGraph = ForceGraph3D({
                controlType: 'orbit',
                rendererConfig: { alpha: true, antialias: true },
                extraRenderers: [this.css2DRenderer]
            })(this.forceGraphContainer)
                .jsonUrl('assets/data.json')
                .nodeAutoColorBy('group')
                .nodeRelSize(15)
                .nodeOpacity(1)
                .linkOpacity(0.8)
                .linkWidth(3)
                .nodeThreeObject(node => {
                    const nodeEl = document.createElement('div');
                    nodeEl.textContent = node.id;
                    nodeEl.className = 'node-label';
                    return new CSS2DObject(nodeEl);
                })
                .nodeThreeObjectExtend(true)
                .onNodeClick(node => console.log("Clicked node:", node))
                .backgroundColor('rgba(0,0,0,0)');

            // Setup post-processing
            const graphRenderer = this.forceGraph.renderer();
            const graphScene = this.forceGraph.scene();
            const graphCamera = this.forceGraph.camera();

            if (graphRenderer && graphScene && graphCamera) {
                this.graphComposer = new EffectComposer(graphRenderer);
                this.graphComposer.addPass(new RenderPass(graphScene, graphCamera));
                
                this.bloomEffect = new BloomEffect({
                    luminanceThreshold: 0.01,
                    luminanceSmoothing: 0.0,
                    intensity: 4.0,
                    mipmapBlur: true
                });
                
                this.graphComposer.addPass(new EffectPass(graphCamera, this.bloomEffect));
                this.forceGraph.postProcessingComposer(this.graphComposer);
                console.log("Bloom post-processing enabled for the force graph.");
            }

            this.forceGraph.cameraPosition({ z: 500 });
            console.log("3D Force Graph initialized successfully.");

        } catch (error) {
            console.error("Error initializing 3D Force Graph:", error);
            this._showError("Failed to load 3D graph. Check console.");
            this._cleanupGraphContainers();
        }
    }

    _cleanupGraphContainers() {
        [this.forceGraphContainer, this.css2DRenderer?.domElement].forEach(element => {
            if (element?.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        this.forceGraphContainer = null;
        this.css2DRenderer = null;
    }

    _get3DDistanceSq(p1, p2) {
        return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2;
    }

    _isFist(landmarks) {
        const requiredIndices = [this.LANDMARK_INDICES.WRIST, this.LANDMARK_INDICES.MIDDLE_FINGER_MCP, ...this.LANDMARK_INDICES.FINGERTIP_INDICES_FOR_FIST];
        if (!landmarks || landmarks.length <= Math.max(...requiredIndices)) return false;

        const wrist = landmarks[this.LANDMARK_INDICES.WRIST];
        const middleMcp = landmarks[this.LANDMARK_INDICES.MIDDLE_FINGER_MCP];
        const refDistSq = this._get3DDistanceSq(wrist, middleMcp);

        if (refDistSq === 0) return false;

        const thresholdSq = this.THRESHOLDS.FIST_CURL_RATIO ** 2;
        const curledFingers = this.LANDMARK_INDICES.FINGERTIP_INDICES_FOR_FIST
            .map(tipIndex => landmarks[tipIndex])
            .filter(fingertip => this._get3DDistanceSq(fingertip, wrist) / refDistSq < thresholdSq)
            .length;

        return curledFingers >= this.THRESHOLDS.MIN_FINGERS_CURLED_FOR_FIST;
    }

    _toggleAutoRotation(forceState) {
        if (!this.forceGraph?.controls()) return;

        const controls = this.forceGraph.controls();
        const newState = typeof forceState === 'boolean' ? forceState : !this.isAutoRotating;
        
        this.isAutoRotating = newState;
        controls.autoRotate = this.isAutoRotating;
        controls.autoRotateSpeed = this.isAutoRotating ? this.autoRotateSpeed : 0;

        const status = this.isAutoRotating ? "Auto-Rotation ON" : "Auto-Rotation OFF";
        console.log(status);

        if (this.speechBubble && this.speechManager?.isRecognizing) {
            this.speechBubble.innerHTML = status;
            this.speechBubble.style.opacity = '1';
            this._updateSpeechBubbleAppearance();

            setTimeout(() => {
                if (this.speechBubble.innerHTML === status) {
                    this.speechBubble.innerHTML = this.speechManager.interimTranscript ? 
                        `<i style="color: #333;">${this.speechManager.interimTranscript}</i>` : "...";
                    this.speechBubble.style.opacity = this.speechManager.interimTranscript ? '1' : '0.7';
                }
                this._updateSpeechBubbleAppearance();
            }, 1500);
        }
    }

    _setNodeHoverStyle(node, isHovering) {
        const labelElement = node?.threeObject?.element;
        if (labelElement) {
            labelElement.classList.toggle('node-label-hover', isHovering);
        }
    }
}