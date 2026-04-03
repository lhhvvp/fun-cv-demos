import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LANES, LANE_WIDTH, PLAYER_START_Z, PLAYER_LANE_CHANGE_COOLDOWN } from './constants.js';

// Player dimensions are now less relevant for the mesh, but keep for jump logic maybe
const PLAYER_HEIGHT = 1.0; // Approximate height for jump logic base
const MODEL_SCALE = 0.6; // Increased scale factor for the Minecraft model (from 0.3)

export class Player {
    constructor() {
        this.mesh = new THREE.Group(); // Use a Group to hold the model
        this.modelLoaded = false; // Flag to track loading
        this.mixer = null; // Animation mixer
        this.runAction = null; // Running animation action
        this.jumpAction = null; // Jump animation action
        this.animations = null; // Store animations from GLTF
        this.currentAnimation = null; // Track current playing animation
        
        const loader = new GLTFLoader();
        loader.load('assets/Stan.gltf', (gltf) => {
            const model = gltf.scene;
            model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
            // Optional: Adjust position within the group if the model's pivot isn't at its base center
            // model.position.y = -PLAYER_HEIGHT / 2; // Example adjustment if needed
            this.mesh.add(model); // Add the loaded model to the group
            
            // Set up animations
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(model);
                this.animations = gltf.animations;
                
                console.log('Available animations:', gltf.animations.map(a => a.name));
                
                // Find the run animation - common names are "run", "Run", "running", "Running", "walk"
                const runAnimation = gltf.animations.find(anim => 
                    anim.name.toLowerCase().includes('run') || 
                    anim.name.toLowerCase().includes('walk') ||
                    anim.name === 'mixamo.com' || // Some models use this default name
                    gltf.animations.length === 1 // If only one animation, assume it's the run
                );
                
                // Find the jump animation - common names are "jump", "Jump", "jumping", "Jumping"
                const jumpAnimation = gltf.animations.find(anim => 
                    anim.name.toLowerCase().includes('jump') ||
                    anim.name.toLowerCase().includes('leap') ||
                    anim.name.toLowerCase().includes('hop')
                );
                
                if (runAnimation) {
                    this.runAction = this.mixer.clipAction(runAnimation);
                    this.runAction.setLoop(THREE.LoopRepeat);
                    console.log(`Found and set up run animation: ${runAnimation.name}`);
                } else {
                    console.log('No run animation found, using first available animation');
                    if (gltf.animations.length > 0) {
                        this.runAction = this.mixer.clipAction(gltf.animations[0]);
                        this.runAction.setLoop(THREE.LoopRepeat);
                    }
                }
                
                if (jumpAnimation) {
                    this.jumpAction = this.mixer.clipAction(jumpAnimation);
                    this.jumpAction.setLoop(THREE.LoopOnce);
                    this.jumpAction.clampWhenFinished = true; // Keep the final pose
                    console.log(`Found and set up jump animation: ${jumpAnimation.name}`);
                } else {
                    console.log('No jump animation found');
                }
            } else {
                console.log('No animations found in the model');
            }
            
            this.modelLoaded = true;
            this.reset(); // Re-apply position/rotation after model is added
        }, undefined, (error) => {
            console.error('An error happened loading the player model:', error);
            // Fallback to a simple cube if loading fails
            const geometry = new THREE.BoxGeometry(0.8, 1.0, 0.8);
            const material = new THREE.MeshStandardMaterial({
                color: 0xff0000
            });
            const fallbackMesh = new THREE.Mesh(geometry, material);
            this.mesh.add(fallbackMesh);
            this.modelLoaded = true; // Mark as loaded (with fallback)
            this.reset();
        });
        
        this.targetLane = 1; // Start in the middle lane (0, 1, 2)
        this.currentLane = 1;
        this.isOnCooldown = false;
        this.cooldownTimer = 0;
        
        // Jump state
        this.isJumping = false;
        this.jumpStartY = PLAYER_HEIGHT / 2; // Base Y position (adjust if needed based on model)
        this.jumpApexY = this.jumpStartY + 2.8;
        this.jumpDuration = 1.2;
        this.jumpTimer = 0;
        
        this.reset(); // Initial reset for the Group position
    }
    
    setTargetLane(laneIndex) {
        const newLane = Math.max(0, Math.min(2, laneIndex)); // Clamp to 0, 1, 2
        // Only allow change if not on cooldown AND the target lane is actually different
        if (!this.isOnCooldown && newLane !== this.targetLane) {
            this.targetLane = newLane;
            this.isOnCooldown = true;
            this.cooldownTimer = PLAYER_LANE_CHANGE_COOLDOWN;
            // console.log(`Changing to lane ${this.targetLane}, Cooldown started.`); // Debugging
        }
    }
    
    jump() {
        // Can only jump if not already jumping
        if (!this.isJumping) {
            this.isJumping = true;
            this.jumpTimer = 0;
            this.playJumpAnimation();
            // console.log("Jump started!"); // Debugging
        }
    }
    
    playJumpAnimation() {
        if (this.jumpAction && this.modelLoaded) {
            // Fade out the current animation and fade in the jump animation
            if (this.currentAnimation && this.currentAnimation !== this.jumpAction) {
                this.currentAnimation.fadeOut(0.1);
            }
            
            this.jumpAction.reset();
            this.jumpAction.fadeIn(0.1);
            this.jumpAction.play();
            this.currentAnimation = this.jumpAction;
            console.log("Jump animation started");
            
            // Set up a listener to return to run animation when jump finishes
            const onJumpFinished = () => {
                this.mixer.removeEventListener('finished', onJumpFinished);
                this.startRunAnimation();
            };
            this.mixer.addEventListener('finished', onJumpFinished);
        }
    }
    
    startRunAnimation() {
        if (this.runAction && this.modelLoaded) {
            // Fade out current animation if it's different
            if (this.currentAnimation && this.currentAnimation !== this.runAction) {
                this.currentAnimation.fadeOut(0.2);
            }
            
            this.runAction.reset();
            this.runAction.fadeIn(0.2);
            this.runAction.play();
            this.currentAnimation = this.runAction;
            console.log("Run animation started");
        }
    }
    
    stopRunAnimation() {
        if (this.runAction) {
            this.runAction.fadeOut(0.2);
            console.log("Run animation stopped");
        }
        if (this.jumpAction) {
            this.jumpAction.fadeOut(0.2);
        }
        this.currentAnimation = null;
    }
    
    reset() {
        this.currentLane = 1;
        this.targetLane = 1;
        this.isOnCooldown = false;
        this.cooldownTimer = 0;
        this.isJumping = false; // Reset jump state
        this.jumpTimer = 0;
        
        // Position the main group (this.mesh)
        this.mesh.position.set(LANES[this.currentLane], this.jumpStartY, PLAYER_START_Z);
        this.mesh.rotation.set(0, 0, 0); // Reset group rotation to face forward initially
        this.mesh.visible = true;
        
        // Reset model's internal rotation if it exists
        if (this.mesh.children[0]) {
            this.mesh.children[0].rotation.y = 0; // Ensure model inside group also faces forward
        }
        
        // Stop any running animations and restart them
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.currentAnimation = null;
            // Small delay to ensure the animation restarts properly
            setTimeout(() => {
                this.startRunAnimation();
            }, 100);
        }
    }
    
    update(deltaTime) {
        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        // --- Cooldown Timer ---
        if (this.isOnCooldown) {
            this.cooldownTimer -= deltaTime;
            if (this.cooldownTimer <= 0) {
                this.isOnCooldown = false;
                this.cooldownTimer = 0;
                // console.log("Cooldown finished."); // Debugging
            }
        }
        
        // --- Jump Physics ---
        if (this.isJumping) {
            this.jumpTimer += deltaTime;
            const jumpProgress = Math.min(1, this.jumpTimer / this.jumpDuration); // 0 to 1
            // Simple parabolic arc: y = startY + 4 * apexDelta * (progress - progress^2)
            const apexDelta = this.jumpApexY - this.jumpStartY;
            this.mesh.position.y = this.jumpStartY + 4 * apexDelta * (jumpProgress - jumpProgress * jumpProgress);
            
            // End jump
            if (this.jumpTimer >= this.jumpDuration) {
                this.isJumping = false;
                this.mesh.position.y = this.jumpStartY; // Snap back to ground
                // Return to run animation if we're not already running it
                if (this.currentAnimation !== this.runAction) {
                    this.startRunAnimation();
                }
                // console.log("Jump ended."); // Debugging
            }
        }
        
        // --- Lane Movement ---
        const targetX = LANES[this.targetLane];
        const moveSpeed = 25.0; // Increased from 15.0 for faster lane switching
        const difference = targetX - this.mesh.position.x;
        
        if (Math.abs(difference) > 0.01) {
            const moveDistance = difference * moveSpeed * deltaTime;
            // Prevent overshooting
            if (Math.abs(moveDistance) > Math.abs(difference)) {
                this.mesh.position.x = targetX;
            } else {
                this.mesh.position.x += moveDistance;
            }
        } else {
            this.mesh.position.x = targetX; // Snap to exact position
            this.currentLane = this.targetLane;
        }
        
        // Keep player at constant Z (game moves towards player)
        this.mesh.position.z = PLAYER_START_Z;
        
        // Vertical position is handled by jump logic if jumping, otherwise stays at start Y
        if (!this.isJumping) {
            this.mesh.position.y = this.jumpStartY;
        }
    }
}