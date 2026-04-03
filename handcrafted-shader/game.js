import * as THREE from 'three';
import { HandLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';
import { AudioManager } from './audioManager.js';
import { SpeechManager } from './SpeechManager.js';

export class Game {
    constructor(renderDiv) {
        this.renderDiv = renderDiv;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.videoElement = null;
        this.speechBubble = null;
        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.hands = []; // Stores data about detected hands (landmarks, anchor position, line group)
        this.handLineMaterial = null; // Material for hand lines
        this.fingertipMaterialHand1 = null; // Material for first hand's fingertip circles (blue)
        this.fingertipMaterialHand2 = null; // Material for second hand's fingertip circles (green)
        this.fingertipLandmarkIndices = [0, 4, 8, 12, 16, 20]; // WRIST + TIP landmarks
        this.handConnections = null; // Landmark connection definitions
        this.clock = new THREE.Clock();
        this.audioManager = new AudioManager();
        this.lastLandmarkPositions = [[], []]; // Store last known smoothed positions for each hand's landmarks
        this.smoothingFactor = 0.4; // Alpha for exponential smoothing (0 < alpha <= 1). Smaller = more smoothing.
        this.speechManager = null;
        this.speechBubbleTimeout = null;
        
        // Shader plane properties
        this.shaderPlane = null;
        this.shaderMaterial = null;
        this.basePlaneSize = 0; // Will be set during initialization
        this.currentPlaneScale = 1.0; // Current scale multiplier
        
        // Hand interaction properties
        this.isPinching = [false, false]; // Track pinch state for each hand
        this.pinchThreshold = 0.05; // Distance threshold for pinch detection
        this.bothHandsPinching = false;
        this.initialPinchDistance = 0; // Distance between hands when pinch starts
        this.initialPlaneScale = 1.0; // Scale when pinch starts
        this.minPlaneScale = 0.2; // Minimum allowed scale
        this.maxPlaneScale = 4.0; // Maximum allowed scale
        
        // Fist gesture and parameter control
        this.isFist = [false, false]; // Track fist state for each hand
        this.fistThreshold = 0.5; // Reduced threshold for easier fist detection
        this.handVerticalPositions = [0, 0]; // Track Y positions for each hand
        this.baseHandPositions = [0, 0]; // Reference positions when fist starts
        this.isControllingFreq = false; // Hand 0 controls frequency
        this.isControllingAmplitude = false; // Hand 1 controls wave amplitude
        
        // Shader parameter ranges
        this.freqOscillationRange = 2.0; // Default oscillation range
        this.waveAmplitude = 1.0; // Default wave amplitude multiplier
        this.controlSensitivity = 0.001; // Reduced sensitivity for larger movement range
        
        // Text label properties
        this.textLabels = [null, null]; // Store text meshes for each hand
        this.labelBackgrounds = [null, null]; // Store background planes for each hand
        this.textCanvas = null;
        this.textContext = null;
        this.textTexture = null;
        
        // Voice color control properties
        this.colorModes = ['Blue', 'Red', 'Yellow', 'Black'];
        this.currentColorMode = 'Blue'; // Default
        this.colorUI = null;
        this.lastColorChangeTime = 0;
        this.colorChangeDebounce = 1000; // 1 second between color changes
        
        // Color palettes for each mode
        this.colorPalettes = {
            'Blue': {
                darkColor: [0.02, 0.05, 0.5],
                brightColor: [0.9, 0.95, 1.0],
                accentColor: [1.0, 0.5, 1.0],
                energyColor: [0.1, 0.9, 1.0]
            },
            'Red': {
                darkColor: [0.5, 0.02, 0.02],
                brightColor: [1.0, 0.9, 0.9],
                accentColor: [1.0, 0.3, 0.1],
                energyColor: [1.0, 0.1, 0.3]
            },
            'Yellow': {
                darkColor: [0.2, 0.5, 0.6],
                brightColor: [1.0, 1.0, 0.9],
                accentColor: [1.0, 0.8, 0.0],
                energyColor: [1.0, 0.9, 0.1]
            },
            'Black': {
                darkColor: [0.02, 0.02, 0.02],
                brightColor: [0.9, 0.9, 0.9],
                accentColor: [0.6, 0.6, 0.6],
                energyColor: [0.8, 0.8, 0.8]
            }
        };
        
        // Initialize asynchronously
        this._init().catch(error => {
            console.error("Initialization failed:", error);
        });
    }
    
    async _init() {
        this._setupDOM();
        this._setupThree();
        this._setupShaderPlane();
        this._setupTextLabels();
        this._setupColorUI();
        this._setupSpeechRecognition();
        await this._setupHandTracking();
        
        // Initialize with default colors
        this._updateShaderColors(this.currentColorMode);
        
        // Ensure webcam is playing before starting
        await this.videoElement.play();
        
        window.addEventListener('resize', this._onResize.bind(this));
        
        // Start speech recognition immediately
        this.speechManager.requestPermissionAndStart();
        
        this.clock.start();
        // Start animation loop after everything is initialized
        this._animate();
    }
    
    _setupDOM() {
        // Get references to existing DOM elements
        this.videoElement = document.getElementById('webcam-video');
        this.speechBubble = document.getElementById('speech-bubble');
        
        if (!this.videoElement || !this.speechBubble) {
            console.error('Required DOM elements not found');
            return;
        }
    }
    
    _setupThree() {
        const width = this.renderDiv.clientWidth;
        const height = this.renderDiv.clientHeight;
        this.scene = new THREE.Scene();
        
        // Using OrthographicCamera for a 2D-like overlay effect
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);
        this.camera.position.z = 100;
        
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderDiv.appendChild(this.renderer.domElement);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
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
                lineGroup: lineGroup
            });
        }
        
        this.handLineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ccff,
            linewidth: 8
        });
        this.fingertipMaterialHand1 = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        }); // White (default)
        this.fingertipMaterialHand2 = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        }); // White (default)
        
        // Define connections for MediaPipe hand landmarks
        this.handConnections = [
            // Thumb
            [0,1], [1,2], [2,3], [3,4],
            // Index finger
            [0,5], [5,6], [6,7], [7,8],
            // Middle finger
            [0,9], [9,10], [10,11], [11,12],
            // Ring finger
            [0,13], [13,14], [14,15], [15,16],
            // Pinky
            [0,17], [17,18], [18,19], [19,20],
            // Palm
            [5,9], [9,13], [13,17]
        ];
    }
    
    _setupTextLabels() {
        // Create canvas and context for text rendering - made much larger
        this.textCanvas = document.createElement('canvas');
        this.textCanvas.width = 512;
        this.textCanvas.height = 128;
        this.textContext = this.textCanvas.getContext('2d');
        
        // Create texture from canvas
        this.textTexture = new THREE.CanvasTexture(this.textCanvas);
        this.textTexture.minFilter = THREE.LinearFilter;
        this.textTexture.magFilter = THREE.LinearFilter;
        
        // Create text labels and backgrounds for each hand
        for (let i = 0; i < 2; i++) {
            // Create background plane with different colors for each hand
            const backgroundGeometry = new THREE.PlaneGeometry(160, 48);
            const backgroundColor = i === 0 ? 0xff0000 : 0x0066ff; // Red for hand 0, blue for hand 1
            const backgroundMaterial = new THREE.MeshBasicMaterial({
                color: backgroundColor,
                transparent: true,
                opacity: 0.8
            });
            const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
            backgroundMesh.visible = false;
            this.scene.add(backgroundMesh);
            this.labelBackgrounds[i] = backgroundMesh;
            
            // Create text mesh - made much larger
            const textGeometry = new THREE.PlaneGeometry(152, 40);
            const textMaterial = new THREE.MeshBasicMaterial({
                map: this.textTexture,
                transparent: true,
                alphaTest: 0.1
            });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.visible = false;
            textMesh.position.z = 0.1; // Slightly in front of background
            this.scene.add(textMesh);
            this.textLabels[i] = textMesh;
        }
    }
    
    _setupColorUI() {
        // Create color indicator container
        this.colorUI = document.createElement('div');
        this.colorUI.id = 'color-controls';
        this.colorUI.innerHTML = `
            ${this.colorModes.map(color => 
                `<div class="color-option ${color === this.currentColorMode ? 'active' : ''}" 
                     data-color="${color}">${color}</div>`
            ).join('')}
        `;
        
        // Add to the render div
        this.renderDiv.appendChild(this.colorUI);
    }
    
    _updateTextLabel(handIndex, labelText, value) {
        if (!this.textContext || !this.textTexture) return;
        
        // Clear canvas
        this.textContext.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
        
        // Set text properties - doubled font size to 64px
        this.textContext.font = 'bold 64px Arial';
        this.textContext.fillStyle = 'white';
        this.textContext.textAlign = 'center';
        this.textContext.textBaseline = 'middle';
        
        // Draw text
        const displayText = `${labelText}: ${value.toFixed(2)}`;
        this.textContext.fillText(displayText, this.textCanvas.width / 2, this.textCanvas.height / 2);
        
        // Update texture
        this.textTexture.needsUpdate = true;
        
        // Position label at wrist (landmark 0 - WRIST)
        if (this.hands[handIndex].landmarks) {
            const wristLandmark = this.hands[handIndex].landmarks[0];
            const width = this.renderDiv.clientWidth;
            const height = this.renderDiv.clientHeight;
            
            const wristX = (1 - wristLandmark.x) * width - width / 2;
            const wristY = (1 - wristLandmark.y) * height - height / 2;
            
            // Offset label slightly below wrist
            const labelX = wristX;
            const labelY = wristY + 60; // Lower position
            
            // Update background position
            this.labelBackgrounds[handIndex].position.set(labelX, labelY, 5);
            this.labelBackgrounds[handIndex].visible = true;
            
            // Update text position
            this.textLabels[handIndex].position.set(labelX, labelY, 5.1);
            this.textLabels[handIndex].visible = true;
        }
    }
    
    _hideTextLabel(handIndex) {
        if (this.textLabels[handIndex]) {
            this.textLabels[handIndex].visible = false;
        }
        if (this.labelBackgrounds[handIndex]) {
            this.labelBackgrounds[handIndex].visible = false;
        }
    }
    
    _setupShaderPlane() {
        const width = this.renderDiv.clientWidth;
        const height = this.renderDiv.clientHeight;
        
        // Calculate base plane size (roughly half the screen)
        this.basePlaneSize = Math.min(width, height) * 0.5;
        
        // Create plane geometry
        const geometry = new THREE.PlaneGeometry(this.basePlaneSize, this.basePlaneSize, 64, 64);
        
        // Create custom shader material with dynamic color uniforms
        this.shaderMaterial = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            uniforms: {
                uTime: { value: 0.0 },
                uResolution: { value: new THREE.Vector2(this.basePlaneSize, this.basePlaneSize) },
                uOpacity: { value: 0.85 },
                uFreqRange: { value: 2.0 },
                uAmplitude: { value: 1.0 },
                uDarkColor: { value: new THREE.Vector3() },
                uBrightColor: { value: new THREE.Vector3() },
                uAccentColor: { value: new THREE.Vector3() },
                uEnergyColor: { value: new THREE.Vector3() }
            },
            vertexShader: `
                uniform float uTime;
                uniform vec2 uResolution;
                uniform float uAmplitude;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    
                    // Subtle surface deformation like liquid responding to vibration
                    vec3 pos = position;
                    float wave1 = sin(pos.x * 0.02 + uTime * 1.5) * 3.0 * uAmplitude;
                    float wave2 = cos(pos.y * 0.02 + uTime * 1.8) * 2.0 * uAmplitude;
                    float wave3 = sin((pos.x + pos.y) * 0.015 + uTime * 1.2) * 2.5 * uAmplitude;
                    
                    pos.z += wave1 + wave2 + wave3;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec2 uResolution;
                uniform float uOpacity;
                uniform float uFreqRange;
                uniform float uAmplitude;
                uniform vec3 uDarkColor;
                uniform vec3 uBrightColor;
                uniform vec3 uAccentColor;
                uniform vec3 uEnergyColor;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                #define PI 3.14159265359
                
                // Smooth noise function for fluid motion
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }
                
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0,0.0)), 
                                   hash(i + vec2(1.0,0.0)), u.x),
                               mix(hash(i + vec2(0.0,1.0)), 
                                   hash(i + vec2(1.0,1.0)), u.x), u.y);
                }
                
                // Generate Chladni-like standing wave patterns with enhanced contrast
                float chladniPattern(vec2 uv, float time) {
                    vec2 center = vec2(0.5);
                    vec2 pos = (uv - center) * 2.0; // Scale to -1 to 1
                    
                    // Multiple frequency modes creating interference patterns
                    float freq1 = 8.0 + sin(time * 0.3) * uFreqRange;
                    float freq2 = 12.0 + cos(time * 0.4) * (uFreqRange * 1.5);
                    float freq3 = 16.0 + sin(time * 0.2) * (uFreqRange * 1.25);
                    
                    // Phase shifts for dynamic motion
                    float phase1 = time * 0.8;
                    float phase2 = time * 1.2;
                    float phase3 = time * 0.6;
                    
                    // Standing wave patterns with enhanced amplitude
                    float waveX1 = sin(pos.x * freq1 + phase1) * cos(pos.y * freq1 * 0.7 + phase1);
                    float waveY1 = cos(pos.x * freq1 * 0.7 + phase1) * sin(pos.y * freq1 + phase1);
                    
                    float waveX2 = sin(pos.x * freq2 + phase2) * cos(pos.y * freq2 * 0.8 + phase2);
                    float waveY2 = cos(pos.x * freq2 * 0.8 + phase2) * sin(pos.y * freq2 + phase2);
                    
                    float waveX3 = sin(pos.x * freq3 + phase3) * cos(pos.y * freq3 * 0.9 + phase3);
                    float waveY3 = cos(pos.x * freq3 * 0.9 + phase3) * sin(pos.y * freq3 + phase3);
                    
                    // Combine waves with different weights - increased primary wave strength
                    float pattern1 = (waveX1 + waveY1) * 0.7;
                    float pattern2 = (waveX2 + waveY2) * 0.2;
                    float pattern3 = (waveX3 + waveY3) * 0.1;
                    
                    return pattern1 + pattern2 + pattern3;
                }
                
                // Create sharp nodal lines with enhanced contrast
                float createNodalLines(float pattern, float threshold) {
                    // Much sharper transitions for higher contrast
                    float sharpness = 5.0;
                    float lines = 1.0 / (1.0 + exp(sharpness * abs(pattern) - sharpness * threshold));
                    return lines;
                }
                
                // Contrast enhancement function
                float enhanceContrast(float value, float contrast) {
                    return clamp(((value - 0.5) * contrast) + 0.5, 0.0, 1.0);
                }
                
                // Smooth step with custom falloff
                float smootherstep(float edge0, float edge1, float x) {
                    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
                    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
                }
                
                void main() {
                    vec2 st = vUv;
                    float time = uTime * 0.7;
                    
                    // Generate base Chladni pattern
                    float chladni = chladniPattern(st, time);
                    
                    // Create ultra-sharp nodal lines
                    float nodalThickness = 0.08 + sin(time * 0.5) * 0.005;
                    float nodalLines = createNodalLines(chladni, nodalThickness);
                    
                    // Enhanced contrast on nodal lines
                    nodalLines = enhanceContrast(nodalLines, 3.0);
                    
                    // Create high-contrast density areas
                    float density = abs(chladni) * 2.5;
                    density = smootherstep(0.1, 0.9, density);
                    density = enhanceContrast(density, 2.5);
                    
                    // Binary-like pattern for maximum contrast
                    float binaryPattern = step(0.5, nodalLines + density * 0.3);
                    
                    // Add sharp shimmer effect only at edges
                    float edgeDetection = abs(dFdx(binaryPattern)) + abs(dFdy(binaryPattern));
                    float shimmer = noise(st * 40.0 + time * 3.0) * edgeDetection * 0.3;
                    
                    // Combine for final pattern with extreme contrast
                    float finalPattern = binaryPattern + shimmer;
                    finalPattern = clamp(finalPattern, 0.0, 1.0);
                    
                    // Use dynamic colors from uniforms instead of hardcoded values
                    vec3 darkColor = uDarkColor;
                    vec3 brightColor = uBrightColor;
                    vec3 accentColor = uAccentColor;
                    vec3 energyColor = uEnergyColor;
                    
                    // Sharp color transitions based on pattern intensity
                    vec3 baseColor;
                    if (finalPattern < 0.3) {
                        baseColor = darkColor;
                    } else if (finalPattern < 0.7) {
                        // Sharp transition zone with energy color
                        float mixFactor = smoothstep(0.3, 0.7, finalPattern);
                        baseColor = mix(energyColor, brightColor, mixFactor);
                    } else {
                        // Bright zones with accent highlights
                        float accentMix = (finalPattern - 0.7) / 0.3;
                        baseColor = mix(brightColor, accentColor, accentMix * 0.6);
                    }
                    
                    // Add pulsing energy at nodal lines
                    float pulse = sin(time * 1.0) * 0.6 + 0.4;
                    float energyBoost = nodalLines * pulse * 5.0;
                    baseColor += energyColor * energyBoost;
                    
                    // Dynamic opacity with higher base value
                    float dynamicOpacity = uOpacity * (0.7 + finalPattern * 0.3);
                    
                    gl_FragColor = vec4(baseColor, dynamicOpacity);
                }
            `
        });
        
        // Create the plane mesh
        this.shaderPlane = new THREE.Mesh(geometry, this.shaderMaterial);
        this.shaderPlane.position.set(0, 0, 10); // Position in front of hand tracking
        this.scene.add(this.shaderPlane);
    }
    
    _updateShaderColors(colorMode) {
        if (!this.shaderMaterial || !this.colorPalettes[colorMode]) return;
        
        const palette = this.colorPalettes[colorMode];
        
        // Update the color values
        this.shaderMaterial.uniforms.uDarkColor.value.fromArray(palette.darkColor);
        this.shaderMaterial.uniforms.uBrightColor.value.fromArray(palette.brightColor);
        this.shaderMaterial.uniforms.uAccentColor.value.fromArray(palette.accentColor);
        this.shaderMaterial.uniforms.uEnergyColor.value.fromArray(palette.energyColor);
    }
    
    _handleColorCommand(transcript) {
        const currentTime = Date.now();
        
        // Debounce color changes to prevent rapid switching
        if (currentTime - this.lastColorChangeTime < this.colorChangeDebounce) {
            return;
        }
        
        // Check if transcript contains any color words
        const lowerTranscript = transcript.toLowerCase();
        
        for (const color of this.colorModes) {
            if (lowerTranscript.includes(color.toLowerCase())) {
                if (color !== this.currentColorMode) {
                    this.currentColorMode = color;
                    this.lastColorChangeTime = currentTime;
                    
                    // Update shader colors
                    this._updateShaderColors(color);
                    
                    // Update UI
                    this._updateColorUI();
                    
                    console.log(`Color changed to: ${color}`);
                    break;
                }
            }
        }
    }
    
    _updateColorUI() {
        if (!this.colorUI) return;
        
        const colorOptions = this.colorUI.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            const color = option.getAttribute('data-color');
            if (color === this.currentColorMode) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
    
    async _setupHandTracking() {
        try {
            console.log("Setting up Hand Tracking...");
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
            
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: 'GPU'
                },
                numHands: 2,
                runningMode: 'VIDEO'
            });
            console.log("HandLandmarker created.");
            
            console.log("Requesting webcam access...");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            
            this.videoElement.srcObject = stream;
            console.log("Webcam stream obtained.");
            
            return new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => {
                    console.log("Webcam metadata loaded.");
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error setting up Hand Tracking or Webcam:', error);
            throw error;
        }
    }
    
    _updateHands() {
        if (!this.handLandmarker || !this.videoElement.srcObject || this.videoElement.readyState < 2) return;
        
        const videoTime = this.videoElement.currentTime;
        if (videoTime > this.lastVideoTime) {
            this.lastVideoTime = videoTime;
            try {
                const results = this.handLandmarker.detectForVideo(this.videoElement, performance.now());
                const width = this.renderDiv.clientWidth;
                const height = this.renderDiv.clientHeight;
                
                for (let i = 0; i < this.hands.length; i++) {
                    const hand = this.hands[i];
                    
                    if (results.landmarks && results.landmarks[i]) {
                        const currentRawLandmarks = results.landmarks[i];
                        
                        // Initialize lastLandmarkPositions if it's empty or size mismatches
                        if (!this.lastLandmarkPositions[i] || this.lastLandmarkPositions[i].length !== currentRawLandmarks.length) {
                            this.lastLandmarkPositions[i] = currentRawLandmarks.map(lm => ({
                                x: lm.x, y: lm.y, z: lm.z
                            }));
                        }
                        
                        const smoothedLandmarks = currentRawLandmarks.map((lm, lmIndex) => {
                            const prevLm = this.lastLandmarkPositions[i][lmIndex];
                            const smoothedLm = {
                                x: this.smoothingFactor * lm.x + (1 - this.smoothingFactor) * prevLm.x,
                                y: this.smoothingFactor * lm.y + (1 - this.smoothingFactor) * prevLm.y,
                                z: this.smoothingFactor * lm.z + (1 - this.smoothingFactor) * prevLm.z
                            };
                            
                            // Update the stored last position with the new smoothed position
                            this.lastLandmarkPositions[i][lmIndex] = { ...smoothedLm };
                            return smoothedLm;
                        });
                        
                        hand.landmarks = smoothedLandmarks;
                        const palm = smoothedLandmarks[9]; // Use smoothed MIDDLE_FINGER_MCP for anchor
                        const handX = (1 - palm.x) * width - width / 2;
                        const handY = (1 - palm.y) * height - height / 2;
                        hand.anchorPos.set(handX, handY, 1);
                        
                        // Check for pinch gesture
                        this._checkPinchGesture(i, smoothedLandmarks);
                        
                        // Check for fist gesture
                        this._checkFistGesture(i, smoothedLandmarks);
                        
                        this._updateHandLines(i, smoothedLandmarks, width, height);
                        hand.lineGroup.visible = true;
                        
                        // Update text labels based on fist state and control parameters
                        if (this.isFist[i]) {
                            if (i === 0) {
                                this._updateTextLabel(0, "FREQ", this.freqOscillationRange);
                            } else if (i === 1) {
                                this._updateTextLabel(1, "AMP", this.waveAmplitude);
                            }
                        } else {
                            this._hideTextLabel(i);
                        }
                        
                    } else {
                        hand.landmarks = null;
                        this.isPinching[i] = false; // Reset pinch state if hand not detected
                        this.isFist[i] = false; // Reset fist state if hand not detected
                        if (hand.lineGroup) hand.lineGroup.visible = false;
                        this._hideTextLabel(i); // Hide label when hand not detected
                    }
                }
                
                // Update plane scale based on pinch interaction
                this._updatePinchInteraction();
                
                // Update shader parameters based on fist gestures
                this._updateFistInteraction();
                
            } catch (error) {
                console.error("Error during hand detection:", error);
            }
        }
    }
    
    _onResize() {
        const width = this.renderDiv.clientWidth;
        const height = this.renderDiv.clientHeight;
        
        // Update camera perspective
        this.camera.left = width / -2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = height / -2;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(width, height);
        
        // Update shader plane size
        if (this.shaderPlane && this.shaderMaterial) {
            const newBasePlaneSize = Math.min(width, height) * 0.5;
            this.basePlaneSize = newBasePlaneSize;
            this.shaderMaterial.uniforms.uResolution.value.set(newBasePlaneSize, newBasePlaneSize);
            // Apply current scale
            this.shaderPlane.scale.set(this.currentPlaneScale, this.currentPlaneScale, 1);
        }
    }
    
    _updateHandLines(handIndex, landmarks, screenWidth, screenHeight) {
        const hand = this.hands[handIndex];
        const lineGroup = hand.lineGroup;
        
        // Clear previous lines
        while (lineGroup.children.length) {
            const line = lineGroup.children[0];
            lineGroup.remove(line);
            if (line.geometry) line.geometry.dispose();
        }
        
        if (!landmarks || landmarks.length === 0) {
            lineGroup.visible = false;
            return;
        }
        
        const points3D = landmarks.map(lm => {
            const x = (1 - lm.x) * screenWidth - screenWidth / 2;
            const y = (1 - lm.y) * screenHeight - screenHeight / 2;
            return new THREE.Vector3(x, y, 1.1);
        });
        
        // Draw connecting lines
        const lineZ = 1;
        this.handConnections.forEach(conn => {
            const p1 = points3D[conn[0]].clone().setZ(lineZ);
            const p2 = points3D[conn[1]].clone().setZ(lineZ);
            if (p1 && p2) {
                const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
                const line = new THREE.Line(geometry, this.handLineMaterial);
                lineGroup.add(line);
            }
        });
        
        // Update material color based on fist gesture state
        const material = handIndex === 0 ? this.fingertipMaterialHand1 : this.fingertipMaterialHand2;
        if (this.isFist[handIndex]) {
            if (handIndex === 0) {
                material.color.setHex(0xff0000); // Red when hand 0 fist is active
            } else {
                material.color.setHex(0x0000ff); // Blue when hand 1 fist is active
            }
        } else {
            material.color.setHex(0xffffff); // White when no fist
        }
        
        // Draw fingertip circles
        const fingertipRadius = 8;
        const wristRadius = 12;
        const circleSegments = 16;
        
        this.fingertipLandmarkIndices.forEach(index => {
            const landmarkPosition = points3D[index];
            if (landmarkPosition) {
                const radius = index === 0 ? wristRadius : fingertipRadius;
                const circleGeometry = new THREE.CircleGeometry(radius, circleSegments);
                const landmarkCircle = new THREE.Mesh(circleGeometry, material);
                landmarkCircle.position.copy(landmarkPosition);
                lineGroup.add(landmarkCircle);
            }
        });
        
        lineGroup.visible = true;
    }
    
    _checkPinchGesture(handIndex, landmarks) {
        if (!landmarks || landmarks.length < 21) return;
        
        // Get thumb tip (landmark 4) and index finger tip (landmark 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // Calculate distance between thumb and index finger tips
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const dz = thumbTip.z - indexTip.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Update pinch state based on distance threshold
        this.isPinching[handIndex] = distance < this.pinchThreshold;
    }
    
    _updatePinchInteraction() {
        const bothHandsPinchingNow = this.isPinching[0] && this.isPinching[1];
        
        // Check if both hands just started pinching
        if (bothHandsPinchingNow && !this.bothHandsPinching) {
            this.bothHandsPinching = true;
            this.initialPlaneScale = this.currentPlaneScale;
            
            // Calculate initial distance between hands
            if (this.hands[0].landmarks && this.hands[1].landmarks) {
                const hand1Center = this.hands[0].anchorPos;
                const hand2Center = this.hands[1].anchorPos;
                this.initialPinchDistance = hand1Center.distanceTo(hand2Center);
            }
            
            console.log("Both hands pinching - plane resize mode activated");
        }
        // Check if pinch was released
        else if (!bothHandsPinchingNow && this.bothHandsPinching) {
            this.bothHandsPinching = false;
            console.log("Pinch released - plane size locked at scale:", this.currentPlaneScale);
        }
        
        // Update plane scale while both hands are pinching
        if (this.bothHandsPinching && this.hands[0].landmarks && this.hands[1].landmarks) {
            const hand1Center = this.hands[0].anchorPos;
            const hand2Center = this.hands[1].anchorPos;
            const currentDistance = hand1Center.distanceTo(hand2Center);
            
            if (this.initialPinchDistance > 0) {
                // Calculate scale based on distance ratio
                const distanceRatio = currentDistance / this.initialPinchDistance;
                const newScale = this.initialPlaneScale * distanceRatio;
                
                // Clamp to min/max scale
                this.currentPlaneScale = Math.max(this.minPlaneScale, 
                                                 Math.min(this.maxPlaneScale, newScale));
                
                // Apply scale to the plane
                if (this.shaderPlane) {
                    this.shaderPlane.scale.set(this.currentPlaneScale, this.currentPlaneScale, 1);
                }
            }
        }
    }
    
    _checkFistGesture(handIndex, landmarks) {
        if (!landmarks || landmarks.length < 21) return;
        
        // Check if fingers are curled (fist gesture) - made more lenient
        // Compare fingertip positions to their respective MCP joints
        const fingerTips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky tips
        const fingerMCPs = [5, 9, 13, 17]; // Index, Middle, Ring, Pinky MCPs
        
        let curledFingers = 0;
        
        for (let i = 0; i < fingerTips.length; i++) {
            const tipY = landmarks[fingerTips[i]].y;
            const mcpY = landmarks[fingerMCPs[i]].y;
            
            // If fingertip is below (higher Y value) than MCP, finger is curled
            if (tipY > mcpY) {
                curledFingers++;
            }
        }
        
        // Check thumb separately (different anatomy) - made more lenient
        const thumbTip = landmarks[4];
        const thumbMCP = landmarks[2];
        const thumbDistance = Math.sqrt(
            Math.pow(thumbTip.x - thumbMCP.x, 2) + 
            Math.pow(thumbTip.y - thumbMCP.y, 2)
        );
        
        this.isFist[handIndex] = (curledFingers >= 3);
        
        // Store vertical position for parameter control
        if (this.isFist[handIndex]) {
            // Use palm center (landmark 9) for vertical position
            this.handVerticalPositions[handIndex] = landmarks[9].y;
        }
    }
    
    _updateFistInteraction() {
        // Hand 0 (left/first detected) controls frequency oscillation range
        if (this.isFist[0] && !this.isControllingFreq) {
            this.isControllingFreq = true;
            this.baseHandPositions[0] = this.handVerticalPositions[0];
            console.log("Hand 0 fist detected - controlling frequency oscillation range");
        } else if (!this.isFist[0] && this.isControllingFreq) {
            this.isControllingFreq = false;
            console.log("Hand 0 fist released - frequency control locked at:", this.freqOscillationRange);
        }
        
        // Hand 1 (right/second detected) controls wave amplitude
        if (this.isFist[1] && !this.isControllingAmplitude) {
            this.isControllingAmplitude = true;
            this.baseHandPositions[1] = this.handVerticalPositions[1];
            console.log("Hand 1 fist detected - controlling wave amplitude");
        } else if (!this.isFist[1] && this.isControllingAmplitude) {
            this.isControllingAmplitude = false;
            console.log("Hand 1 fist released - amplitude control locked at:", this.waveAmplitude);
        }
        
        // Update frequency oscillation range (Hand 0) - no min/max limits
        if (this.isControllingFreq) {
            const deltaY = this.handVerticalPositions[0] - this.baseHandPositions[0];
            // Negative deltaY = hand moved up = increase value
            // Positive deltaY = hand moved down = decrease value
            const freqChange = -deltaY / this.controlSensitivity;
            this.freqOscillationRange += freqChange * 0.05;
            this.baseHandPositions[0] = this.handVerticalPositions[0]; // Update base for smooth control
        }
        
        // Update wave amplitude (Hand 1) - no min/max limits
        if (this.isControllingAmplitude) {
            const deltaY = this.handVerticalPositions[1] - this.baseHandPositions[1];
            // Negative deltaY = hand moved up = increase value
            // Positive deltaY = hand moved down = decrease value
            const amplitudeChange = -deltaY / this.controlSensitivity;
            this.waveAmplitude += amplitudeChange * 0.1;
            this.baseHandPositions[1] = this.handVerticalPositions[1]; // Update base for smooth control
        }
    }
    
    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        
        const elapsedTime = this.clock.getElapsedTime();
        
        // Update shader uniforms with wave amplitude
        if (this.shaderMaterial && this.shaderMaterial.uniforms) {
            this.shaderMaterial.uniforms.uTime.value = elapsedTime;
            this.shaderMaterial.uniforms.uFreqRange.value = this.freqOscillationRange;
            this.shaderMaterial.uniforms.uAmplitude.value = this.waveAmplitude;
        }
        
        // Update hands continuously
        this._updateHands();
        
        // Always render the scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    start() {
        console.log('Hand tracking initialized and running...');
    }
    
    _setupSpeechRecognition() {
        this.speechManager = new SpeechManager((finalTranscript, interimTranscript) => {
            if (this.speechBubble) {
                clearTimeout(this.speechBubbleTimeout);
                
                if (finalTranscript) {
                    this.speechBubble.innerHTML = finalTranscript;
                    this.speechBubble.classList.add('speech-bubble-active');
                    this.speechBubble.classList.remove('speech-bubble-interim');
                    
                    // Handle color commands
                    this._handleColorCommand(finalTranscript);
                    
                    this.speechBubbleTimeout = setTimeout(() => {
                        this.speechBubble.innerHTML = "...";
                        this.speechBubble.classList.remove('speech-bubble-active');
                    }, 2000);
                } else if (interimTranscript) {
                    this.speechBubble.innerHTML = interimTranscript;
                    this.speechBubble.classList.add('speech-bubble-active', 'speech-bubble-interim');
                } else {
                    this.speechBubbleTimeout = setTimeout(() => {
                        this.speechBubble.innerHTML = "...";
                        this.speechBubble.classList.remove('speech-bubble-active', 'speech-bubble-interim');
                    }, 500);
                }
            }
        });
    }
}