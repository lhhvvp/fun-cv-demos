
class RhythmGame {
    constructor() {
        this.gameStarted = false;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Game elements - will be initialized after startup
        this.video = null;
        this.overlay = null;
        this.ctx = null;
        this.textBox = null;
        this.textContent = '';
        this.audioContext = null;
        this.audioUnlocked = false;
        
        // Performance optimizations
        this.frameSkipCounter = 0;
        this.frameSkipRate = this.isMobile ? 2 : 1;
        this.lastProcessTime = 0;
        this.processingThrottle = this.isMobile ? 50 : 33;
        
        this.buttons = {};
        this.stageLights = {};
        this.musicNote = null;
        this.backgroundMusic = null;
        this.isMusicPlaying = false;
        this.musicLastHit = 0;
        
        // 3D model variables
        this.model = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.currentRotation = 0;
        this.rotationVelocity = 0;
        this.rotationFriction = 0.96;
        this.bobTime = 0;
        
        // Hand tracking variables
        this.handPoints = [];
        this.hands = null;
        this.camera_mediapipe = null;
        this.lastHandResults = null;
        this.handResultsCache = new Map();
        
        // Button collision cache
        this.buttonRects = {};
        this.musicNoteRect = null;
        
        this.setupStartButton();
        this.setupAudioUnlock();
    }
    
    setupAudioUnlock() {
        const unlockButton = document.getElementById('unlock-audio-button');
        unlockButton.addEventListener('click', async () => {
            await this.unlockAudio();
            document.getElementById('audio-unlock-message').style.display = 'none';
        });
    }
    
    async unlockAudio() {
        try {
            console.log('Attempting to unlock audio...');
            
            // Create or resume audio context
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Test all sounds to unlock them on mobile
            const testPromises = Object.keys(this.buttons).map(async (key) => {
                const button = this.buttons[key];
                if (button.sound && button.sound.play) {
                    try {
                        // Set volume to 0 for testing
                        const originalVolume = button.sound.volume;
                        button.sound.volume = 0;
                        button.sound.currentTime = 0;
                        
                        const playPromise = button.sound.play();
                        if (playPromise) {
                            await playPromise;
                            button.sound.pause();
                            button.sound.currentTime = 0;
                        }
                        
                        // Restore original volume
                        button.sound.volume = originalVolume;
                        console.log(`Audio unlocked for button ${key}`);
                    } catch (error) {
                        console.warn(`Failed to unlock audio for button ${key}:`, error);
                    }
                }
            });
            
            await Promise.all(testPromises);
            
            // Test background music (but don't leave it playing)
            if (this.backgroundMusic && this.backgroundMusic.play) {
                try {
                    const originalVolume = this.backgroundMusic.volume;
                    this.backgroundMusic.volume = 0;
                    this.backgroundMusic.currentTime = 0;
                    
                    const playPromise = this.backgroundMusic.play();
                    if (playPromise) {
                        await playPromise;
                        // Immediately pause after unlocking
                        this.backgroundMusic.pause();
                        this.backgroundMusic.currentTime = 0;
                    }
                    
                    // Restore original volume and ensure it's paused
                    this.backgroundMusic.volume = originalVolume;
                    this.backgroundMusic.pause();
                    this.backgroundMusic.currentTime = 0;
                    this.isMusicPlaying = false;
                    this.musicNote.classList.remove('active');
                    
                    console.log('Background music audio unlocked (but not playing)');
                } catch (error) {
                    console.warn('Failed to unlock background music:', error);
                }
            }
            
            this.audioUnlocked = true;
            console.log('Audio unlock completed successfully');
            
        } catch (error) {
            console.error('Audio unlock failed:', error);
        }
    }
    
    setupStartButton() {
        const startButton = document.getElementById('start-button');
        
        const startGame = async () => {
            if (this.gameStarted) return;
            
            console.log('Starting game...');
            this.gameStarted = true;
            
            // Show loading indicator
            document.getElementById('loading-indicator').style.display = 'block';
            
            try {
                // Initialize audio context first
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                
                // Initialize all game elements
                await this.initializeGame();
                
                // Hide startup screen and show game
                document.getElementById('startup-screen').style.display = 'none';
                document.getElementById('game-container').style.display = 'block';
                document.getElementById('loading-indicator').style.display = 'none';
                
                // Show audio unlock message on mobile if needed
                if (this.isMobile && !this.audioUnlocked) {
                    setTimeout(() => {
                        document.getElementById('audio-unlock-message').style.display = 'block';
                    }, 1000);
                }
                
                // IMPORTANT: Recalculate button positions after UI is visible
                setTimeout(() => {
                    this.recalculateRects();
                    console.log('Button positions updated after UI is visible');
                }, 100);
                
            } catch (error) {
                console.error('Game initialization failed:', error);
                this.showError('Failed to start game. Please check camera permissions and try again.');
                this.gameStarted = false;
                document.getElementById('loading-indicator').style.display = 'none';
            }
        };
        
        // Simple click handler - just one event listener
        startButton.addEventListener('click', startGame);
        console.log('Start button event listener added');
    }
    
    async initializeGame() {
        // Initialize DOM elements
        this.video = document.getElementById('video');
        this.overlay = document.getElementById('overlay');
        this.ctx = this.overlay.getContext('2d');
        this.textBox = document.getElementById('text-box');
        
        this.buttons = {
            o: { element: document.getElementById('btn-o'), sound: null, lastHit: { left: 0, right: 0 } },
            i: { element: document.getElementById('btn-i'), sound: null, lastHit: { left: 0, right: 0 } },
            a: { element: document.getElementById('btn-a'), sound: null, lastHit: { left: 0, right: 0 } }
        };
        
        this.stageLights = {
            o: { light: document.getElementById('light-o') },
            i: { light: document.getElementById('light-i') },
            a: { light: document.getElementById('light-a') }
        };
        
        this.musicNote = document.getElementById('music-note');
        
        // Canvas optimization
        this.offscreenCanvas = new OffscreenCanvas(this.overlay.width, this.overlay.height);
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        
        // Initialize all game systems
        console.log('Setting up camera...');
        await this.setupCamera();
        
        console.log('Setting up event listeners...');
        this.setupEventListeners();
        
        console.log('Setting up 3D scene...');
        await this.setup3D();
        
        console.log('Loading sounds...');
        await this.loadSounds();
        
        console.log('Setting up MediaPipe...');
        await this.setupMediaPipe();
        
        // Don't calculate button rectangles here - wait until UI is visible
        console.log('Game initialization complete - button rects will be calculated after UI is shown');
    }
    
    async setupCamera() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device');
            }
            
            const constraints = {
                video: { 
                    width: { ideal: this.isMobile ? 640 : 1280 },
                    height: { ideal: this.isMobile ? 480 : 720 },
                    frameRate: { ideal: this.isMobile ? 15 : 30 },
                    facingMode: 'user'
                },
                audio: false
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    console.log('Video metadata loaded');
                    this.resizeCanvas();
                    resolve();
                };
                
                this.video.onerror = (error) => {
                    console.error('Video error:', error);
                    reject(new Error('Video failed to load'));
                };
                
                setTimeout(() => {
                    if (this.video.readyState === 0) {
                        reject(new Error('Video loading timeout'));
                    }
                }, 10000);
            });
            
        } catch (error) {
            console.error('Camera setup error:', error);
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera permission denied. Please allow camera access and refresh the page.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera found on this device.');
            } else {
                throw new Error(`Camera error: ${error.message}`);
            }
        }
    }
    
    resizeCanvas() {
        this.overlay.width = window.innerWidth;
        this.overlay.height = window.innerHeight;
        
        this.offscreenCanvas.width = window.innerWidth;
        this.offscreenCanvas.height = window.innerHeight;
        
        this.recalculateRects();
    }
    
    recalculateRects() {
        if (!this.buttons.o || !this.buttons.o.element) {
            console.warn('Buttons not initialized yet, skipping rect calculation');
            return;
        }
        
        // Check if game container is visible
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer || gameContainer.style.display === 'none') {
            console.warn('Game container not visible yet, skipping rect calculation');
            return;
        }
        
        console.log('Recalculating button rectangles...');
        
        Object.keys(this.buttons).forEach(key => {
            const element = this.buttons[key].element;
            const rect = element.getBoundingClientRect();
            this.buttonRects[key] = {
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2,
                radius: rect.width / 2,
                hitRadius: rect.width / 2 + 40 // Increased hit radius for easier interaction
            };
            console.log(`Button ${key} rect:`, {
                centerX: Math.round(this.buttonRects[key].centerX),
                centerY: Math.round(this.buttonRects[key].centerY),
                hitRadius: Math.round(this.buttonRects[key].hitRadius),
                elementRect: {
                    left: Math.round(rect.left),
                    top: Math.round(rect.top),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                }
            });
        });
        
        if (this.musicNote) {
            const musicRect = this.musicNote.getBoundingClientRect();
            this.musicNoteRect = {
                centerX: musicRect.left + musicRect.width / 2,
                centerY: musicRect.top + musicRect.height / 2
            };
            console.log('Music note rect:', {
                centerX: Math.round(this.musicNoteRect.centerX),
                centerY: Math.round(this.musicNoteRect.centerY)
            });
        }
    }
    
    async setupMediaPipe() {
        // Wait for MediaPipe to be fully loaded
        while (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
            console.log('Waiting for MediaPipe to load...');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('MediaPipe loaded, initializing hands...');
        
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: this.isMobile ? 0 : 1,
            minDetectionConfidence: this.isMobile ? 0.7 : 0.5,
            minTrackingConfidence: this.isMobile ? 0.7 : 0.5
        });
        
        this.hands.onResults(this.onResults.bind(this));
        
        console.log('Setting up MediaPipe camera...');
        
        this.camera_mediapipe = new Camera(this.video, {
            onFrame: async () => {
                const now = performance.now();
                if (now - this.lastProcessTime < this.processingThrottle) {
                    return;
                }
                this.lastProcessTime = now;
                
                this.frameSkipCounter++;
                if (this.frameSkipCounter % this.frameSkipRate !== 0) {
                    return;
                }
                
                try {
                    await this.hands.send({ image: this.video });
                } catch (error) {
                    console.warn('MediaPipe processing error:', error);
                }
            },
            width: this.isMobile ? 1280 : 1920,
            height: this.isMobile ? 720 : 1080
        });
        
        console.log('Starting MediaPipe camera...');
        await this.camera_mediapipe.start();
        console.log('MediaPipe camera started successfully');
    }
    
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    async setup3D() {
        // Wait for Three.js to be fully loaded
        while (typeof THREE === 'undefined') {
            console.log('Waiting for Three.js to load...');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('Three.js loaded, setting up 3D scene...');
        
        const container = document.getElementById('model-container');
        container.classList.add('angel-glow');

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true,
            antialias: !this.isMobile,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(800, 800);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(this.isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = false;
        
        container.appendChild(this.renderer.domElement);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.3);
        directionalLight.position.set(10, 10, 5);
        this.scene.add(directionalLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 3.0);
        rimLight.position.set(0, 0, -10);
        this.scene.add(rimLight);
        
        this.camera.position.z = 18;
        
        try {
            if (typeof THREE.GLTFLoader === 'undefined') {
                throw new Error('GLTFLoader not available');
            }
            
            // Set up Draco decoder
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
            dracoLoader.setDecoderConfig({ type: 'js' });
            
            const loader = new THREE.GLTFLoader();
            loader.setDRACOLoader(dracoLoader);
            
            const gltf = await new Promise((resolve, reject) => {
                loader.load(
                    'assets/oiia-compressed.glb',
                    resolve,
                    (progress) => console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%'),
                    reject
                );
            });
            
            this.model = gltf.scene;
            if(this.isMobile){
                this.model.scale.set(16, 16, 16);
            } else {
                this.model.scale.set(22, 22, 22);
            }
            this.scene.add(this.model);
            
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(material => {
                            if (material.emissive) {
                                material.emissive.setHex(0x111111);
                            }
                            if (material.color) {
                                material.color.multiplyScalar(1.2);
                            }
                            material.needsUpdate = false;
                        });
                    }
                }
            });
            
            console.log('3D model loaded successfully');
            
        } catch (error) {
            console.warn('Could not load 3D model:', error.message);
            const geometry = new THREE.BoxGeometry(8, 8, 8);
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x00ff00,
                emissive: 0x002200
            });
            this.model = new THREE.Mesh(geometry, material);
            this.scene.add(this.model);
        }
        
        this.animate();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.model) {
            this.rotationVelocity *= this.rotationFriction;
            this.currentRotation += this.rotationVelocity;
            this.model.rotation.y = this.currentRotation;
            
            this.bobTime += 0.03;
            const bobOffset = Math.sin(this.bobTime) * 2;
            this.model.position.y = bobOffset;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    async loadSounds() {
        const soundFiles = [
            { file: 'O2.mp3', key: 'o' },
            { file: 'I2.mp3', key: 'i' },
            { file: 'A2.mp3', key: 'a' }
        ];
        
        const soundPromises = soundFiles.map(async (soundInfo) => {
            try {
                const audio = new Audio(`assets/${soundInfo.file}`);
                audio.preload = 'auto';
                audio.volume = 0.8;
                
                // Mobile-specific audio settings
                if (this.isMobile) {
                    audio.muted = false;
                    audio.playsInline = true;
                    audio.setAttribute('playsinline', 'true');
                    audio.setAttribute('webkit-playsinline', 'true');
                }
                
                // Create multiple instances for mobile to handle rapid firing
                if (this.isMobile) {
                    const audioPool = [];
                    for (let i = 0; i < 3; i++) {
                        const clone = audio.cloneNode();
                        clone.volume = 0.8;
                        clone.preload = 'auto';
                        audioPool.push(clone);
                    }
                    
                    // Custom play function for mobile
                    audio.playMobile = () => {
                        const availableAudio = audioPool.find(a => a.paused || a.ended);
                        if (availableAudio) {
                            availableAudio.currentTime = 0;
                            return availableAudio.play();
                        } else {
                            // All are playing, use the first one
                            audioPool[0].currentTime = 0;
                            return audioPool[0].play();
                        }
                    };
                }
                
                if (this.buttons[soundInfo.key]) {
                    this.buttons[soundInfo.key].sound = audio;
                }
                
                console.log(`Loaded sound: ${soundInfo.file}`);
            } catch (error) {
                console.warn(`Could not load sound: ${soundInfo.file}`, error);
                if (this.buttons[soundInfo.key]) {
                    this.buttons[soundInfo.key].sound = this.createBeepSound(440 + soundFiles.indexOf(soundInfo) * 200);
                }
            }
        });
        
        await Promise.all(soundPromises);
        
        try {
            this.backgroundMusic = new Audio('assets/song.mp3');
            this.backgroundMusic.loop = true;
            this.backgroundMusic.volume = 0.6;
            this.backgroundMusic.preload = 'auto';
            
            if (this.isMobile) {
                this.backgroundMusic.muted = false;
                this.backgroundMusic.playsInline = true;
                this.backgroundMusic.setAttribute('playsinline', 'true');
                this.backgroundMusic.setAttribute('webkit-playsinline', 'true');
            }
            
            console.log('Background music loaded');
        } catch (error) {
            console.warn('Could not load background music:', error);
        }
    }
    
    createBeepSound(frequency) {
        return {
            play: () => {
                const audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                
                try {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.value = frequency;
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.3);
                } catch (error) {
                    console.warn('Beep sound creation failed:', error);
                }
            },
            playMobile: function() {
                return this.play();
            }
        };
    }
    
    setupEventListeners() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resizeCanvas();
                // Recalculate button positions on resize
                this.recalculateRects();
            }, 250);
        });
        
        Object.keys(this.buttons).forEach(key => {
            this.buttons[key].element.addEventListener('click', () => {
                this.hitButton(key);
            });
        });
        
        this.musicNote.addEventListener('click', () => {
            this.toggleBackgroundMusic();
        });
    }
    
    onResults(results) {
        if (!this.offscreenCtx || !this.ctx) {
            console.warn('Canvas contexts not available');
            return;
        }
        
        this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        
        if (results.multiHandLandmarks && results.multiHandedness) {
            console.log('Hand tracking detected:', results.multiHandLandmarks.length, 'hands');
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                this.drawHandLandmarksOptimized(landmarks);
                this.checkButtonCollisionsOptimized(landmarks, handedness);
            }
        }
        
        this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }
    
    drawHandLandmarksOptimized(landmarks) {
        this.offscreenCtx.fillStyle = '#ff0080';
        
        landmarks.forEach((landmark, index) => {
            if (![4, 8, 12, 16, 20].includes(index)) {
                const x = (1 - landmark.x) * this.offscreenCanvas.width;
                const y = landmark.y * this.offscreenCanvas.height;
                
                this.offscreenCtx.beginPath();
                this.offscreenCtx.arc(x, y, 4, 0, 2 * Math.PI);
                this.offscreenCtx.fill();
            }
        });
        
        this.offscreenCtx.fillStyle = '#00ff80';
        [4, 8, 12, 16, 20].forEach(index => {
            const landmark = landmarks[index];
            const x = (1 - landmark.x) * this.offscreenCanvas.width;
            const y = landmark.y * this.offscreenCanvas.height;
            
            this.offscreenCtx.beginPath();
            this.offscreenCtx.arc(x, y, 6, 0, 2 * Math.PI);
            this.offscreenCtx.fill();
        });
        
        this.drawHandConnectionsOptimized(landmarks);
    }
    
    drawHandConnectionsOptimized(landmarks) {
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 17], [5, 9], [9, 10], [10, 11], [11, 12],
            [9, 13], [13, 14], [14, 15], [15, 16],
            [13, 17], [17, 18], [18, 19], [19, 20]
        ];
        
        this.offscreenCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        this.offscreenCtx.lineWidth = 2;
        this.offscreenCtx.beginPath();
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            const startX = (1 - startPoint.x) * this.offscreenCanvas.width;
            const startY = startPoint.y * this.offscreenCanvas.height;
            const endX = (1 - endPoint.x) * this.offscreenCanvas.width;
            const endY = endPoint.y * this.offscreenCanvas.height;
            
            this.offscreenCtx.moveTo(startX, startY);
            this.offscreenCtx.lineTo(endX, endY);
        });
        
        this.offscreenCtx.stroke();
    }
    
    checkButtonCollisionsOptimized(landmarks, handedness) {
        const fingertips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky fingertips
        const handLabel = handedness.label.toLowerCase();
        
        fingertips.forEach(fingertipIndex => {
            const fingertip = landmarks[fingertipIndex];
            const x = (1 - fingertip.x) * window.innerWidth;
            const y = fingertip.y * window.innerHeight;
            
            // Debug: Log fingertip positions occasionally
            if (Math.random() < 0.01) { // Log 1% of the time to avoid spam
                console.log(`Fingertip ${fingertipIndex} at (${Math.round(x)}, ${Math.round(y)})`);
            }
            
            // Check music note collision
            if (this.musicNoteRect) {
                const musicNoteDistance = Math.sqrt(
                    (x - this.musicNoteRect.centerX) ** 2 + 
                    (y - this.musicNoteRect.centerY) ** 2
                );
                
                if (musicNoteDistance < 60 && Date.now() - this.musicLastHit > 1000) {
                    console.log('Music note hit!');
                    this.toggleBackgroundMusic();
                }
            }
            
            // Check button collisions
            Object.keys(this.buttons).forEach(key => {
                const button = this.buttons[key];
                const buttonRect = this.buttonRects[key];
                
                if (buttonRect) {
                    const distance = Math.sqrt(
                        (x - buttonRect.centerX) ** 2 + 
                        (y - buttonRect.centerY) ** 2
                    );
                    
                    // Debug: Log when we're close to a button
                    if (distance < buttonRect.hitRadius * 1.5) {
                        console.log(`Close to button ${key}: distance=${Math.round(distance)}, hitRadius=${buttonRect.hitRadius}, buttonPos=(${Math.round(buttonRect.centerX)}, ${Math.round(buttonRect.centerY)})`);
                    }
                    
                    const lastHitTime = button.lastHit[handLabel] || 0;
                    const cooldown = 300;
                    
                    if (distance < buttonRect.hitRadius && Date.now() - lastHitTime > cooldown) {
                        console.log(`Button ${key} hit by ${handLabel} hand!`);
                        this.hitButton(key, handLabel);
                    }
                } else {
                    console.warn(`Button rect for ${key} not found`);
                }
            });
        });
    }
    
    addLetterToTextBox(letter) {
        this.textContent += letter.toUpperCase();
        this.textBox.textContent = this.textContent;
        
        this.textBox.style.display = 'block';
        this.textBox.style.visibility = 'visible';
    }
    
    triggerStageLight(key) {
        const stageLight = this.stageLights[key];
        if (!stageLight) return;
        
        requestAnimationFrame(() => {
            stageLight.light.classList.remove('flash');
            void stageLight.light.offsetWidth;
            stageLight.light.classList.add('flash');
            
            setTimeout(() => {
                stageLight.light.classList.remove('flash');
            }, 600);
        });
    }
    
    hitButton(key, handLabel = null) {
        if (!this.gameStarted) {
            console.log('Game not started, ignoring button hit');
            return;
        }
        
        console.log(`Hit button ${key} with ${handLabel || 'click'}`);
        
        const button = this.buttons[key];
        
        this.addLetterToTextBox(key);
        
        if (button.sound) {
            try {
                console.log(`Attempting to play sound for button ${key}`);
                
                if (this.isMobile && button.sound.playMobile) {
                    // Use mobile-optimized audio playback
                    const playPromise = button.sound.playMobile();
                    if (playPromise) {
                        playPromise.catch(e => {
                            console.warn(`Mobile audio play failed for ${key}:`, e);
                            // Fallback to web audio
                            this.playFallbackSound(key);
                        });
                    }
                } else if (button.sound.play) {
                    // Desktop or fallback audio playback
                    button.sound.currentTime = 0;
                    const playPromise = button.sound.play();
                    if (playPromise) {
                        playPromise.catch(e => {
                            console.warn(`Audio play failed for ${key}:`, e);
                            this.playFallbackSound(key);
                        });
                    }
                } else {
                    // Web Audio API fallback
                    button.sound.play();
                }
                
                console.log(`Sound played successfully for button ${key}`);
            } catch (error) {
                console.warn(`Sound playback error for ${key}:`, error);
                this.playFallbackSound(key);
            }
        }
        
        requestAnimationFrame(() => {
            button.element.classList.add('hit');
            setTimeout(() => {
                button.element.classList.remove('hit');
            }, 200);
        });
        
        this.triggerStageLight(key);
        this.rotationVelocity += 0.15;
        
        if (handLabel) {
            button.lastHit[handLabel] = Date.now();
        } else {
            button.lastHit.left = Date.now();
            button.lastHit.right = Date.now();
        }
    }
    
    playFallbackSound(key) {
        try {
            const frequencies = { o: 440, i: 660, a: 880 };
            const frequency = frequencies[key] || 440;
            
            if (this.audioContext) {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.2);
                
                console.log(`Fallback sound played for button ${key}`);
            }
        } catch (error) {
            console.warn(`Fallback sound failed for ${key}:`, error);
        }
    }
    
    toggleBackgroundMusic() {
        if (!this.gameStarted || Date.now() - this.musicLastHit < 1000) {
            return;
        }
        
        if (!this.backgroundMusic) {
            console.warn('Background music not loaded');
            return;
        }
        
        try {
            if (this.isMusicPlaying) {
                this.backgroundMusic.pause();
                this.isMusicPlaying = false;
                this.musicNote.classList.remove('active');
                console.log('Background music paused');
            } else {
                const playPromise = this.backgroundMusic.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        this.isMusicPlaying = true;
                        this.musicNote.classList.add('active');
                        console.log('Background music started');
                    }).catch(e => {
                        console.warn('Background music play failed:', e);
                    });
                } else {
                    this.isMusicPlaying = true;
                    this.musicNote.classList.add('active');
                    console.log('Background music started (no promise)');
                }
            }
        } catch (error) {
            console.warn('Background music toggle error:', error);
        }
        
        this.musicLastHit = Date.now();
    }
    
    showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Initialize the game when page loads
window.addEventListener('load', () => {
    new RhythmGame();
});
