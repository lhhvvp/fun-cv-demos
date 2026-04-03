import * as THREE from 'three';

const PARTICLE_COUNT = 25; // Reduced from 50 to 25
const PARTICLE_LIFETIME = 1.0; // Seconds
const PARTICLE_SPEED_Y = 1.5; // How fast particles rise
const PARTICLE_SPREAD = 1.5; // Increased from 0.8 to 1.5 for wider spread
// Removed PARTICLE_COLOR, will use texture map
const PARTICLE_SIZE = 0.3; // Increased size for textured particles
const PARTICLE_BASE_HEIGHT = 0.3; // Higher starting position above lava/floor

// Load the lava texture once
const textureLoader = new THREE.TextureLoader();
// Use the same asset URL as lavaManager.js
const particleTexture = textureLoader.load('assets/Lava.jpg');

export class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.particleSystems = []; // Active systems
        this.pool = []; // Inactive systems for reuse
    }

    _createParticleSystem() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const lifetimes = new Float32Array(PARTICLE_COUNT);
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * PARTICLE_SPREAD; // x
            positions[i * 3 + 1] = Math.random() * PARTICLE_BASE_HEIGHT; // y (start higher above floor)
            positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_SPREAD; // z
            lifetimes[i] = Math.random() * PARTICLE_LIFETIME; // Initialize with random lifetime offset
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.PointsMaterial({
            map: particleTexture,
            size: PARTICLE_SIZE,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false, // This prevents particles from writing to depth buffer
            depthTest: true,   // But still test against existing depth
            sizeAttenuation: true,
            alphaTest: 0.1     // Discard very transparent pixels
        });
        
        const points = new THREE.Points(geometry, material);
        points.userData.systemLifetime = PARTICLE_LIFETIME; // Store for reference, though particles manage themselves
        points.renderOrder = 1000; // Render after most other objects
        return points;
    }

    getSystem(position) {
        let system;
        if (this.pool.length > 0) {
            system = this.pool.pop();
            system.visible = true;
            // Reset particle positions and lifetimes (important for pooling)
            const positions = system.geometry.attributes.position.array;
            const lifetimes = system.geometry.attributes.lifetime.array;
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                positions[i * 3 + 0] = (Math.random() - 0.5) * PARTICLE_SPREAD;
                positions[i * 3 + 1] = Math.random() * PARTICLE_BASE_HEIGHT; // Start higher
                positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_SPREAD;
                lifetimes[i] = Math.random() * PARTICLE_LIFETIME;
            }
            system.geometry.attributes.position.needsUpdate = true;
            system.geometry.attributes.lifetime.needsUpdate = true;
        } else {
            system = this._createParticleSystem();
        }
        
        // Position the particle system higher above the lava
        const adjustedPosition = position.clone();
        adjustedPosition.y += PARTICLE_BASE_HEIGHT; // Lift the entire system higher
        system.position.copy(adjustedPosition);
        
        this.scene.add(system);
        this.particleSystems.push(system);
        return system;
    }

    returnSystem(system) {
        system.visible = false;
        this.scene.remove(system);
        const index = this.particleSystems.indexOf(system);
        if (index > -1) {
            this.particleSystems.splice(index, 1);
        }
        this.pool.push(system);
    }

    update(deltaTime) {
        for (const system of this.particleSystems) {
            const positions = system.geometry.attributes.position.array;
            const lifetimes = system.geometry.attributes.lifetime.array;
            
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                lifetimes[i] += deltaTime;
                positions[i * 3 + 1] += PARTICLE_SPEED_Y * deltaTime; // Move up
                
                // Reset particle if lifetime exceeded
                if (lifetimes[i] >= PARTICLE_LIFETIME) {
                    lifetimes[i] = 0;
                    positions[i * 3 + 0] = (Math.random() - 0.5) * PARTICLE_SPREAD; // Reset x
                    positions[i * 3 + 1] = Math.random() * PARTICLE_BASE_HEIGHT; // Reset y higher above base
                    positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_SPREAD; // Reset z
                }
            }
            
            system.geometry.attributes.position.needsUpdate = true;
            system.geometry.attributes.lifetime.needsUpdate = true; // Though not used for rendering, helps pooling
        }
    }

    reset() {
        // Move all active systems back to the pool
        while (this.particleSystems.length > 0) {
            this.returnSystem(this.particleSystems[0]);
        }
    }
}