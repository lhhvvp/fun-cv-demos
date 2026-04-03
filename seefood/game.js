import * as THREE from 'three';
import { HandLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';
import { AudioManager } from './audioManager.js';

export class Game {
    constructor(renderDiv) {
        this.renderDiv = renderDiv;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.videoElement = null;
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
        this.smoothingFactor = 0.6; // Alpha for exponential smoothing (0 < alpha <= 1). Smaller = more smoothing.
        
        // Image circle properties
        this.imageCircle = null;
        this.imageTextures = [];
        this.imageSprites = [];
        this.imageRotationSpeed = 0.5; // Rotation speed in radians per second
        this.currentRotation = 0;
        this.minCircleRadius = 40;
        this.maxCircleRadius = 230; // Increased from 150 to 250
        this.imageCount = 6;
        this.imageSize = 150;
        
        // Military HUD radar UI
        this.radarHUD = null;
        this.radarCircle = null;
        this.radarCrosshairs = null;
        this.radarMaterial = null;
        
        // Drag and drop properties
        this.draggedImage = null; // Currently dragged image
        this.draggedImageIndex = -1;
        this.detachedImages = []; // Images that have been dragged away from the circle
        this.isDragging = false;
        this.dragThreshold = 70; // Increased for easier pinch detection
        this.releaseThreshold = 80; // Increased for more stable dragging
        this.dragOffset = new THREE.Vector3(); // Offset between pinch and image center
        
        // Drop zones (positions in screen coordinates)
        this.hotDogBox = {
            x: 0, y: 0, width: 180, height: 100 // Will be updated in _setupDropZones
        };
        this.notHotDogBox = {
            x: 0, y: 0, width: 180, height: 100 // Will be updated in _setupDropZones
        };
        
        // Particle system
        this.particles = [];
        this.particleTextures = {};
        
        // Game state
        this.gameOverOverlay = null;
        this.restartButton = null;
        this.isGameOver = false;
        
        // Initialize asynchronously
        this._init().catch(error => {
            console.error("Initialization failed:", error);
        });
    }
    
    async _init() {
        this._setupDOM();
        this._setupThree();
        this._setupDropZones();
        this._setupGameOverOverlay();
        await this._loadImageTextures();
        await this._loadParticleTextures();
        this._setupImageCircle();
        this._setupRadarHUD();
        await this._setupHandTracking();
        
        // Ensure webcam is playing before starting
        await this.videoElement.play();
        
        window.addEventListener('resize', this._onResize.bind(this));

        this.clock.start();
        this._animate();
    }
    
    _setupDOM() {
        // Get references to existing DOM elements
        this.videoElement = document.getElementById('webcam-video');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        this.restartButton = document.getElementById('restart-button');
    }
    
    _setupGameOverOverlay() {
        if (this.restartButton) {
            this.restartButton.addEventListener('click', () => {
                this._restartGame();
            });
        }
    }
    
    _restartGame() {
        console.log('Restarting game...');
        
        // Reset game state
        this.isGameOver = false;
        this.isDragging = false;
        this.draggedImage = null;
        this.draggedImageIndex = -1;
        this.dragOffset = new THREE.Vector3();
        this.currentRotation = 0;
        
        // Clear particles
        this._clearAllParticles();
        
        // Clear existing image sprites from scene
        this._clearImageSprites();
        
        // Clear existing radar HUD
        this._clearRadarHUD();
        
        // Hide game over overlay
        if (this.gameOverOverlay) {
            this.gameOverOverlay.classList.add('hidden');
        }
        
        // Recreate image circle and radar HUD with fresh images
        this._setupImageCircle();
        this._setupRadarHUD();
        
        console.log('Game restarted successfully');
    }
    
    _clearAllParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            this.scene.remove(particle.sprite);
            particle.sprite.material.dispose();
        }
        this.particles = [];
    }
    
    _clearImageSprites() {
        // Remove all image sprites from scene and imageCircle
        for (let i = this.imageSprites.length - 1; i >= 0; i--) {
            const sprite = this.imageSprites[i];
            
            // Remove from parent (either imageCircle or scene)
            if (sprite.parent) {
                sprite.parent.remove(sprite);
            }
            
            // Dispose material (but keep texture for reuse)
            if (sprite.material) {
                sprite.material.dispose();
            }
        }
        
        // Clear the array
        this.imageSprites = [];
        
        // Clear detached images array
        this.detachedImages = [];
    }
    
    _clearRadarHUD() {
        if (this.radarHUD) {
            this.scene.remove(this.radarHUD);
            
            // Dispose of radar materials and geometries
            this.radarHUD.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    child.material.dispose();
                }
            });
            
            this.radarHUD = null;
            this.radarCircle = null;
            this.radarCrosshairs = null;
            this.radarMaterial = null;
        }
    }
    
    _setupRadarHUD() {
        // Create radar HUD group
        this.radarHUD = new THREE.Group();
        this.radarHUD.visible = false;
        this.scene.add(this.radarHUD);
        
        // Create radar material - green monochrome military style
        this.radarMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff, // Bright military green
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });
        
        // Create the main radar circle (will be resized dynamically)
        this._createRadarCircle(this.minCircleRadius);
        
        // Create dynamic crosshairs and brackets (will be updated with circle size)
        this._createDynamicRadarElements(this.minCircleRadius);
        
        // Create range rings (smaller concentric circles)
        this._createRangeRings();
    }
    
    _createRadarCircle(radius) {
        // Remove existing circle if it exists
        if (this.radarCircle) {
            this.radarHUD.remove(this.radarCircle);
            this.radarCircle.geometry.dispose();
        }
        
        // Create circle geometry
        const circleGeometry = new THREE.RingGeometry(radius - 1, radius + 1, 64);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ccff,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
        
        this.radarCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        this.radarCircle.position.z = -0.1; // Slightly behind images
        this.radarHUD.add(this.radarCircle);
    }
    
    _createDynamicRadarElements(radius) {
        // Remove existing crosshairs and brackets if they exist
        if (this.radarCrosshairs) {
            this.radarHUD.remove(this.radarCrosshairs);
            this.radarCrosshairs.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        
        const dynamicGroup = new THREE.Group();
        
        // Dynamic crosshairs based on circle radius
        const crosshairLength = radius * 1.3;
        
        // Horizontal line
        const horizontalGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-crosshairLength, 0, 0),
            new THREE.Vector3(crosshairLength, 0, 0)
        ]);
        const horizontalLine = new THREE.Line(horizontalGeometry, this.radarMaterial);
        dynamicGroup.add(horizontalLine);
        
        // Vertical line
        const verticalGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -crosshairLength, 0),
            new THREE.Vector3(0, crosshairLength, 0)
        ]);
        const verticalLine = new THREE.Line(verticalGeometry, this.radarMaterial);
        dynamicGroup.add(verticalLine);
        
        // Diagonal lines for more military feel (scaled to radius)
        const diagonalLength = radius * 1.3;
        const diagonal1Geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-diagonalLength, -diagonalLength, 0),
            new THREE.Vector3(diagonalLength, diagonalLength, 0)
        ]);
        const diagonal1Line = new THREE.Line(diagonal1Geometry, this.radarMaterial.clone());
        diagonal1Line.material.opacity = 0.6;
        dynamicGroup.add(diagonal1Line);
        
        const diagonal2Geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-diagonalLength, diagonalLength, 0),
            new THREE.Vector3(diagonalLength, -diagonalLength, 0)
        ]);
        const diagonal2Line = new THREE.Line(diagonal2Geometry, this.radarMaterial.clone());
        diagonal2Line.material.opacity = 0.6;
        dynamicGroup.add(diagonal2Line);
        
        // Dynamic corner brackets based on circle radius
        const bracketSize = radius * 0.2; // Scale bracket size to radius
        const bracketDistance = radius * 1.3; // Scale bracket distance to radius
        
        // Create L-shaped brackets in each corner
        const corners = [
            { x: bracketDistance, y: bracketDistance }, // Top-right
            { x: -bracketDistance, y: bracketDistance }, // Top-left
            { x: -bracketDistance, y: -bracketDistance }, // Bottom-left
            { x: bracketDistance, y: -bracketDistance } // Bottom-right
        ];
        
        corners.forEach((corner, index) => {
            const bracketMaterial = this.radarMaterial.clone();
            bracketMaterial.opacity = 0.6;
            
            // Horizontal part of bracket
            const hPoints = [
                new THREE.Vector3(corner.x, corner.y, 0),
                new THREE.Vector3(corner.x + (corner.x > 0 ? -bracketSize : bracketSize), corner.y, 0)
            ];
            const hGeometry = new THREE.BufferGeometry().setFromPoints(hPoints);
            const hLine = new THREE.Line(hGeometry, bracketMaterial);
            dynamicGroup.add(hLine);
            
            // Vertical part of bracket
            const vPoints = [
                new THREE.Vector3(corner.x, corner.y, 0),
                new THREE.Vector3(corner.x, corner.y + (corner.y > 0 ? -bracketSize : bracketSize), 0)
            ];
            const vGeometry = new THREE.BufferGeometry().setFromPoints(vPoints);
            const vLine = new THREE.Line(vGeometry, bracketMaterial);
            dynamicGroup.add(vLine);
        });
        
        this.radarCrosshairs = dynamicGroup;
        this.radarHUD.add(dynamicGroup);
    }
    
    _createRangeRings() {
        const ringGroup = new THREE.Group();
        const ringCount = 3;
        
        for (let i = 1; i <= ringCount; i++) {
            const ringRadius = (this.maxCircleRadius / ringCount) * i * 0.6;
            const ringGeometry = new THREE.RingGeometry(ringRadius - 0.5, ringRadius + 0.5, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ccff,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.z = -0.2;
            ringGroup.add(ring);
        }
        
        this.radarHUD.add(ringGroup);
    }
    
    _updateRadarHUD(circleRadius) {
        if (!this.radarHUD) return;
        
        // Update the main radar circle size
        this._createRadarCircle(circleRadius);
        
        // Update dynamic crosshairs and brackets based on new radius
        this._createDynamicRadarElements(circleRadius);
        
        // Update radar HUD position to match image circle
        this.radarHUD.position.copy(this.imageCircle.position);
        this.radarHUD.position.z = -1; // Keep it behind the images
        
        // Make radar HUD visible when image circle is visible
        this.radarHUD.visible = this.imageCircle.visible;
    }
    
    _checkGameOver() {
        // Game is over when all images have been classified (imageSprites array is empty)
        if (!this.isGameOver && this.imageSprites.length === 0) {
            this.isGameOver = true;
            this._showGameOver();
        }
    }
    
    _showGameOver() {
        console.log('Game Over!');
        
        if (this.gameOverOverlay) {
            // Remove hidden class to show overlay
            this.gameOverOverlay.classList.remove('hidden');
        }
    }
    
    _setupDropZones() {
        const width = this.renderDiv.clientWidth;
        const height = this.renderDiv.clientHeight;
        
        // Hot dog box (top-right)
        this.hotDogBox = {
            x: width - 200, // 5px margin from right edge
            y: 5, // 5px margin from top
            width: 200,
            height: 200
        };
        
        // Not hot dog box (bottom-right)
        this.notHotDogBox = {
            x: width - 200, // 20px margin from right edge
            y: height - 200, // 20px margin from bottom
            width: 200,
            height: 200
        };
    }
    
    async _loadParticleTextures() {
        const loader = new THREE.TextureLoader();
        
        // Load hot dog texture
        try {
            this.particleTextures.hotdog = await new Promise((resolve, reject) => {
                loader.load(
                    'assets/hotdog.png',
                    (texture) => {
                        texture.generateMipmaps = false;
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        resolve(texture);
                    },
                    undefined,
                    reject
                );
            });
        } catch (error) {
            console.warn('Failed to load hotdog.webp, using placeholder');
            this.particleTextures.hotdog = this._createPlaceholderTexture('🌭');
        }
        
        // Load strawberry texture
        try {
            this.particleTextures.strawberry = await new Promise((resolve, reject) => {
                loader.load(
                    'assets/strawberry.png',
                    (texture) => {
                        texture.generateMipmaps = false;
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        resolve(texture);
                    },
                    undefined,
                    reject
                );
            });
        } catch (error) {
            console.warn('Failed to load strawberry.webp, using placeholder');
            this.particleTextures.strawberry = this._createPlaceholderTexture('🍓');
        }
    }
    
    _createPlaceholderTexture(emoji) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.fillStyle = 'rgba(255, 255, 255, 0)';
        ctx.fillRect(0, 0, 64, 64);
        
        // Draw emoji
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 32, 32);
        
        return new THREE.CanvasTexture(canvas);
    }
    
    _createParticleEffect(x, y, textureKey) {
        const particleCount = 12;
        const texture = this.particleTextures[textureKey];
        
        if (!texture) {
            console.warn(`Particle texture ${textureKey} not found`);
            return;
        }
        
        for (let i = 0; i < particleCount; i++) {
            const material = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.1
            });
            
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(60, 60, 1);
            
            // Position at the effect origin
            sprite.position.set(x, y, 10);
            
            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 800, // Random horizontal velocity
                (Math.random() - 0.5) * 800, // Random vertical velocity
                0
            );
            
            // Particle properties
            const particle = {
                sprite: sprite,
                velocity: velocity,
                life: 1.0,
                fadeSpeed: 0.1 + Math.random() * 0.6, // Random fade speed
                gravity: -200 // Gravity effect
            };
            
            this.particles.push(particle);
            this.scene.add(sprite);
        }
    }
    
    _updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Update position
            particle.sprite.position.add(
                particle.velocity.clone().multiplyScalar(deltaTime)
            );
            
            // Apply gravity
            particle.velocity.y += particle.gravity * deltaTime;
            
            // Update life and opacity
            particle.life -= particle.fadeSpeed * deltaTime;
            particle.sprite.material.opacity = Math.max(0, particle.life);
            
            // Remove dead particles
            if (particle.life <= 0) {
                this.scene.remove(particle.sprite);
                particle.sprite.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }
    
    _checkDropZoneCollision(imageSprite) {
        const worldPos = new THREE.Vector3();
        imageSprite.getWorldPosition(worldPos);
        
        // Convert world coordinates to screen coordinates
        const screenX = worldPos.x + this.renderDiv.clientWidth / 2;
        const screenY = -worldPos.y + this.renderDiv.clientHeight / 2;
        
        // Check collision with hot dog box
        if (screenX >= this.hotDogBox.x && 
            screenX <= this.hotDogBox.x + this.hotDogBox.width &&
            screenY >= this.hotDogBox.y && 
            screenY <= this.hotDogBox.y + this.hotDogBox.height) {
            return 'hotdog';
        }
        
        // Check collision with not hot dog box
        if (screenX >= this.notHotDogBox.x && 
            screenX <= this.notHotDogBox.x + this.notHotDogBox.width &&
            screenY >= this.notHotDogBox.y && 
            screenY <= this.notHotDogBox.y + this.notHotDogBox.height) {
            return 'strawberry';
        }
        
        return null;
    }
    
    async _loadImageTextures() {
        const loader = new THREE.TextureLoader();
        const loadPromises = [];
        
        for (let i = 1; i <= this.imageCount; i++) {
            const loadPromise = new Promise((resolve, reject) => {
                loader.load(
                    `assets/${i}.png`,
                    (texture) => {
                        texture.generateMipmaps = false;
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        console.warn(`Failed to load image ${i}.png, using placeholder`);
                        // Create a colored placeholder texture
                        const canvas = document.createElement('canvas');
                        canvas.width = 64;
                        canvas.height = 64;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = `hsl(${(i * 60) % 360}, 70%, 50%)`;
                        ctx.fillRect(0, 0, 64, 64);
                        ctx.fillStyle = 'white';
                        ctx.font = '32px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(i.toString(), 32, 40);
                        
                        const texture = new THREE.CanvasTexture(canvas);
                        resolve(texture);
                    }
                );
            });
            loadPromises.push(loadPromise);
        }
        
        this.imageTextures = await Promise.all(loadPromises);
        console.log(`Loaded ${this.imageTextures.length} image textures`);
    }
    
    _setupImageCircle() {
        // If imageCircle already exists, remove it from scene first
        if (this.imageCircle) {
            this.scene.remove(this.imageCircle);
        }
        
        this.imageCircle = new THREE.Group();
        this.imageCircle.visible = false;
        this.scene.add(this.imageCircle);
        
        // Clear existing sprites array
        this.imageSprites = [];
        
        // Create sprite materials and sprites with proper aspect ratio
        for (let i = 0; i < this.imageCount; i++) {
            const texture = this.imageTextures[i];
            const material = new THREE.SpriteMaterial({
                map: texture,
                transparent: false,
                alphaTest: 0.1
            });
            
            const sprite = new THREE.Sprite(material);
            
            // Calculate aspect ratio and scale accordingly
            const image = texture.image;
            let aspectRatio = 1;
            
            if (image && image.width && image.height) {
                aspectRatio = image.width / image.height;
            }
            
            // Set sprite scale based on aspect ratio
            if (aspectRatio >= 1) {
                // Wider than tall - scale width to imageSize, adjust height
                sprite.scale.set(this.imageSize, this.imageSize / aspectRatio, 1);
            } else {
                // Taller than wide - scale height to imageSize, adjust width
                sprite.scale.set(this.imageSize * aspectRatio, this.imageSize, 1);
            }
            
            // Add properties to track sprite state
            sprite.userData = {
                originalIndex: i,
                isDetached: false,
                detachedPosition: new THREE.Vector3(),
                circleIndex: i // Store initial circle position index
            };
            
            this.imageCircle.add(sprite);
            this.imageSprites.push(sprite);
        }
    }
    
    _updateImageCircle() {
        if (!this.hands[0] || !this.hands[0].landmarks) {
            this.imageCircle.visible = false;
            // Hide radar HUD when no hand is detected
            if (this.radarHUD) {
                this.radarHUD.visible = false;
            }
            return;
        }

        const landmarks = this.hands[0].landmarks;
        const thumbTip = landmarks[4]; // Thumb tip
        const indexTip = landmarks[8]; // Index finger tip
        const palmCenter = landmarks[9]; // Middle finger MCP (palm center)

        // Calculate distance between thumb tip and index finger tip
        const thumbIndexDistance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2) +
            Math.pow(thumbTip.z - indexTip.z, 2)
        );

        // Map distance to circle radius (smaller distance = smaller circle)
        const normalizedDistance = Math.min(Math.max(thumbIndexDistance, 0.02), 0.15);
        const circleRadius = THREE.MathUtils.mapLinear(
            normalizedDistance,
            0.02, 0.15,
            this.minCircleRadius, this.maxCircleRadius
        );

        // Position circle at palm center
        const width = this.renderDiv.clientWidth;
        const height = this.renderDiv.clientHeight;
        const palmX = (1 - palmCenter.x) * width - width / 2;
        const palmY = (1 - palmCenter.y) * height - height / 2;

        this.imageCircle.position.set(palmX, palmY, 2);
        this.imageCircle.visible = true;

        // Update radar HUD to match
        this._updateRadarHUD(circleRadius);

        // Handle drag interaction with second hand
        this._handleImageDragging();

        // Update rotation
        const deltaTime = this.clock.getDelta();
        this.currentRotation += this.imageRotationSpeed * deltaTime;

        // Position sprites in circle - use original positions, no repositioning
        if (!this.isDragging) {
            for (let i = 0; i < this.imageSprites.length; i++) {
                const sprite = this.imageSprites[i];

                if (!sprite.userData.isDetached && sprite.parent === this.imageCircle) {
                    // Use original circle index based on total image count (preserves gaps)
                    const angle = (sprite.userData.circleIndex / this.imageCount) * Math.PI * 2 + this.currentRotation;
                    const x = Math.cos(angle) * circleRadius;
                    const y = Math.sin(angle) * circleRadius;
                    
                    sprite.position.set(x, y, 0);
                }
            }
        } else {
            // During dragging, only update rotation for non-dragged images
            for (let i = 0; i < this.imageSprites.length; i++) {
                const sprite = this.imageSprites[i];

                if (!sprite.userData.isDetached && sprite.parent === this.imageCircle && sprite !== this.draggedImage) {
                    // Use original circle index based on total image count (preserves gaps)
                    const angle = (sprite.userData.circleIndex / this.imageCount) * Math.PI * 2 + this.currentRotation;
                    const x = Math.cos(angle) * circleRadius;
                    const y = Math.sin(angle) * circleRadius;
                    
                    sprite.position.set(x, y, 0);
                }
            }
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
            this.hands.push({
                landmarks: null,
                anchorPos: new THREE.Vector3(),
                lineGroup: null // Remove line groups since we're not drawing hand lines
            });
        }
        
        // Remove hand line and fingertip materials since we're not using them
        this.handConnections = null;
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
                    } else {
                        hand.landmarks = null;
                    }
                }
                
                // Update the image circle based on first hand
                this._updateImageCircle();
                
            } catch (error) {
                console.error("Error during hand detection:", error);
            }
        }
    }
    
    _handleImageDragging() {
        // Check if second hand is available for dragging
        if (!this.hands[1] || !this.hands[1].landmarks) {
            // Release any current drag if second hand is not detected
            if (this.isDragging) {
                this._releaseDrag();
            }
            return;
        }

        const hand2Landmarks = this.hands[1].landmarks;
        const hand2ThumbTip = hand2Landmarks[4];
        const hand2IndexTip = hand2Landmarks[8];

        // Convert hand2 positions to screen coordinates
        const width = this.renderDiv.clientWidth;
        const height = this.renderDiv.clientHeight;
        const hand2ThumbX = (1 - hand2ThumbTip.x) * width - width / 2;
        const hand2ThumbY = (1 - hand2ThumbTip.y) * height - height / 2;
        const hand2IndexX = (1 - hand2IndexTip.x) * width - width / 2;
        const hand2IndexY = (1 - hand2IndexTip.y) * height - height / 2;

        // Calculate pinch position (midpoint between thumb and index)
        const pinchX = (hand2ThumbX + hand2IndexX) / 2;
        const pinchY = (hand2ThumbY + hand2IndexY) / 2;

        // Calculate pinch distance in screen coordinates (fixed calculation)
        const pinchDistance = Math.sqrt(
            Math.pow(hand2ThumbX - hand2IndexX, 2) +
            Math.pow(hand2ThumbY - hand2IndexY, 2)
        );

        if (!this.isDragging) {
            // Check if pinch is close enough and tight enough to start dragging
            if (pinchDistance < this.dragThreshold) {
                // Find closest image to pinch position
                let closestImage = null;
                let closestDistance = Infinity;
                let closestIndex = -1;

                for (let i = 0; i < this.imageSprites.length; i++) {
                    const sprite = this.imageSprites[i];

                    // Get world position of sprite relative to the imageCircle
                    const worldPos = new THREE.Vector3();
                    sprite.getWorldPosition(worldPos);

                    const distance = Math.sqrt(
                        Math.pow(pinchX - worldPos.x, 2) +
                        Math.pow(pinchY - worldPos.y, 2)
                    );

                    // Use a more generous detection radius
                    const detectionRadius = this.imageSize * 0.6;
                    if (distance < closestDistance && distance < detectionRadius) {
                        closestDistance = distance;
                        closestImage = sprite;
                        closestIndex = i;
                    }
                }

                if (closestImage) {
                    this.draggedImage = closestImage;
                    this.draggedImageIndex = closestIndex;
                    this.isDragging = true;
                    
                    // Store the offset between pinch position and image center
                    const worldPos = new THREE.Vector3();
                    closestImage.getWorldPosition(worldPos);
                    this.dragOffset = new THREE.Vector3(
                        worldPos.x - pinchX,
                        worldPos.y - pinchY,
                        0
                    );
                    
                    console.log(`Started dragging image ${closestIndex} at distance ${closestDistance}`);
                }
            }
        } else {
            // Currently dragging
            if (pinchDistance > this.releaseThreshold) {
                // Release the drag
                this._releaseDrag();
            } else {
                // Update dragged image position
                if (this.draggedImage) {
                    // Calculate new position with offset
                    const newWorldX = pinchX + (this.dragOffset ? this.dragOffset.x : 0);
                    const newWorldY = pinchY + (this.dragOffset ? this.dragOffset.y : 0);
                    
                    // Convert world position to local position relative to imageCircle
                    const localPos = new THREE.Vector3(
                        newWorldX - this.imageCircle.position.x,
                        newWorldY - this.imageCircle.position.y,
                        0
                    );
                    
                    this.draggedImage.position.copy(localPos);
                }
            }
        }
    }
    
    _releaseDrag() {
        if (this.draggedImage && this.isDragging) {
            // Check drop zone collision before deciding what to do
            const dropZone = this._checkDropZoneCollision(this.draggedImage);
            
            if (dropZone) {
                // Image dropped in a zone - create particle effect and remove image
                const worldPos = new THREE.Vector3();
                this.draggedImage.getWorldPosition(worldPos);
                
                // Create particle effect at drop location
                this._createParticleEffect(worldPos.x, worldPos.y, dropZone);
                
                // Remove the image from the scene
                if (this.draggedImage.parent === this.imageCircle) {
                    this.imageCircle.remove(this.draggedImage);
                } else {
                    this.scene.remove(this.draggedImage);
                }
                
                // Remove from imageSprites array
                const index = this.imageSprites.indexOf(this.draggedImage);
                if (index > -1) {
                    this.imageSprites.splice(index, 1);
                }
                
                // Dispose of the image resources
                this.draggedImage.material.dispose();
                
                console.log(`Image ${this.draggedImageIndex} dropped in ${dropZone} zone`);
                
                // Check for game over after removing image
                this._checkGameOver();
                
            } else {
                // Check if image was dragged far enough from circle center to detach
                const distanceFromCenter = this.draggedImage.position.length();
                
                // Calculate current circle radius based on first hand
                let currentRadius = this.minCircleRadius;
                if (this.hands[0] && this.hands[0].landmarks) {
                    const thumbTip = this.hands[0].landmarks[4];
                    const indexTip = this.hands[0].landmarks[8];
                    const thumbIndexDistance = Math.sqrt(
                        Math.pow(thumbTip.x - indexTip.x, 2) +
                        Math.pow(thumbTip.y - indexTip.y, 2) +
                        Math.pow(thumbTip.z - indexTip.z, 2)
                    );
                    const normalizedDistance = Math.min(Math.max(thumbIndexDistance, 0.02), 0.15);
                    currentRadius = THREE.MathUtils.mapLinear(
                        normalizedDistance,
                        0.02, 0.15,
                        this.minCircleRadius, this.maxCircleRadius
                    );
                }
                
                const detachThreshold = currentRadius * 1.2; // Lower threshold for easier detachment
                
                if (distanceFromCenter > detachThreshold) {
                    // Detach the image - convert to world coordinates
                    const worldPos = new THREE.Vector3();
                    this.draggedImage.getWorldPosition(worldPos);
                    
                    this.draggedImage.userData.isDetached = true;
                    this.draggedImage.userData.detachedPosition.copy(worldPos);
                    
                    // Remove from imageCircle and add directly to scene
                    this.imageCircle.remove(this.draggedImage);
                    this.draggedImage.position.copy(worldPos);
                    this.scene.add(this.draggedImage);
                    
                    console.log(`Image ${this.draggedImageIndex} detached at distance ${distanceFromCenter} (threshold: ${detachThreshold})`);
                } else {
                    // Return to circle - image stays in imageCircle
                    console.log(`Image ${this.draggedImageIndex} returned to circle`);
                }
            }
            
            this.draggedImage = null;
            this.draggedImageIndex = -1;
            this.isDragging = false;
            this.dragOffset = new THREE.Vector3();
            console.log('Released drag');
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
        
        // Update drop zone positions
        this._setupDropZones();
    }
    
    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        
        const deltaTime = this.clock.getDelta();
        
        // Update hands continuously
        this._updateHands();
        
        // Update particle system
        this._updateParticles(deltaTime);
        
        // Always render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    start() {
        console.log('Hand tracking initialized and running...');
    }
}