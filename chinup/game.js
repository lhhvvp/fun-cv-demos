import * as THREE from 'three';
import { PoseLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';
import { AudioManager } from './audioManager.js';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export class Game {
    constructor(renderDiv) {
        this.renderDiv = renderDiv;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.videoElement = null;
        this.poseLandmarker = null;
        this.lastVideoTime = -1;
        this.numPosesToTrack = 1;
        this.poses = [];
        this.lastLandmarkPositions = [];
        this.gameState = 'loading';
        this.clock = new THREE.Clock();
        this.audioManager = new AudioManager();
        this.smoothingFactor = 0.4;

        // Chin-up tracking variables
        this.chinUpCount = 0;
        this.chinUpState = 'hanging'; // 'hanging', 'pulling' (simplified to 2 states)
        this.headPositionHistory = [];
        this.handPositionHistory = [];
        this.historyLength = 10;
        this.completeThreshold = 0.04; // Head must reach within 4% of hand level to complete
        this.consecutiveFramesRequired = 2; // Reduced from 5 for faster response
        this.stateFrameCount = 0;
        this.lastStateChange = Date.now();
        this.minTimeBetweenStateChanges = 100; // Reduced from 800ms for more responsive detection
        this.chinUpStarted = false; // Track if a valid chinup start was detected

        // Cat-related variables
        this.currentCat = null;
        this.currentCatData = null; // Reference to the wandering cat data
        this.savedCats = [];
        this.catTextures = []; // Array to hold multiple cat textures
        this.fireTexture = null;
        this.catHeadSpacing = 0.6;
        this.catScale = isMobile ? 100: 180;; // Size for cats on head
        this.savedCatScale = isMobile ? 70: 120; // Slightly bigger size for saved cats (was 80)
        this.savedCatPositions = []; // Track positions of saved cats
        this.maxSavedCatsVisible = 30; // Maximum number of saved cats to display
        this.driftingCat = null; // Track cat that's currently drifting to head
        this.driftStartTime = 0;
        this.driftDuration = 1000; // 1 seconds to drift from bottom to head

        // Wandering cats at bottom
        this.wanderingCats = [];
        this.wanderingCatScale = 110;
        this.numWanderingCats = 30; // 30 cats wandering at bottom

        // Initialize line material
        this.poseLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
        
        // Initialize circle material for landmarks
        this.circleMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });

        this.poseConnections = [
            [11,12], [11,23], [12,24], [23,24], // Torso
            [11,13], [13,15], [12,14], [14,16], // Arms
            [23,25], [25,27], [24,26], [26,28]  // Legs
        ];
        
        this.poseKeypointIndices = [0,11,12,13,14,15,16,23,24,25,26,27,28]; // Remove face landmarks except nose (0)

        this._init().catch(error => {
            console.error("Initialization failed:", error);
            this._showError("Initialization failed. Check console.");
        });
    }

    async _init() {
        this._setupDOMReferences();
        this._setupThree();
        await this._loadAssets();
        await this._setupPoseTracking();
        await this.videoElement.play();
        this._createWanderingCats();
        window.addEventListener('resize', () => this._onResize());
        this.gameState = 'ready';
        this._showStartButton();
        this._animate();
    }

    _setupDOMReferences() {
        // Get references to existing DOM elements
        this.videoElement = document.getElementById('videoElement');
        this.startScreenOverlay = document.getElementById('startScreenOverlay');
        this.startButton = document.getElementById('startButton');
        this.counterContainer = document.getElementById('counterContainer');
        this.counterDisplay = document.getElementById('counterDisplay');
        // this.stateDisplay = document.getElementById('stateDisplay');
        this.gameOverContainer = document.getElementById('gameOverContainer');
        this.gameOverText = document.getElementById('gameOverText');
        this.restartHintText = document.getElementById('restartHintText');
        this.loadingText = document.getElementById('loadingText');
        this.houseImage = document.getElementById('houseImage');
        this.fireContainer = document.getElementById('fireContainer');

        // Setup event listeners
        this.startButton.onclick = () => this._startGame();
        
        // Setup fire images
        this._setupFireImages();
    }

    _setupThree() {
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);
        this.camera.position.z = 100;
        
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        Object.assign(this.renderer.domElement.style, {
            position: 'absolute', top: '0', left: '0', zIndex: '1'
        });
        this.renderDiv.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(0, 0, 100);
        this.scene.add(directionalLight);

        // Initialize poses
        for (let i = 0; i < this.numPosesToTrack; i++) {
            const lineGroup = new THREE.Group();
            lineGroup.visible = false;
            this.scene.add(lineGroup);
            this.poses.push({
                landmarks: null,
                anchorPos: new THREE.Vector3(),
                lineGroup
            });
            this.lastLandmarkPositions.push([]);
        }
    }

    _clearPoseVisuals() {
        this.poses.forEach(p => {
            if (p.lineGroup) {
                while (p.lineGroup.children.length > 0) {
                    const child = p.lineGroup.children[0];
                    p.lineGroup.remove(child);
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                }
            }
        });
    }

    async _loadAssets() {
        const textureLoader = new THREE.TextureLoader();
        
        try {
            // Load multiple cat textures
            const catFiles = ['assets/cat.png', 'assets/cat2.png', 'assets/cat3.png', 'assets/cat4.png'];
            this.catTextures = [];
            
            for (let i = 0; i < catFiles.length; i++) {
                try {
                    const texture = await new Promise((resolve, reject) => {
                        textureLoader.load(
                            catFiles[i],
                            (texture) => {
                                texture.generateMipmaps = false;
                                texture.minFilter = THREE.LinearFilter;
                                texture.magFilter = THREE.LinearFilter;
                                resolve(texture);
                            },
                            undefined,
                            (error) => {
                                console.warn(`Could not load ${catFiles[i]}, using fallback`);
                                // Create a fallback texture with different colors for each cat
                                const canvas = document.createElement('canvas');
                                canvas.width = 64;
                                canvas.height = 64;
                                const ctx = canvas.getContext('2d');
                                
                                // Different colors for each cat
                                const colors = ['#ff6b9d', '#9d6bff', '#6bff9d'];
                                ctx.fillStyle = colors[i] || '#ff6b9d';
                                ctx.fillRect(0, 0, 64, 64);
                                ctx.fillStyle = '#000';
                                ctx.font = '40px Arial';
                                ctx.textAlign = 'center';
                                ctx.fillText('🐱', 32, 42);
                                
                                const fallbackTexture = new THREE.CanvasTexture(canvas);
                                fallbackTexture.generateMipmaps = false;
                                fallbackTexture.minFilter = THREE.LinearFilter;
                                fallbackTexture.magFilter = THREE.LinearFilter;
                                resolve(fallbackTexture);
                            }
                        );
                    });
                    this.catTextures.push(texture);
                    console.log(`Cat texture ${i + 1} loaded successfully`);
                } catch (error) {
                    console.error(`Error loading cat texture ${i + 1}:`, error);
                }
            }
            
            // If no textures loaded, create at least one fallback
            if (this.catTextures.length === 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ff6b9d';
                ctx.fillRect(0, 0, 64, 64);
                ctx.fillStyle = '#000';
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('🐱', 32, 42);
                
                const fallbackTexture = new THREE.CanvasTexture(canvas);
                fallbackTexture.generateMipmaps = false;
                fallbackTexture.minFilter = THREE.LinearFilter;
                fallbackTexture.magFilter = THREE.LinearFilter;
                this.catTextures.push(fallbackTexture);
            }
            
            // Load fire texture
            this.fireTexture = await new Promise((resolve, reject) => {
                textureLoader.load(
                    'assets/fire.png',
                    (texture) => {
                        texture.generateMipmaps = false;
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        console.warn('Could not load fire.png, using fallback');
                        // Create a simple fire-colored square as fallback
                        const canvas = document.createElement('canvas');
                        canvas.width = 32;
                        canvas.height = 32;
                        const ctx = canvas.getContext('2d');
                        const gradient = ctx.createLinearGradient(0, 0, 0, 32);
                        gradient.addColorStop(0, '#ff4444');
                        gradient.addColorStop(0.5, '#ff8800');
                        gradient.addColorStop(1, '#ffff00');
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, 0, 32, 32);
                        
                        const fallbackTexture = new THREE.CanvasTexture(canvas);
                        fallbackTexture.generateMipmaps = false;
                        fallbackTexture.minFilter = THREE.LinearFilter;
                        fallbackTexture.magFilter = THREE.LinearFilter;
                        resolve(fallbackTexture);
                    }
                );
            });
            console.log('Fire texture loaded successfully');
            
        } catch (error) {
            console.error('Error loading textures:', error);
        }
    }

    _setupFireImages() {
        // Create fire images along the bottom using DOM
        const fireCount = Math.ceil(window.innerWidth / 60); // Adjust based on fire image width
        
        for (let i = 0; i < fireCount; i++) {
            const fireImg = document.createElement('img');
            fireImg.src = 'assets/fire.png';
            fireImg.className = 'fire-image';
            
            // Add random delays and slight variations for more organic movement (slower)
            const randomDelay = Math.random() * 2.0; // 0 to 2.0 seconds (was 0.8)
            const randomDuration = 1.0 + Math.random() * 1.0; // 1.0 to 2.0 seconds (was 0.4 to 0.8)
            
            fireImg.style.animationDelay = `${randomDelay}s`;
            fireImg.style.animationDuration = `${randomDuration}s`;
            
            this.fireContainer.appendChild(fireImg);
        }
        
        // Handle fallback if fire.png doesn't load
        this.fireContainer.querySelectorAll('.fire-image').forEach(img => {
            img.onerror = () => {
                img.style.background = 'linear-gradient(to top, #ff4444, #ff8800, #ffff00)';
                img.style.width = '60px';
                img.style.height = '60px';
                img.src = ''; // Remove broken src
            };
        });
    }

    _getRandomCatTexture() {
        if (this.catTextures.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * this.catTextures.length);
        return this.catTextures[randomIndex];
    }

    _createCatSprite(isForSaving = false, textureIndex = null) {
        let texture;
        if (textureIndex !== null && textureIndex < this.catTextures.length) {
            texture = this.catTextures[textureIndex];
        } else {
            texture = this._getRandomCatTexture();
        }
        
        if (!texture) return null;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            alphaTest: 0.1
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        const scale = isForSaving ? this.savedCatScale : this.catScale;
        sprite.scale.set(scale, scale, 1);
        
        // Set higher z-position for saved cats to appear in front of house
        sprite.position.z = isForSaving ? 25 : 10; // 25 for saved cats, 10 for current cat
        
        return sprite;
    }

    _createWanderingCats() {
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        const bottomY = -height / 2 + 60; // Position above the fire
        
        for (let i = 0; i < this.numWanderingCats; i++) {
            // Randomly choose a cat texture for each wandering cat
            const randomTextureIndex = Math.floor(Math.random() * this.catTextures.length);
            const texture = this.catTextures[randomTextureIndex];
            
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                alphaTest: 0.1
            }));
            
            sprite.scale.set(this.wanderingCatScale, this.wanderingCatScale, 1);
            
            // Random starting position along the bottom
            const startX = (Math.random() - 0.5) * width * 0.9; // Stay within 90% of screen width
            sprite.position.set(startX, bottomY, 5); // z=5 to be in front of fire but behind other cats
            
            const wanderingCat = {
                sprite: sprite,
                targetX: startX,
                moveSpeed: 0.3 + Math.random() * 0.4, // Random speed between 0.3 and 0.7 (slower for more cats)
                rotationSpeed: (Math.random() - 0.5) * 0.015, // Slower rotation for more cats
                changeDirectionTime: Date.now() + Math.random() * 4000 + 3000, // Change direction every 3-7 seconds
                baseY: bottomY,
                isAvailable: true, // Track if this cat can be picked up
                textureIndex: randomTextureIndex // Store which texture this cat uses
            };
            
            this.wanderingCats.push(wanderingCat);
            this.scene.add(sprite);
        }
    }

    _updateWanderingCats() {
        const currentTime = Date.now();
        const { clientWidth: width } = this.renderDiv;
        
        this.wanderingCats.forEach(cat => {
            // Only update cats that are still wandering (available)
            if (!cat.isAvailable) return;
            
            // Check if it's time to change direction
            if (currentTime > cat.changeDirectionTime) {
                // Pick a new random target position
                cat.targetX = (Math.random() - 0.5) * width * 0.9;
                cat.changeDirectionTime = currentTime + Math.random() * 4000 + 3000; // Next change in 3-7 seconds
            }
            
            // Move towards target
            const deltaX = cat.targetX - cat.sprite.position.x;
            if (Math.abs(deltaX) > 5) { // Only move if not close enough
                const moveDirection = Math.sign(deltaX);
                cat.sprite.position.x += moveDirection * cat.moveSpeed;
                
                // Flip sprite based on movement direction
                cat.sprite.scale.x = Math.abs(cat.sprite.scale.x) * (moveDirection > 0 ? 1 : -1);
            }
            
            // Add slight bobbing motion and rotation
            const bobOffset = Math.sin(currentTime * 0.002 + cat.sprite.position.x * 0.01) * 3; // Smaller bobbing for more cats
            cat.sprite.position.y = cat.baseY + bobOffset;
            
            // Gentle rotation
            cat.sprite.rotation.z += cat.rotationSpeed;
            
            // Keep rotation within reasonable bounds
            if (Math.abs(cat.sprite.rotation.z) > 0.2) { // Smaller rotation bounds
                cat.rotationSpeed *= -0.8; // Reverse and dampen rotation
            }
        });
    }

    _spawnCat(headPosition) {
        // Only spawn a cat if there isn't already one drifting or on head
        if (this.currentCat || this.driftingCat) {
            return; // Don't replace existing cat
        }
        
        // Find an available wandering cat to pick up
        const availableCats = this.wanderingCats.filter(cat => cat.isAvailable);
        if (availableCats.length === 0) {
            console.log('No available cats to rescue!');
            return;
        }
        
        // Pick a random available cat
        const randomIndex = Math.floor(Math.random() * availableCats.length);
        const selectedWanderingCat = availableCats[randomIndex];
        
        // Mark this cat as no longer available for wandering
        selectedWanderingCat.isAvailable = false;
        
        // Set up drifting cat
        this.driftingCat = {
            sprite: selectedWanderingCat.sprite,
            startPosition: selectedWanderingCat.sprite.position.clone(),
            targetPosition: headPosition.clone(),
            wanderingCatData: selectedWanderingCat
        };
        
        // Adjust target position to be above head
        this.driftingCat.targetPosition.y += this.catScale * this.catHeadSpacing;
        this.driftingCat.targetPosition.z = 10; // Move to head layer
        
        // Start drift animation
        this.driftStartTime = Date.now();
        
        console.log('Cat starting drift from bottom to head');
    }

    _updateCatPosition(headPosition) {
        if (this.currentCat && headPosition) {
            // Smoothly follow the head position with increased height offset
            this.currentCat.position.x = headPosition.x;
            this.currentCat.position.y = headPosition.y + this.catScale * this.catHeadSpacing;
        }
        
        // Update drifting cat target if head moves during drift
        if (this.driftingCat && headPosition) {
            this.driftingCat.targetPosition.x = headPosition.x;
            this.driftingCat.targetPosition.y = headPosition.y + this.catScale * this.catHeadSpacing;
        }
    }

    _saveCat() {
        let catToSave = null;
        let catData = null;
        
        // Check if we have a cat on head
        if (this.currentCat && this.currentCatData) {
            catToSave = this.currentCat;
            catData = this.currentCatData;
        }
        // If no current cat, check if we have a drifting cat
        else if (this.driftingCat && this.driftingCat.sprite && this.driftingCat.wanderingCatData) {
            catToSave = this.driftingCat.sprite;
            catData = this.driftingCat.wanderingCatData;
            
            // Clear the drifting cat since we're saving it
            this.driftingCat = null;
        }
        
        // If no cat to save, return early
        if (!catToSave || !catData) {
            console.log('No cat available to save');
            return;
        }
        
        console.log('Starting cat drift to saved position');
        
        // Calculate target position near the house (top-right area)
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        const houseArea = {
            right: width / 2, // 20px margin from right edge
            left: width / 2 - 300, // House width area
            top: height / 2 - 50,  // 50px margin from top
            bottom: height / 2 - 200 // House height area
        };
        
        const margin = 10;
        const spacing = 50; // Spacing between saved cats
        const catsPerRow = Math.floor((houseArea.right - houseArea.left - margin * 2) / spacing);
        
        const catIndex = this.savedCats.length;
        const row = Math.floor(catIndex / catsPerRow);
        const col = catIndex % catsPerRow;
        
        const targetX = houseArea.left + margin + (col * spacing);
        const targetY = houseArea.top - margin - (row * spacing);
        
        // Create saved cat data with animation info
        const savedCat = {
            sprite: catToSave,
            targetPosition: new THREE.Vector3(targetX, targetY, 25),
            isMoving: true,
            startTime: Date.now(),
            startPosition: catToSave.position.clone(),
            wanderingCatData: catData,
            animationDuration: 2000 // 2 seconds for save drift
        };
        
        // Add to saved cats array
        this.savedCats.push(savedCat);
        
        // Clear current cat references
        this.currentCat = null;
        this.currentCatData = null;
        
        // Clean up old saved cats if we have too many
        if (this.savedCats.length > this.maxSavedCatsVisible) {
            const oldCat = this.savedCats.shift();
            
            // Return the old cat to wandering if possible
            if (oldCat.wanderingCatData) {
                this._returnCatToWandering(oldCat.wanderingCatData, oldCat.sprite);
            } else {
                // If no wandering data, remove the sprite
                this.scene.remove(oldCat.sprite);
                if (oldCat.sprite.material.map) {
                    oldCat.sprite.material.map.dispose();
                }
                oldCat.sprite.material.dispose();
            }
        }
    }

    _returnCatToWandering(wanderingCatData, sprite) {
        // Reset the cat back to wandering state
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        const bottomY = -height / 2 + 80;
        
        // Reset scale and position for wandering
        sprite.scale.set(this.wanderingCatScale, this.wanderingCatScale, 1);
        sprite.position.set(
            (Math.random() - 0.5) * width * 0.9, // Random position along bottom
            bottomY,
            5 // Back to wandering layer
        );
        sprite.rotation.z = 0;
        
        // Reset wandering cat data
        wanderingCatData.isAvailable = true;
        wanderingCatData.targetX = sprite.position.x;
        wanderingCatData.baseY = bottomY;
        wanderingCatData.changeDirectionTime = Date.now() + Math.random() * 4000 + 3000;
        
        console.log('Cat returned to wandering');   
    }

    async _setupPoseTracking() {
        try {
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                    delegate: 'GPU'
                },
                numPoses: this.numPosesToTrack,
                runningMode: 'VIDEO',
                outputSegmentationMasks: false
            });

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            this.videoElement.srcObject = stream;

            return new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => resolve();
            });
        } catch (error) {
            console.error('Error setting up Pose Tracking or Webcam:', error);
            this._showError(`Webcam/Pose Tracking Error: ${error.message}. Please allow camera access.`);
            throw error;
        }
    }

    _trackChinUpMovement(landmarks) {
        if (!landmarks || landmarks.length === 0) return;

        const nose = landmarks[0];
        const leftElbow = landmarks[13];   // For start detection
        const rightElbow = landmarks[14];  // For start detection
        const leftWrist = landmarks[15];   // For completion detection
        const rightWrist = landmarks[16];  // For completion detection
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];

        // Calculate head position (normalized to screen height)
        const headY = nose.y;
        
        // Calculate average elbow position (for start detection)
        const avgElbowY = (leftElbow.y + rightElbow.y) / 2;
        
        // Calculate average wrist position (for completion detection)
        const avgWristY = (leftWrist.y + rightWrist.y) / 2;
        
        // Calculate shoulder position for reference
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;

        // Store position history (using elbows for consistency)
        this.headPositionHistory.push(headY);
        this.handPositionHistory.push(avgElbowY);
        
        if (this.headPositionHistory.length > this.historyLength) {
            this.headPositionHistory.shift();
            this.handPositionHistory.shift();
        }

        // Check visibility - need both elbows and wrists
        if (nose.visibility < 0.5 || leftElbow.visibility < 0.5 || rightElbow.visibility < 0.5 ||
            leftWrist.visibility < 0.5 || rightWrist.visibility < 0.5) {
            // Don't remove cat when pose is temporarily lost - just return
            return;
        }

        // Adaptive thresholds based on shoulder-to-elbow distance
        const shoulderToElbowDistance = Math.abs(avgShoulderY - avgElbowY);
        const baseDistance = shoulderToElbowDistance > 0 ? shoulderToElbowDistance : 0.1;
        
        // Start thresholds (head vs elbows) - trigger as soon as head is below elbows
        const finalStartThreshold = -0.02;
        
        // Completion thresholds (head vs wrists) - typically more strict
        const shoulderToWristDistance = Math.abs(avgShoulderY - avgWristY);
        const wristBaseDistance = shoulderToWristDistance > 0 ? shoulderToWristDistance : 0.15;

        // State machine for chin-up detection
        const currentTime = Date.now();
        
        // Prevent rapid state changes
        if (currentTime - this.lastStateChange < this.minTimeBetweenStateChanges) {
            return;
        }

        let newState = this.chinUpState;
        
        switch (this.chinUpState) {
            case 'hanging':
                // Check if head is below elbows AND we haven't already started this rep
                if (!this.chinUpStarted && headY > avgElbowY + finalStartThreshold) {
                    // Head is below elbows - trigger start immediately
                    this.stateFrameCount++;
                    if (this.stateFrameCount >= this.consecutiveFramesRequired) {
                        newState = 'pulling';
                        this.chinUpStarted = true;
                        this.audioManager.playStartBeep();
                        this.stateFrameCount = 0;
                        
                        // Spawn a cat when starting chin-up
                        const headPosition = this._getHeadPosition();
                        if (headPosition) {
                            this._spawnCat(headPosition);
                        }
                        
                        console.log(`Chin-up started! Head: ${headY.toFixed(3)}, Elbows: ${avgElbowY.toFixed(3)}`);
                    }
                } else {
                    this.stateFrameCount = 0;
                }
                break;

            case 'pulling':
                // Check if head reached wrist level (proper chin-up completion)
                if (this.chinUpStarted && headY <= avgWristY + this.completeThreshold) {
                    this.stateFrameCount++;
                    if (this.stateFrameCount >= this.consecutiveFramesRequired) {
                        newState = 'hanging';
                        this.chinUpCount++;
                        this.audioManager.playCelebrationSound();
                        this._updateCounterDisplay();
                        this.stateFrameCount = 0;
                        this.chinUpStarted = false;
                        
                        // Save the cat when chin-up is completed
                        this._saveCat();
                        
                        console.log(`Chin-up completed! Head: ${headY.toFixed(3)}, Wrists: ${avgWristY.toFixed(3)}, Total: ${this.chinUpCount}`);
                    }
                } else {
                    this.stateFrameCount = 0;
                }
                break;
        }

        if (newState !== this.chinUpState) {
            this.chinUpState = newState;
            this.lastStateChange = currentTime;
        }
    }

    _getHeadPosition() {
        // Get the current head position from the pose
        if (this.poses[0] && this.poses[0].landmarks && this.poses[0].landmarks[0]) {
            const nose = this.poses[0].landmarks[0];
            if (nose.visibility > 0.5) {
                // Convert landmark position to screen coordinates
                const videoParams = this._getVisibleVideoParameters();
                if (videoParams) {
                    const { clientWidth: canvasWidth, clientHeight: canvasHeight } = this.renderDiv;
                    const lmOriginalX = nose.x * videoParams.videoNaturalWidth;
                    const lmOriginalY = nose.y * videoParams.videoNaturalHeight;
                    const normX_visible = (lmOriginalX - videoParams.offsetX) / videoParams.visibleWidth;
                    const normY_visible = (lmOriginalY - videoParams.offsetY) / videoParams.visibleHeight;
                    const x = (1 - normX_visible) * canvasWidth - canvasWidth / 2;
                    const y = (1 - normY_visible) * canvasHeight - canvasHeight / 2;
                    return new THREE.Vector3(x, y, 1);
                }
            }
        }
        return null;
    }

    _updateCounterDisplay() {
        this.counterDisplay.textContent = `Cats Saved: ${this.chinUpCount}`;
        
        // Remove any existing flash class first
        this.counterDisplay.classList.remove('flash');
        
        // Force a reflow to ensure the class removal takes effect
        this.counterDisplay.offsetHeight;
        
        // Add flash animation
        this.counterDisplay.classList.add('flash');
        
        // Remove the flash class after animation completes
        setTimeout(() => {
            this.counterDisplay.classList.remove('flash');
        }, 1200);
    }

    _updateStateDisplay() {
        const stateText = {
            'hanging': 'Ready to rescue a cat',
            'pulling': 'Saving cat...'
        };
        this.stateDisplay.textContent = `State: ${stateText[this.chinUpState] || this.chinUpState}`;
    }

    _updatePose() {
        if (!this.poseLandmarker || !this.videoElement.srcObject || 
            this.videoElement.readyState < 2 || this.videoElement.videoWidth === 0) return;

        const videoTime = this.videoElement.currentTime;
        if (videoTime <= this.lastVideoTime) return;

        this.lastVideoTime = videoTime;
        try {
            const results = this.poseLandmarker.detectForVideo(this.videoElement, performance.now());
            if (!results?.landmarks?.length) {
                this.poses.forEach(p => p.lineGroup && (p.lineGroup.visible = false));
                // Don't remove cat when pose detection fails temporarily
                return;
            }

            const videoParams = this._getVisibleVideoParameters();
            if (!videoParams) return;

            const { clientWidth: canvasWidth, clientHeight: canvasHeight } = this.renderDiv;

            this.poses.forEach((pose, i) => {
                if (results.landmarks[i]?.length > 0) {
                    const currentRawLandmarks = results.landmarks[i];
                    
                    if (!this.lastLandmarkPositions[i] || this.lastLandmarkPositions[i].length !== currentRawLandmarks.length) {
                        this.lastLandmarkPositions[i] = currentRawLandmarks.map(lm => ({ ...lm }));
                    }

                    const smoothedLandmarks = currentRawLandmarks.map((lm, lmIndex) => {
                        const prevLm = this.lastLandmarkPositions[i][lmIndex];
                        return {
                            x: this.smoothingFactor * lm.x + (1 - this.smoothingFactor) * prevLm.x,
                            y: this.smoothingFactor * lm.y + (1 - this.smoothingFactor) * prevLm.y,
                            z: this.smoothingFactor * lm.z + (1 - this.smoothingFactor) * prevLm.z,
                            visibility: lm.visibility
                        };
                    });

                    this.lastLandmarkPositions[i] = smoothedLandmarks.map(lm => ({ ...lm }));
                    pose.landmarks = smoothedLandmarks;

                    // Track chin-up movement
                    if (this.gameState === 'tracking') {
                        this._trackChinUpMovement(smoothedLandmarks);
                        
                        // Update cat position if there's a current cat
                        if (this.currentCat) {
                            const headPosition = this._getHeadPosition();
                            if (headPosition) {
                                this._updateCatPosition(headPosition);
                            }
                        }
                    }

                    const nose = smoothedLandmarks[0];
                    if (nose?.visibility > 0.3) {
                        const lmOriginalX = nose.x * videoParams.videoNaturalWidth;
                        const lmOriginalY = nose.y * videoParams.videoNaturalHeight;
                        const normX_visible = (lmOriginalX - videoParams.offsetX) / videoParams.visibleWidth;
                        const normY_visible = (lmOriginalY - videoParams.offsetY) / videoParams.visibleHeight;
                        const poseX = (1 - normX_visible) * canvasWidth - canvasWidth / 2;
                        const poseY = (1 - normY_visible) * canvasHeight - canvasHeight / 2;
                        pose.anchorPos.set(poseX, poseY, 1);
                    }

                    this._updatePoseVisuals(i, smoothedLandmarks, videoParams, canvasWidth, canvasHeight);
                    pose.lineGroup.visible = true;
                } else {
                    pose.landmarks = null;
                    if (pose.lineGroup) pose.lineGroup.visible = false;
                    // Don't remove cat when pose is temporarily lost
                }
            });
        } catch (error) {
            console.error("Error during pose detection:", error);
            // Don't remove cat on pose detection errors
        }
    }

    _getVisibleVideoParameters() {
        if (!this.videoElement || this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) return null;

        const vNatW = this.videoElement.videoWidth;
        const vNatH = this.videoElement.videoHeight;
        const rW = this.renderDiv.clientWidth;
        const rH = this.renderDiv.clientHeight;

        if (!vNatW || !vNatH || !rW || !rH) return null;

        const videoAR = vNatW / vNatH;
        const renderDivAR = rW / rH;

        let finalVideoPixelX, finalVideoPixelY, visibleVideoPixelWidth, visibleVideoPixelHeight;

        if (videoAR > renderDivAR) {
            const scale = rH / vNatH;
            const scaledVideoWidth = vNatW * scale;
            const totalCroppedPixelsX = (scaledVideoWidth - rW) / scale;
            finalVideoPixelX = totalCroppedPixelsX / 2;
            finalVideoPixelY = 0;
            visibleVideoPixelWidth = vNatW - totalCroppedPixelsX;
            visibleVideoPixelHeight = vNatH;
        } else {
            const scale = rW / vNatW;
            const scaledVideoHeight = vNatH * scale;
            const totalCroppedPixelsY = (scaledVideoHeight - rH) / scale;
            finalVideoPixelX = 0;
            finalVideoPixelY = totalCroppedPixelsY / 2;
            visibleVideoPixelWidth = vNatW;
            visibleVideoPixelHeight = vNatH - totalCroppedPixelsY;
        }

        if (visibleVideoPixelWidth <= 0 || visibleVideoPixelHeight <= 0) {
            return {
                offsetX: 0, offsetY: 0, visibleWidth: vNatW, visibleHeight: vNatH,
                videoNaturalWidth: vNatW, videoNaturalHeight: vNatH
            };
        }

        return {
            offsetX: finalVideoPixelX, offsetY: finalVideoPixelY,
            visibleWidth: visibleVideoPixelWidth, visibleHeight: visibleVideoPixelHeight,
            videoNaturalWidth: vNatW, videoNaturalHeight: vNatH
        };
    }

    _showStatusScreen(message, color = 'white', showRestartHint = false) {
        this.gameOverContainer.style.display = 'block';
        this.gameOverText.innerText = message;
        this.gameOverText.style.color = color;
        this.restartHintText.style.display = showRestartHint ? 'block' : 'none';
    }

    _showError(message) {
        this.gameOverContainer.style.display = 'block';
        this.gameOverText.innerText = `ERROR: ${message}`;
        this.gameOverText.style.color = 'orange';
        this.restartHintText.style.display = 'block';
        this.gameState = 'error';
        this.poses.forEach(pose => pose.lineGroup && (pose.lineGroup.visible = false));
        this.startButton.style.display = 'none';
        this.counterContainer.style.display = 'none';
    }

    _startGame() {
        if (this.gameState !== 'ready') return;
        this.audioManager.resumeContext();
        this.startScreenOverlay.style.display = 'none';
        this.startButton.style.display = 'none';
        this.counterContainer.style.display = 'block';
        this.gameState = 'tracking';
        this.lastVideoTime = -1;
        this.clock.start();
        
        // Reset chin-up tracking
        this.chinUpCount = 0;
        this.chinUpState = 'hanging';
        this.headPositionHistory = [];
        this.handPositionHistory = [];
        this.stateFrameCount = 0;
        this.lastStateChange = Date.now();
        this.chinUpStarted = false;
        
        // Clear any existing cats
        if (this.currentCat) {
            // Return current cat to wandering if it came from there
            if (this.currentCatData) {
                this._returnCatToWandering(this.currentCatData, this.currentCat);
            } else {
                this.scene.remove(this.currentCat);
            }
            this.currentCat = null;
            this.currentCatData = null;
        }
        
        // Reset all saved cats back to wandering
        this.savedCats.forEach(savedCat => {
            if (savedCat.wanderingCatData) {
                this._returnCatToWandering(savedCat.wanderingCatData, savedCat.sprite);
            } else {
                this.scene.remove(savedCat.sprite);
                if (savedCat.sprite.material.map) {
                    savedCat.sprite.material.map.dispose();
                }
                savedCat.sprite.material.dispose();
            }
        });
        this.savedCats = [];
        
        this._updateCounterDisplay();
        // this._updateStateDisplay();
    }

    _restartGame() {
        this.gameOverContainer.style.display = 'none';
        this.startScreenOverlay.style.display = 'none';
        this.counterContainer.style.display = 'block';
        this.poses.forEach(pose => pose.lineGroup && (pose.lineGroup.visible = false));
        this.gameState = 'tracking';
        this.lastVideoTime = -1;
        this.clock.start();
        
        // Reset chin-up tracking
        this.chinUpCount = 0;
        this.chinUpState = 'hanging';
        this.headPositionHistory = [];
        this.handPositionHistory = [];
        this.stateFrameCount = 0;
        this.lastStateChange = Date.now();
        this.chinUpStarted = false;
        
        // Clear any existing cats
        if (this.currentCat) {
            // Return current cat to wandering if it came from there
            if (this.currentCatData) {
                this._returnCatToWandering(this.currentCatData, this.currentCat);
            } else {
                this.scene.remove(this.currentCat);
            }
            this.currentCat = null;
            this.currentCatData = null;
        }
        
        // Reset all saved cats back to wandering
        this.savedCats.forEach(savedCat => {
            if (savedCat.wanderingCatData) {
                this._returnCatToWandering(savedCat.wanderingCatData, savedCat.sprite);
            } else {
                this.scene.remove(savedCat.sprite);
                if (savedCat.sprite.material.map) {
                    savedCat.sprite.material.map.dispose();
                }
                savedCat.sprite.material.dispose();
            }
        });
        this.savedCats = [];
        
        this._updateCounterDisplay();
        //this._updateStateDisplay();
    }

    _showStartButton() {
        this.loadingText.style.display = 'none';
        this.startButton.style.display = 'block';
    }

    _onResize() {
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        
        this.camera.left = width / -2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = height / -2;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        
        // Update fire images on resize
        this._updateFireImages();
        
        // Update wandering cats positions
        this._updateWanderingCatsOnResize();
    }

    _updateWanderingCatsOnResize() {
        const { clientHeight: height } = this.renderDiv;
        const bottomY = -height / 2 + 80;
        
        this.wanderingCats.forEach(cat => {
            cat.baseY = bottomY;
            cat.sprite.position.y = bottomY;
        });
    }

    _updateFireImages() {
        // Clear existing fire images
        this.fireContainer.innerHTML = '';
        
        // Recreate fire images with new count based on window width
        const fireCount = Math.ceil(window.innerWidth / 60);
        
        for (let i = 0; i < fireCount; i++) {
            const fireImg = document.createElement('img');
            fireImg.src = 'assets/fire.png';
            fireImg.className = 'fire-image';
            
            // Add random delays and variations for more organic movement (slower)
            const randomDelay = Math.random() * 2.0; // 0 to 2.0 seconds
            const randomDuration = 1.0 + Math.random() * 1.0; // 1.0 to 2.0 seconds
            
            fireImg.style.animationDelay = `${randomDelay}s`;
            fireImg.style.animationDuration = `${randomDuration}s`;
            
            this.fireContainer.appendChild(fireImg);
            
            // Handle fallback
            fireImg.onerror = () => {
                fireImg.style.background = 'linear-gradient(to top, #ff4444, #ff8800, #ffff00)';
                fireImg.style.width = '60px';
                fireImg.style.height = '60px';
                fireImg.src = '';
            };
        }
    }

    _updatePoseVisuals(poseIndex, landmarks, videoParams, canvasWidth, canvasHeight) {
        const pose = this.poses[poseIndex];
        const lineGroup = pose.lineGroup;
        
        // Clear previous visuals
        while (lineGroup.children.length) {
            const child = lineGroup.children[0];
            lineGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        if (!landmarks?.length || !videoParams) {
            lineGroup.visible = false;
            return;
        }

        // Convert landmarks to 3D positions
        const points3D = landmarks.map(lm => {
            const lmOriginalX = lm.x * videoParams.videoNaturalWidth;
            const lmOriginalY = lm.y * videoParams.videoNaturalHeight;
            const normX_visible = Math.max(0, Math.min(1, (lmOriginalX - videoParams.offsetX) / videoParams.visibleWidth));
            const normY_visible = Math.max(0, Math.min(1, (lmOriginalY - videoParams.offsetY) / videoParams.visibleHeight));
            const x = (1 - normX_visible) * canvasWidth - canvasWidth / 2;
            const y = (1 - normY_visible) * canvasHeight - canvasHeight / 2;
            const isVisible = lm.visibility > 0.3;
            return new THREE.Vector3(x, y, isVisible ? 1.1 : -10000);
        });

        const lineZ = 1.0;
        const circleRadius = 8;

        // Draw connection lines
        this.poseConnections.forEach(conn => {
            if (conn[0] >= points3D.length || conn[1] >= points3D.length) return;
            const [p1, p2] = [points3D[conn[0]], points3D[conn[1]]];
            if (p1?.z > -1000 && p2?.z > -1000) {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    p1.clone().setZ(lineZ), p2.clone().setZ(lineZ)
                ]);
                lineGroup.add(new THREE.Line(geometry, this.poseLineMaterial));
            }
        });

        // Draw circles on keypoints with special highlighting for head, elbows, and wrists
        this.poseKeypointIndices.forEach(kpIndex => {
            if (kpIndex >= points3D.length) return;
            const landmarkPosition = points3D[kpIndex];
            if (landmarkPosition?.z > -1000) {
                let material = this.circleMaterial;
                let radius = circleRadius;
                
                // Highlight nose (head), elbows (start), and wrists (completion)
                if (kpIndex === 0) { // nose
                    material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red for head
                    radius = circleRadius * 1.0;
                } else if (kpIndex === 13 || kpIndex === 14) { // elbows
                    material = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow for elbows (start)
                    radius = circleRadius * 1.0;
                } else if (kpIndex === 15 || kpIndex === 16) { // wrists
                    material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green for wrists (completion)
                    radius = circleRadius * 1.0;
                }
                
                const circleGeometry = new THREE.CircleGeometry(radius, 16);
                const circle = new THREE.Mesh(circleGeometry, material);
                circle.position.copy(landmarkPosition);
                circle.position.z = lineZ + 0.1;
                lineGroup.add(circle);
            }
        });

        lineGroup.visible = true;
    }

    _updateSavedCats() {
        const currentTime = Date.now();
        
        this.savedCats.forEach(savedCat => {
            if (savedCat.isMoving) {
                const elapsed = currentTime - savedCat.startTime;
                const progress = Math.min(elapsed / savedCat.animationDuration, 1);
                
                // Eased movement (ease-out) with slight arc
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                
                const sprite = savedCat.sprite;
                const start = savedCat.startPosition;
                const target = savedCat.targetPosition;
                
                // Interpolate position with upward arc
                sprite.position.x = start.x + (target.x - start.x) * easedProgress;
                sprite.position.z = start.z + (target.z - start.z) * easedProgress;
                
                // Add upward arc to the movement
                const arcHeight = 80; // Height of the arc for save animation
                const yLinear = start.y + (target.y - start.y) * easedProgress;
                const arcOffset = Math.sin(easedProgress * Math.PI) * arcHeight;
                sprite.position.y = yLinear + arcOffset;
                
                // Scale down during drift to saved position
                const startScale = this.catScale;
                const endScale = this.savedCatScale;
                const currentScale = startScale + (endScale - startScale) * easedProgress;
                sprite.scale.set(currentScale, currentScale, 1);
                
                // Mark as finished when animation complete
                if (progress >= 1) {
                    savedCat.isMoving = false;
                    savedCat.sprite.position.copy(savedCat.targetPosition);
                    savedCat.sprite.scale.set(this.savedCatScale, this.savedCatScale, 1);
                }
            }
        });
    }

    _updateDriftingCat() {
        if (!this.driftingCat) return;
        
        const currentTime = Date.now();
        const elapsed = currentTime - this.driftStartTime;
        const progress = Math.min(elapsed / this.driftDuration, 1);
        
        // Eased movement (ease-out for smooth arrival)
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        // Interpolate position with slight arc (add some upward curve)
        const sprite = this.driftingCat.sprite;
        const start = this.driftingCat.startPosition;
        const target = this.driftingCat.targetPosition;
        
        // Linear interpolation with arc
        sprite.position.x = start.x + (target.x - start.x) * easedProgress;
        sprite.position.z = start.z + (target.z - start.z) * easedProgress;
        
        // Add slight upward arc to the movement
        const arcHeight = 100; // Height of the arc
        const yLinear = start.y + (target.y - start.y) * easedProgress;
        const arcOffset = Math.sin(easedProgress * Math.PI) * arcHeight;
        sprite.position.y = yLinear + arcOffset;
        
        // Scale up during drift
        const startScale = this.wanderingCatScale;
        const endScale = this.catScale;
        const currentScale = startScale + (endScale - startScale) * easedProgress;
        sprite.scale.set(currentScale, currentScale, 1);
        
        // Animation complete
        if (progress >= 1) {
            // Cat has reached the head - make it the current cat
            this.currentCat = sprite;
            this.currentCatData = this.driftingCat.wanderingCatData;
            
            // Clear drifting cat
            this.driftingCat = null;
            
            console.log('Cat drift to head completed');
        }
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        if (this.gameState === 'tracking') {
            this._updatePose();
            this._updateDriftingCat(); // Add this line
            this._updateSavedCats(); // Enable this line (was commented out)
        }
        
        // Always update wandering cats (even when not tracking)
        this._updateWanderingCats();
        
        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.renderDiv.addEventListener('click', () => {
            this.audioManager.resumeContext();
            if (['error', 'paused'].includes(this.gameState)) {
                this._restartGame();
            }
        });
    }
}