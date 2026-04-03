
import * as THREE from 'three';
import { HandLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';

class AmbientMusicGame {
    constructor(renderDiv) {
        this.renderDiv = renderDiv;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.videoElement = document.getElementById('webcam-video');
        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.hands = [null, null];
        this.clock = new THREE.Clock();
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFPSUpdate = 0;
        this.currentFPS = 0;
        
        // Audio with robustness features
        this.synths = [null, null];
        this.delaySends = [null, null];
        this.delay = null;
        this.isStarted = false;
        this.maxPolyphony = 8; // Reduced from 10
        this.noteTimeout = 3000; // Reduced from 4000ms
        this.audioHealthCheck = null;
        this.lastAudioError = 0;
        this.audioErrorCooldown = 1000;
        
        // Hand tracking optimization
        this.lastLandmarkPositions = [[], []];
        this.smoothingFactor = 0.8; // Increased for more stability
        this.handTrackingInterval = 33; // ~30fps instead of 60fps
        this.lastHandUpdate = 0;
        
        // Musical data
        this.scales = [
            ['D3', 'Eb3', 'G3', 'A3', 'Bb3', 'D4', 'Eb4', 'G4', 'A4', 'Bb4', 'D5', 'Eb5', 'G5', 'A5', 'Bb5', 'D6'],
            ['A4', 'Bb4', 'D5', 'Eb5', 'G5', 'A5', 'Bb5', 'D6', 'Eb7', 'G7', 'A7', 'Bb7', 'D6', 'Bb5', 'A5', 'G5']
        ];
        
        // Visual elements with object pooling
        this.textCircles = [null, null];
        this.noteSprites = [[], []];
        this.currentRotations = [0, 0];
        this.rotationSpeeds = [0, 0];
        this.activeNotes = [null, null];
        this.maxRotationSpeed = 3.0;
        this.handVolumes = [0.5, 0.5];
        this.palmLabels = [null, null];
        
        // 3D grids with LOD and culling
        this.noteGrids = [null, null];
        this.noteCircles = [[], []];
        this.gridSize = 4;
        this.circleRadius = 60;
        this.gridSpacing = 100;
        this.maxRenderDistance = 1000;
        
        // Optimized tracking
        this.activeNoteTimes = [new Map(), new Map()];
        this.lastNoteChange = [0, 0];
        this.noteChangeDebounce = 50; // Increased to reduce audio spam
        
        // Material and geometry caching
        this.materialCache = new Map();
        this.geometryCache = new Map();
        this.textureCache = new Map();
        
        // Render optimization
        this.shouldUpdateVisuals = [true, true];
        this.visualUpdateThrottle = 16; // ~60fps for visuals
        this.lastVisualUpdate = [0, 0];
        
        // Memory management
        this.disposableObjects = new Set();
        this.memoryCleanupInterval = null;
        
        this._setupStartButton();
        this._startAudioHealthCheck();
        this._startMemoryManagement();
    }
    
    _setupStartButton() {
        const startButton = document.getElementById('start-button');
        const startOverlay = document.getElementById('start-overlay');
        
        startButton.addEventListener('click', async () => {
            try {
                startOverlay.classList.add('hidden');
                await this._init();
            } catch (error) {
                console.error("Failed to start application:", error);
                startOverlay.classList.remove('hidden');
            }
        });
    }
    
    _startMemoryManagement() {
        // Clean up disposed objects every 10 seconds
        this.memoryCleanupInterval = setInterval(() => {
            this._performMemoryCleanup();
        }, 10000);
    }
    
    _performMemoryCleanup() {
        // Clear texture cache if it gets too large
        if (this.textureCache.size > 50) {
            for (const [key, texture] of this.textureCache) {
                texture.dispose();
            }
            this.textureCache.clear();
        }
        
        // Force garbage collection hint
        if (window.gc) {
            window.gc();
        }
    }
    
    _getCachedGeometry(type) {
        if (this.geometryCache.has(type)) {
            return this.geometryCache.get(type);
        }
        
        let geometry;
        switch (type) {
            case 'box': geometry = new THREE.BoxGeometry(this.circleRadius, this.circleRadius, this.circleRadius); break;
            case 'sphere': geometry = new THREE.SphereGeometry(this.circleRadius * 0.7, 6, 4); break; // Reduced segments
            case 'cone': geometry = new THREE.ConeGeometry(this.circleRadius * 0.7, this.circleRadius * 1.2, 4); break;
            case 'cylinder': geometry = new THREE.CylinderGeometry(this.circleRadius * 0.6, this.circleRadius * 0.6, this.circleRadius * 1.2, 6); break;
            case 'tetrahedron': geometry = new THREE.TetrahedronGeometry(this.circleRadius * 0.8); break;
            case 'octahedron': geometry = new THREE.OctahedronGeometry(this.circleRadius * 0.7); break;
            default: geometry = new THREE.BoxGeometry(this.circleRadius, this.circleRadius, this.circleRadius);
        }
        
        this.geometryCache.set(type, geometry);
        this.disposableObjects.add(geometry);
        return geometry;
    }
    
    _getCachedMaterial(type, color, isActive = false) {
        const key = `${type}_${color.getHex()}_${isActive}`;
        if (this.materialCache.has(key)) {
            return this.materialCache.get(key);
        }
        
        let material;
        if (type === 'fill') {
            material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: !isActive,
                opacity: isActive ? 1.0 : 0.5
            });
        } else if (type === 'wireframe') {
            material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                wireframeLinewidth: 4 // Reduced from 6
            });
        }
        
        this.materialCache.set(key, material);
        this.disposableObjects.add(material);
        return material;
    }
    
    _activateNoteCircle(handIndex, noteIndex) {
        if (noteIndex === null || !this.noteCircles[handIndex]) return;
        
        const shapeGroup = this.noteCircles[handIndex][noteIndex];
        if (shapeGroup && !shapeGroup.userData.isActive) {
            shapeGroup.userData.isActive = true;
            const activeColor = this._getNoteColor(handIndex, noteIndex, true);
            const activeMaterial = this._getCachedMaterial('fill', activeColor, true);
            shapeGroup.userData.fillShape.material = activeMaterial;
        }
    }
    
    async _init() {
        if (this.isStarted) return;
        
        this._setupThree();
        await this._initializeAudio();
        this._setupMusicCircles();
        this._setupNoteGrids();
        await this._setupHandTracking();
        
        try {
            await this.videoElement.play();
            this.isStarted = true;
            console.log('Application started successfully');
        } catch (error) {
            console.error('Error starting webcam:', error);
            throw error;
        }
        
        window.addEventListener('resize', this._onResize.bind(this));
        window.addEventListener('beforeunload', this._cleanup.bind(this));
        this.clock.start();
        this._animate();
    }
    
    _cleanup() {
        try {
            // Stop intervals
            if (this.audioHealthCheck) clearInterval(this.audioHealthCheck);
            if (this.memoryCleanupInterval) clearInterval(this.memoryCleanupInterval);
            
            // Dispose audio
            for (let i = 0; i < 2; i++) {
                if (this.synths[i]) this.synths[i].dispose();
            }
            
            // Dispose cached objects
            for (const obj of this.disposableObjects) {
                if (obj.dispose) obj.dispose();
            }
            this.disposableObjects.clear();
            
            // Clear caches
            this.materialCache.clear();
            this.geometryCache.clear();
            for (const [key, texture] of this.textureCache) {
                texture.dispose();
            }
            this.textureCache.clear();
            
            this.activeNoteTimes = [new Map(), new Map()];
            console.log('Cleanup completed');
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }
    
    async _initializeAudio() {
        try {
            await Tone.start();
            
            const reverb = new Tone.Reverb({ decay: 4, wet: 0.4, preDelay: 0.02 }).toDestination(); // Reduced decay
            const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 1.2, depth: 0.3, wet: 0.15 }).connect(reverb); // Reduced intensity
            const filter = new Tone.Filter({ frequency: 2500, type: 'lowpass', rolloff: -12 }).connect(chorus);
            
            this.delay = new Tone.FeedbackDelay({ delayTime: 0.4, feedback: 0.15, wet: 0.7 }).connect(filter);
            
            for (let i = 0; i < 2; i++) {
                this.delaySends[i] = new Tone.Gain(0.8).connect(this.delay);
                
                this.synths[i] = new Tone.PolySynth({
                    maxPolyphony: this.maxPolyphony,
                    voice: Tone.FMSynth,
                    options: {
                        harmonicity: i === 0 ? 1.0 : 4.5,
                        modulationIndex: i === 0 ? 1.5 : 4, // Reduced complexity
                        oscillator: { type: "triangle" },
                        envelope: {
                            attack: i === 0 ? 0.1 : 0.0,
                            decay: i === 0 ? 0.7 : 0.15,
                            sustain: i === 0 ? 0.55 : 0.08,
                            release: i === 0 ? 0.9 : 0.25
                        },
                        modulation: { type: "sine" },
                        modulationEnvelope: { attack: 0.01, decay: 1.2, sustain: 0.08, release: 1.5 }
                    }
                });
                
                const brightFilter = new Tone.Filter({
                    frequency: i === 0 ? 120 : 1200,
                    type: 'highpass',
                    rolloff: -12
                });
                
                const compressor = new Tone.Compressor({
                    threshold: -15, ratio: 2.5, attack: 0.01, release: 0.15
                });
                
                this.synths[i].connect(brightFilter);
                brightFilter.connect(compressor);
                compressor.connect(filter);
                compressor.connect(this.delaySends[i]);
                this.synths[i].volume.value = -6;
            }
            
            console.log('Optimized audio system initialized');
        } catch (error) {
            console.error('Audio initialization failed:', error);
            throw error;
        }
    }
    
    _startAudioHealthCheck() {
        this.audioHealthCheck = setInterval(() => {
            try {
                if (Tone.context.state !== 'running') {
                    console.warn('Audio context not running, attempting restart...');
                    Tone.start().catch(err => console.error('Failed to restart audio:', err));
                }
                this._cleanupStuckNotes();
            } catch (error) {
                this._logAudioError('Audio health check failed:', error);
            }
        }, 3000); // Reduced frequency
    }
    
    _cleanupStuckNotes() {
        const now = Date.now();
        for (let handIndex = 0; handIndex < 2; handIndex++) {
            if (this.activeNoteTimes[handIndex]) {
                this.activeNoteTimes[handIndex].forEach((startTime, note) => {
                    if (now - startTime > this.noteTimeout) {
                        try {
                            if (this.synths[handIndex]) {
                                this.synths[handIndex].triggerRelease(note);
                            }
                            this.activeNoteTimes[handIndex].delete(note);
                        } catch (error) {
                            this._logAudioError(`Failed to release stuck note ${note}:`, error);
                        }
                    }
                });
            }
        }
    }
    
    _logAudioError(message, error) {
        const now = Date.now();
        if (now - this.lastAudioError > this.audioErrorCooldown) {
            console.error(message, error);
            this.lastAudioError = now;
        }
    }
    
    _setupMusicCircles() {
        for (let handIndex = 0; handIndex < 2; handIndex++) {
            this.textCircles[handIndex] = new THREE.Group();
            this.textCircles[handIndex].visible = false;
            this.scene.add(this.textCircles[handIndex]);
            
            this.noteSprites[handIndex] = [];
            const notes = this.scales[handIndex];
            
            for (let i = 0; i < notes.length; i++) {
                const texture = this._createNoteTexture(notes[i], handIndex, false);
                const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.1 });
                const sprite = new THREE.Sprite(material);
                
                sprite.scale.set(200, 80, 1); // Slightly smaller
                sprite.userData = { note: notes[i], handIndex, isActive: false, baseScale: 200 };
                
                this.textCircles[handIndex].add(sprite);
                this.noteSprites[handIndex].push(sprite);
                this.disposableObjects.add(material);
            }
            
            const labelTexture = this._createVolumeLabelTexture(this.handVolumes[handIndex]);
            const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, alphaTest: 0.1 });
            this.palmLabels[handIndex] = new THREE.Sprite(labelMaterial);
            this.palmLabels[handIndex].scale.set(180, 50, 1); // Slightly smaller
            this.palmLabels[handIndex].position.set(0, -20, 1);
            this.textCircles[handIndex].add(this.palmLabels[handIndex]);
            this.disposableObjects.add(labelMaterial);
        }
    }
    
    _setupNoteGrids() {
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        
        for (let handIndex = 0; handIndex < 2; handIndex++) {
            this.noteGrids[handIndex] = new THREE.Group();
            this.noteCircles[handIndex] = [];
            
            const gridX = handIndex === 0 ? width/2 - 300 : -width/2 + 300;
            this.noteGrids[handIndex].position.set(gridX, 0, 5);
            this.scene.add(this.noteGrids[handIndex]);
            
            const notes = this.scales[handIndex];
            const geometryTypes = ['box', 'sphere', 'cone', 'cylinder', 'tetrahedron', 'octahedron'];
            
            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    const noteIndex = row * this.gridSize + col;
                    const note = notes[noteIndex];
                    
                    const geometryType = geometryTypes[noteIndex % geometryTypes.length];
                    const geometry = this._getCachedGeometry(geometryType);
                    
                    const shapeGroup = new THREE.Group();
                    
                    const inactiveColor = this._getNoteColor(handIndex, noteIndex, false);
                    const inactiveFillMaterial = this._getCachedMaterial('fill', inactiveColor, false);
                    const wireframeMaterial = this._getCachedMaterial('wireframe', new THREE.Color(0xffffff));
                    
                    const fillShape = new THREE.Mesh(geometry, inactiveFillMaterial);
                    const wireframeShape = new THREE.Mesh(geometry, wireframeMaterial);
                    
                    shapeGroup.add(fillShape);
                    shapeGroup.add(wireframeShape);
                    
                    const x = (col - (this.gridSize - 1) / 2) * this.gridSpacing;
                    const y = ((this.gridSize - 1) / 2 - row) * this.gridSpacing;
                    shapeGroup.position.set(x, y, 0);
                    shapeGroup.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
                    
                    const maxRotationSpeed = 0.02; // Slightly reduced
                    shapeGroup.userData = {
                        note, handIndex, noteIndex, row, col, isActive: false,
                        fillShape, wireframeShape,
                        rotationSpeed: {
                            x: (Math.random() - 0.5) * maxRotationSpeed + 0.01,
                            y: (Math.random() - 0.5) * maxRotationSpeed + 0.01,
                            z: (Math.random() - 0.5) * maxRotationSpeed + 0.01
                        }
                    };
                    
                    this.noteGrids[handIndex].add(shapeGroup);
                    this.noteCircles[handIndex].push(shapeGroup);
                }
            }
        }
    }
    
    _getNoteColor(handIndex, noteIndex, isActive) {
        const baseHue = handIndex === 0 ? 230 : 40;
        const saturation = isActive ? 100 : 60;
        const lightness = isActive ? 55 : 65;
        return new THREE.Color().setHSL(baseHue / 360, saturation / 100, lightness / 100);
    }
    
    _createTexture(text, handIndex, isActive = false, isVolume = false) {
        const key = `${text}_${handIndex}_${isActive}_${isVolume}`;
        if (this.textureCache.has(key)) {
            return this.textureCache.get(key);
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = isVolume ? 180 : 250; // Reduced sizes
        canvas.height = isVolume ? 40 : 100;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const baseHue = handIndex === 0 ? 230 : 40;
        const color = isVolume ? '#ffffff' : `hsl(${baseHue}, ${isActive ? 100 : 70}%, ${isActive ? 50 : 60}%)`;
        
        ctx.fillStyle = color;
        ctx.font = `bold ${isVolume ? 18 : (isActive ? 55 : 32)}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = isVolume ? '#000000' : '#ffffff';
        ctx.shadowBlur = isActive ? 4 : (isVolume ? 2 : 1);
        
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        this.textureCache.set(key, texture);
        this.disposableObjects.add(texture);
        return texture;
    }
    
    _createNoteTexture(note, handIndex, isActive) {
        return this._createTexture(note, handIndex, isActive, false);
    }
    
    _createVolumeLabelTexture(volumeValue) {
        return this._createTexture(`vol: ${(volumeValue * 100).toFixed(0)}%`, 0, false, true);
    }
    
    _setupThree() {
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);
        this.camera.position.z = 100;
        
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: false, // Disabled for performance
            powerPreference: "high-performance",
            stencil: false,
            depth: false
        });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio
        this.renderDiv.appendChild(this.renderer.domElement);
        
        // Optimize renderer
        this.renderer.sortObjects = false;
        this.renderer.autoClear = true;
        
        this.hands = [null, null];
    }
    
    async _setupHandTracking() {
        try {
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: 'GPU'
                },
                numHands: 2,
                runningMode: 'VIDEO',
                minHandDetectionConfidence: 0.7, // Increased threshold
                minHandPresenceConfidence: 0.6,
                minTrackingConfidence: 0.6
            });
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'user', 
                    width: { ideal: 1280 }, // Reduced resolution
                    height: { ideal: 720 },
                    frameRate: { ideal: 30, max: 30 } // Cap framerate
                }
            });
            this.videoElement.srcObject = stream;
            
            return new Promise(resolve => {
                this.videoElement.onloadedmetadata = resolve;
            });
        } catch (error) {
            console.error('Error setting up Hand Tracking:', error);
            throw error;
        }
    }
    
    _playNote(note, handIndex) {
        if (!this.synths[handIndex] || !note) return;
        
        try {
            const now = Date.now();
            
            if (now - this.lastNoteChange[handIndex] < this.noteChangeDebounce) {
                return;
            }
            this.lastNoteChange[handIndex] = now;
            
            this._stopNote(handIndex);
            
            if (Tone.context.state !== 'running') {
                console.warn('Audio context not running, skipping note');
                return;
            }
            
            this.synths[handIndex].triggerAttack(note);
            
            if (!this.activeNoteTimes[handIndex]) {
                this.activeNoteTimes[handIndex] = new Map();
            }
            this.activeNoteTimes[handIndex].set(note, now);
            
            setTimeout(() => {
                try {
                    if (this.synths[handIndex] && this.activeNoteTimes[handIndex]?.has(note)) {
                        this.synths[handIndex].triggerRelease(note);
                        this.activeNoteTimes[handIndex].delete(note);
                    }
                } catch (error) {
                    this._logAudioError(`Auto-release failed for ${note}:`, error);
                }
            }, this.noteTimeout);
            
            const activeNoteIndex = this._findActiveNoteIndex(handIndex);
            this._activateNoteCircle(handIndex, activeNoteIndex);
            
        } catch (error) {
            this._logAudioError(`Failed to play note ${note}:`, error);
            this._emergencyStopHand(handIndex);
        }
    }
    
    _stopNote(handIndex) {
        try {
            if (this.synths[handIndex]) {
                this.synths[handIndex].releaseAll();
            }
            
            if (this.activeNoteTimes[handIndex]) {
                this.activeNoteTimes[handIndex].clear();
            }
            
            // Batch update visuals
            this.noteCircles[handIndex]?.forEach(shapeGroup => {
                if (shapeGroup.userData.isActive) {
                    shapeGroup.userData.isActive = false;
                    const inactiveColor = this._getNoteColor(handIndex, shapeGroup.userData.noteIndex, false);
                    const inactiveMaterial = this._getCachedMaterial('fill', inactiveColor, false);
                    shapeGroup.userData.fillShape.material = inactiveMaterial;
                }
            });
        } catch (error) {
            this._logAudioError(`Failed to stop notes for hand ${handIndex}:`, error);
        }
    }
    
    _emergencyStopHand(handIndex) {
        try {
            console.warn(`Emergency stop for hand ${handIndex}`);
            
            if (this.synths[handIndex]) {
                this.synths[handIndex].dispose();
                
                this.synths[handIndex] = new Tone.PolySynth({
                    maxPolyphony: this.maxPolyphony,
                    voice: Tone.FMSynth,
                    options: {
                        harmonicity: handIndex === 0 ? 1.0 : 4.5,
                        modulationIndex: handIndex === 0 ? 1.5 : 4,
                        oscillator: { type: "triangle" },
                        envelope: {
                            attack: handIndex === 0 ? 0.15 : 0.0,
                            decay: handIndex === 0 ? 0.8 : 0.15,
                            sustain: handIndex === 0 ? 0.6 : 0.08,
                            release: handIndex === 0 ? 1.5 : 0.6
                        },
                        modulation: { type: "sine" },
                        modulationEnvelope: { attack: 0.01, decay: 1.2, sustain: 0.08, release: 1.5 }
                    }
                });
                
                this.synths[handIndex].volume.value = -8;
            }
            
            if (this.activeNoteTimes[handIndex]) {
                this.activeNoteTimes[handIndex].clear();
            }
            
        } catch (error) {
            this._logAudioError(`Emergency stop failed for hand ${handIndex}:`, error);
        }
    }
    
    _calculateHandRotation(landmarks) {
        const wrist = landmarks[0];
        const middleFingerTip = landmarks[12];
        const deltaX = middleFingerTip.x - wrist.x;
        const deltaY = middleFingerTip.y - wrist.y;
        const angle = Math.atan2(deltaY, deltaX);
        const upAngle = -Math.PI / 2;
        let deviation = angle - upAngle;
        
        if (deviation > Math.PI) deviation -= 2 * Math.PI;
        else if (deviation < -Math.PI) deviation += 2 * Math.PI;
        
        const isNearUp = Math.abs(deviation) < Math.PI / 12;
        return { angle: isNearUp ? 0 : deviation, shouldStop: isNearUp };
    }
    
    _findActiveNote(handIndex) {
        const notes = this.noteSprites[handIndex];
        if (!notes.length) return null;
        
        let activeSprite = null;
        let activeIndex = -1;
        let minDistance = Infinity;
        
        for (let i = 0; i < notes.length; i++) {
            const sprite = notes[i];
            const angle = -(i / notes.length) * Math.PI * 2 + this.currentRotations[handIndex];
            const normalizedAngle = ((angle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
            
            let distanceTo3pm = Math.abs(normalizedAngle);
            if (distanceTo3pm > Math.PI) distanceTo3pm = Math.PI * 2 - distanceTo3pm;
            
            if (distanceTo3pm < minDistance) {
                minDistance = distanceTo3pm;
                activeSprite = sprite;
                activeIndex = i;
            }
        }
        return { sprite: activeSprite, index: activeIndex };
    }
    
    _findActiveNoteIndex(handIndex) {
        const notes = this.noteSprites[handIndex];
        if (!notes.length) return null;
        
        let activeIndex = -1;
        let minDistance = Infinity;
        
        for (let i = 0; i < notes.length; i++) {
            const angle = -(i / notes.length) * Math.PI * 2 + this.currentRotations[handIndex];
            const normalizedAngle = ((angle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
            
            let distanceTo3pm = Math.abs(normalizedAngle);
            if (distanceTo3pm > Math.PI) distanceTo3pm = Math.PI * 2 - distanceTo3pm;
            
            if (distanceTo3pm < minDistance) {
                minDistance = distanceTo3pm;
                activeIndex = i;
            }
        }
        return activeIndex;
    }
    
    _updateMusicCircles() {
        const deltaTime = this.clock.getDelta();
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        
        for (let handIndex = 0; handIndex < 2; handIndex++) {
            const hand = this.hands[handIndex];
            
            if (!hand?.landmarks) {
                this.textCircles[handIndex].visible = false;
                this._stopNote(handIndex);
                this.activeNotes[handIndex] = null;
                continue;
            }
            
            // Throttle visual updates
            const now = performance.now();
            if (now - this.lastVisualUpdate[handIndex] < this.visualUpdateThrottle) {
                continue;
            }
            this.lastVisualUpdate[handIndex] = now;
            
            const landmarks = hand.landmarks;
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const palmCenter = landmarks[9];
            
            // Calculate circle and volume
            const thumbIndexDistance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) +
                Math.pow(thumbTip.y - indexTip.y, 2) +
                Math.pow(thumbTip.z - indexTip.z, 2)
            );
            
            const normalizedDistance = Math.min(Math.max(thumbIndexDistance, 0.02), 0.15);
            const circleRadius = THREE.MathUtils.mapLinear(normalizedDistance, 0.02, 0.15, 30, 180); // Smaller range
            const volume = THREE.MathUtils.mapLinear(normalizedDistance, 0.02, 0.15, 0.0, 1.0);
            
            // Position circle
            const palmX = (1 - palmCenter.x) * width - width / 2;
            const palmY = (1 - palmCenter.y) * height - height / 2;
            this.textCircles[handIndex].position.set(palmX, palmY, 2);
            this.textCircles[handIndex].visible = true;
            
            // Update volume (less frequently)
            if (Math.abs(this.handVolumes[handIndex] - volume) > 0.05) {
                this.handVolumes[handIndex] = volume;
                if (this.synths[handIndex]) {
                    const volumeDb = volume === 0 ? -60 : THREE.MathUtils.mapLinear(volume, 0, 1, -30, -5);
                    this.synths[handIndex].volume.value = volumeDb;
                }
                
                // Update palm label less frequently
                if (this.palmLabels[handIndex]) {
                    const newTexture = this._createVolumeLabelTexture(volume);
                    if (this.palmLabels[handIndex].material.map) {
                        this.palmLabels[handIndex].material.map.dispose();
                    }
                    this.palmLabels[handIndex].material.map = newTexture;
                    this.palmLabels[handIndex].material.needsUpdate = true;
                }
            }
            
            // Calculate rotation
            const handRotation = this._calculateHandRotation(landmarks);
            if (!handRotation.shouldStop) {
                const maxAngle = Math.PI / 4;
                const clampedAngle = Math.max(-maxAngle, Math.min(maxAngle, handRotation.angle));
                this.rotationSpeeds[handIndex] = -THREE.MathUtils.mapLinear(
                    clampedAngle, -maxAngle, maxAngle, -this.maxRotationSpeed, this.maxRotationSpeed
                );
            } else {
                this.rotationSpeeds[handIndex] = 0;
            }
            
            this.currentRotations[handIndex] += this.rotationSpeeds[handIndex] * deltaTime;
            
            // Position notes
            const notes = this.noteSprites[handIndex];
            for (let i = 0; i < notes.length; i++) {
                const sprite = notes[i];
                const angle = -(i / notes.length) * Math.PI * 2 + this.currentRotations[handIndex];
                sprite.position.set(
                    Math.cos(angle) * circleRadius,
                    Math.sin(angle) * circleRadius,
                    0
                );
                sprite.userData.isActive = false;
            }
            
            // Handle active note
            const activeResult = this._findActiveNote(handIndex);
            if (activeResult && activeResult.sprite) {
                activeResult.sprite.userData.isActive = true;
                
                if (this.activeNotes[handIndex] !== activeResult.sprite.userData.note) {
                    this.activeNotes[handIndex] = activeResult.sprite.userData.note;
                    this._playNote(activeResult.sprite.userData.note, handIndex);
                }
                
                // Update textures less frequently
                const newTexture = this._createNoteTexture(activeResult.sprite.userData.note, handIndex, true);
                if (activeResult.sprite.material.map) activeResult.sprite.material.map.dispose();
                activeResult.sprite.material.map = newTexture;
                activeResult.sprite.material.needsUpdate = true;
                activeResult.sprite.scale.set(240, 100, 1);
            } else {
                if (this.activeNotes[handIndex] !== null) {
                    this.activeNotes[handIndex] = null;
                    this._stopNote(handIndex);
                }
            }
            
            // Update inactive notes (batch operation)
            for (let sprite of notes) {
                if (!sprite.userData.isActive) {
                    const newTexture = this._createNoteTexture(sprite.userData.note, handIndex, false);
                    if (sprite.material.map) sprite.material.map.dispose();
                    sprite.material.map = newTexture;
                    sprite.material.needsUpdate = true;
                    sprite.scale.set(160, 65, 1);
                }
            }
        }
    }
    
    _updateHands() {
        if (!this.handLandmarker || !this.videoElement.srcObject || this.videoElement.readyState < 2) return;
        
        // Throttle hand tracking
        const now = performance.now();
        if (now - this.lastHandUpdate < this.handTrackingInterval) return;
        this.lastHandUpdate = now;
        
        const videoTime = this.videoElement.currentTime;
        if (videoTime <= this.lastVideoTime) return;
        
        this.lastVideoTime = videoTime;
        try {
            const results = this.handLandmarker.detectForVideo(this.videoElement, now);
            this.hands = [null, null];
            
            if (results.landmarks && results.handedness) {
                for (let i = 0; i < Math.min(results.landmarks.length, 2); i++) {
                    const currentLandmarks = results.landmarks[i];
                    const handedness = results.handedness[i][0].categoryName;
                    const handIndex = handedness === 'Right' ? 0 : 1;
                    
                    if (!this.lastLandmarkPositions[handIndex] || 
                        this.lastLandmarkPositions[handIndex].length !== currentLandmarks.length) {
                        this.lastLandmarkPositions[handIndex] = currentLandmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
                    }
                    
                    const smoothedLandmarks = currentLandmarks.map((lm, lmIndex) => {
                        const prevLm = this.lastLandmarkPositions[handIndex][lmIndex];
                        const smoothed = {
                            x: this.smoothingFactor * lm.x + (1 - this.smoothingFactor) * prevLm.x,
                            y: this.smoothingFactor * lm.y + (1 - this.smoothingFactor) * prevLm.y,
                            z: this.smoothingFactor * lm.z + (1 - this.smoothingFactor) * prevLm.z
                        };
                        this.lastLandmarkPositions[handIndex][lmIndex] = { ...smoothed };
                        return smoothed;
                    });
                    
                    this.hands[handIndex] = { landmarks: smoothedLandmarks, handedness };
                }
            }
            
            if (this.isStarted) this._updateMusicCircles();
        } catch (error) {
            console.error("Error during hand detection:", error);
        }
    }
    
    _onResize() {
        const { clientWidth: width, clientHeight: height } = this.renderDiv;
        this.camera.left = width / -2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = height / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        
        if (this.isStarted) {
            this._updateHands();
            this._updateNoteGrids();
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    _updateNoteGrids() {
        // Update 3D grid rotations (less frequently)
        for (let handIndex = 0; handIndex < 2; handIndex++) {
            if (this.noteCircles[handIndex]) {
                this.noteCircles[handIndex].forEach((shapeGroup, index) => {
                        shapeGroup.rotation.x += shapeGroup.userData.rotationSpeed.x;
                        shapeGroup.rotation.y += shapeGroup.userData.rotationSpeed.y;
                        shapeGroup.rotation.z += shapeGroup.userData.rotationSpeed.z;
                });
            }
        }
    }
    
    start() {
        console.log('Optimized Ambient Music Hand Tracking ready. Click "Start" to begin...');
    }
}

// Initialize the game
const renderDiv = document.getElementById('renderDiv');
if (!renderDiv) {
    console.error('Fatal Error: renderDiv element not found.');
} else {
    const game = new AmbientMusicGame(renderDiv);
    game.start();
}