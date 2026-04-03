// main.js
import * as THREE from 'three';
import { HandLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';
import { WhirlpoolShader } from './shaders/whirlpool-shader.js';
import { RippleShader } from './shaders/ripple-shader.js';
import { KaleidoscopeShader } from './shaders/kaleidoscope-shader.js';
import { AsciiShader } from './shaders/ascii-shader.js';

class WebcamShaderApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.videoElement = null;
        this.canvas = null;
        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.hands = [];
        this.videoTexture = null;
        this.trailTexture = null;
        this.renderTarget1 = null;
        this.renderTarget2 = null;
        this.currentTarget = 0;
        this.quad = null;
        this.shaderMaterial = null;
        this.videoAspectRatio = 1.0;
        
        // Shader effects
        this.shaderEffects = {
            whirlpool: new WhirlpoolShader(),
            ripple: new RippleShader(),
            kaleidoscope: new KaleidoscopeShader(),
            ascii: new AsciiShader(),
        };
        this.currentEffect = 'whirlpool';
        
        this.init();
    }

    async init() {
        this.setupDOM();
        this.setupThree();
        this.setupInitialShader();
        await this.setupHandTracking();
        await this.setupWebcam();
        this.setupControls();
        this.animate();
    }

    setupDOM() {
        this.videoElement = document.getElementById('webcam-video');
        this.canvas = document.getElementById('shader-canvas');
        
        if (!this.videoElement || !this.canvas) {
            console.error('Required DOM elements not found');
            return;
        }
    }

    setupThree() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: false,
            antialias: false
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Create render targets for ping-pong effect
        this.renderTarget1 = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType
        });

        this.renderTarget2 = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType
        });

        // Create fullscreen quad
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.quad = new THREE.Mesh(geometry, null);
        this.scene.add(this.quad);

        window.addEventListener('resize', this.onResize.bind(this));
    }

    setupInitialShader() {
        const effect = this.shaderEffects[this.currentEffect];
        this.shaderMaterial = effect.createMaterial();
        
        // Set common uniforms
        this.shaderMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
        this.shaderMaterial.uniforms.uScreenAspectRatio.value = window.innerWidth / window.innerHeight;
        
        this.quad.material = this.shaderMaterial;
    }

    switchEffect(effectName) {
        if (this.shaderEffects[effectName]) {
            this.currentEffect = effectName;
            const effect = this.shaderEffects[effectName];
            
            // Store current video texture and other common uniforms
            const videoTexture = this.shaderMaterial.uniforms.uVideo.value;
            const trailTexture = this.shaderMaterial.uniforms.uTrail.value;
            const resolution = this.shaderMaterial.uniforms.uResolution.value.clone();
            const screenAspectRatio = this.shaderMaterial.uniforms.uScreenAspectRatio.value;
            const videoAspectRatio = this.shaderMaterial.uniforms.uVideoAspectRatio.value;
            
            // Create new material
            this.shaderMaterial = effect.createMaterial();
            
            // Restore common uniforms
            this.shaderMaterial.uniforms.uVideo.value = videoTexture;
            this.shaderMaterial.uniforms.uTrail.value = trailTexture;
            this.shaderMaterial.uniforms.uResolution.value = resolution;
            this.shaderMaterial.uniforms.uScreenAspectRatio.value = screenAspectRatio;
            this.shaderMaterial.uniforms.uVideoAspectRatio.value = videoAspectRatio;
            
            // Update quad material
            this.quad.material = this.shaderMaterial;
            
            // Update controls UI
            this.updateControlsUI();
        }
    }

    updateControlsUI() {
        const effect = this.shaderEffects[this.currentEffect];
        const controls = effect.getControls();
        
        // Update control labels and values
        const controlGroups = document.querySelectorAll('.control-group');
        controlGroups.forEach((group, index) => {
            if (controls[index]) {
                const label = group.querySelector('label');
                const slider = group.querySelector('input[type="range"]');
                const valueDisplay = group.querySelector('.value-display');
                
                label.textContent = controls[index].label;
                slider.min = controls[index].min;
                slider.max = controls[index].max;
                slider.step = controls[index].step;
                slider.value = controls[index].value;
                valueDisplay.textContent = controls[index].value;
                
                // Update slider ID for event handling
                slider.id = controls[index].id;
                valueDisplay.id = controls[index].id + '-value';
            }
        });
    }

    async setupHandTracking() {
        try {
            console.log("Setting up hand tracking...");
            const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
            
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: 'GPU'
                },
                numHands: 2,
                runningMode: 'VIDEO'
            });
            
            console.log("Hand tracking initialized");
        } catch (error) {
            console.error('Error setting up hand tracking:', error);
        }
    }

    async setupWebcam() {
        try {
            console.log("Requesting webcam access...");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            this.videoElement.srcObject = stream;
            
            return new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    
                    // Calculate and store video aspect ratio
                    this.videoAspectRatio = this.videoElement.videoWidth / this.videoElement.videoHeight;
                    
                    // Create video texture with proper format
                    this.videoTexture = new THREE.VideoTexture(this.videoElement);
                    this.videoTexture.minFilter = THREE.LinearFilter;
                    this.videoTexture.magFilter = THREE.LinearFilter;
                    this.videoTexture.format = THREE.RGBAFormat;
                    this.videoTexture.generateMipmaps = false;
                    this.videoTexture.flipY = false;
                    
                    this.shaderMaterial.uniforms.uVideo.value = this.videoTexture;
                    this.shaderMaterial.uniforms.uVideoAspectRatio.value = this.videoAspectRatio;
                    
                    console.log(`Webcam initialized - Video aspect ratio: ${this.videoAspectRatio.toFixed(2)}`);
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error accessing webcam:', error);
        }
    }

    setupControls() {
        // Effect selector
        const effectSelector = document.getElementById('effect-select');
        effectSelector.addEventListener('change', (e) => {
            this.switchEffect(e.target.value);
        });

        // Parameter controls
        const controlsContainer = document.getElementById('controls');
        controlsContainer.addEventListener('input', (e) => {
            if (e.target.type === 'range') {
                const effect = this.shaderEffects[this.currentEffect];
                effect.updateParameter(e.target.id, parseFloat(e.target.value), this.shaderMaterial);
                
                // Update value display
                const valueDisplay = document.getElementById(e.target.id + '-value');
                if (valueDisplay) {
                    const decimals = e.target.step.includes('.') ? e.target.step.split('.')[1].length : 0;
                    valueDisplay.textContent = parseFloat(e.target.value).toFixed(decimals);
                }
            }
        });
    }

    updateHands() {
        if (!this.handLandmarker || !this.videoElement.srcObject || this.videoElement.readyState < 2) {
            return;
        }

        const videoTime = this.videoElement.currentTime;
        if (videoTime > this.lastVideoTime) {
            this.lastVideoTime = videoTime;
            
            try {
                const results = this.handLandmarker.detectForVideo(this.videoElement, performance.now());
                
                this.hands = [];
                
                if (results.landmarks) {
                    for (let i = 0; i < Math.min(results.landmarks.length, 2); i++) {
                        const landmarks = results.landmarks[i];
                        const palm = landmarks[9]; // Middle finger MCP
                        
                        // Convert to normalized coordinates (0-1) and match webcam orientation
                        const handPos = new THREE.Vector2(1.0 - palm.x, 1.0 - palm.y);
                        this.hands.push(handPos);
                    }
                }

                // Update shader uniforms
                this.shaderMaterial.uniforms.uHandCount.value = this.hands.length;
                for (let i = 0; i < 2; i++) {
                    if (i < this.hands.length) {
                        this.shaderMaterial.uniforms.uHandPositions.value[i].copy(this.hands[i]);
                    }
                }
            } catch (error) {
                console.error("Error during hand detection:", error);
            }
        }
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.renderer.setSize(width, height);
        this.shaderMaterial.uniforms.uResolution.value.set(width, height);
        this.shaderMaterial.uniforms.uScreenAspectRatio.value = width / height;

        this.renderTarget1.setSize(width, height);
        this.renderTarget2.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        this.updateHands();

        if (this.videoTexture) {
            this.videoTexture.needsUpdate = true;
        }

        // Update time uniform
        this.shaderMaterial.uniforms.uTime.value = performance.now() * 0.001;

        // Initialize trail texture if needed
        if (!this.shaderMaterial.uniforms.uTrail.value) {
            this.shaderMaterial.uniforms.uTrail.value = this.renderTarget1.texture;
        }

        // Ping-pong rendering for trail effect
        const currentRenderTarget = this.currentTarget === 0 ? this.renderTarget1 : this.renderTarget2;
        const previousRenderTarget = this.currentTarget === 0 ? this.renderTarget2 : this.renderTarget1;

        this.shaderMaterial.uniforms.uTrail.value = previousRenderTarget.texture;

        // Render to current target
        this.renderer.setRenderTarget(currentRenderTarget);
        this.renderer.render(this.scene, this.camera);

        // Render to screen
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);

        // Swap targets
        this.currentTarget = 1 - this.currentTarget;
    }
}

// Initialize the app
const app = new WebcamShaderApp();