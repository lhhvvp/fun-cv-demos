import * as THREE from 'three';
import { LANES, LANE_WIDTH, PLATFORM_DEPTH, INITIAL_GAME_SPEED, MAX_GAME_SPEED, GAME_SPEED_INCREASE_RATE, GAME_AREA_LENGTH } from './constants.js';
import { ParticleManager } from './ParticleManager.js'; // Import ParticleManager

const LAVA_COLOR = 0xff0000;
const LAVA_EMISSIVE = 0xcc0000;
const LAVA_INTENSITY = 1.0;
const LAVA_HEIGHT = 0.01; // Slightly above platform y=0 plane

// Texture Loading
const textureLoader = new THREE.TextureLoader();
const lavaTexture = textureLoader.load('assets/Lava.jpg');
lavaTexture.wrapS = THREE.RepeatWrapping;
lavaTexture.wrapT = THREE.RepeatWrapping;
lavaTexture.repeat.set(1, 1); // Adjust repeat as needed

const LAVA_GEOMETRY = new THREE.PlaneGeometry(LANE_WIDTH * 0.9, PLATFORM_DEPTH); // Matches platform footprint
const LAVA_MATERIAL = new THREE.MeshStandardMaterial({
    map: lavaTexture,
    // color: LAVA_COLOR, // Can keep or remove color tint
    emissive: LAVA_EMISSIVE,
    emissiveMap: lavaTexture,
    emissiveIntensity: LAVA_INTENSITY * 0.6,
    side: THREE.DoubleSide
});

// Rotate geometry once instead of each mesh instance
LAVA_GEOMETRY.rotateX(-Math.PI / 2);

const INITIAL_SPAWN_INTERVAL = 4.0; // Decreased from 10.0: Start spawning more frequently
const MIN_SPAWN_INTERVAL = 0.9; // Decreased from 2.0: Minimum interval is faster
const SPAWN_INTERVAL_DECREMENT = 0.25;

export class LavaManager {
    constructor(scene) {
        this.scene = scene;
        this.lavaHazards = [];
        this.pool = []; // Object pool for lava meshes
        this.spawnTimer = 0;
        this.spawnInterval = INITIAL_SPAWN_INTERVAL; // Use constant
        this.nextSpawnZ = -GAME_AREA_LENGTH / 2;
        this.particleManager = new ParticleManager(scene); // Instantiate ParticleManager
    }

    reset() {
        // Remove existing lava and their particles
        this.lavaHazards.forEach(lava => {
            if (lava.userData.particleSystem) {
                this.particleManager.returnSystem(lava.userData.particleSystem);
            }
            lava.visible = false;
            this.scene.remove(lava);
            this.pool.push(lava);
        });
        this.lavaHazards = [];
        this.particleManager.reset(); // Reset particles
        this.spawnTimer = INITIAL_SPAWN_INTERVAL * 0.75;
        this.nextSpawnZ = -GAME_AREA_LENGTH / 2;
        this.spawnInterval = INITIAL_SPAWN_INTERVAL;
    }

    _createLavaMesh() {
        if (this.pool.length > 0) {
            const lava = this.pool.pop();
            lava.visible = true;
            return lava;
        } else {
            // Geometry is already rotated
            const lava = new THREE.Mesh(LAVA_GEOMETRY, LAVA_MATERIAL);
            return lava;
        }
    }

    _spawnLava(targetZ) {
        const lava = this._createLavaMesh();
        const lane = Math.floor(Math.random() * 3); // Random lane 0, 1, 2
        // Position slightly above the platform plane (Y=0)
        lava.position.set(LANES[lane], LAVA_HEIGHT, targetZ);
        lava.userData.lane = lane;
        // Create and attach particle system - position it well above the lava surface
        const particlePosition = lava.position.clone().add(new THREE.Vector3(0, 0.4, 0)); // Position particles significantly higher above lava
        lava.userData.particleSystem = this.particleManager.getSystem(particlePosition);
        this.scene.add(lava);
        this.lavaHazards.push(lava);
    }

    update(deltaTime, playerZ, currentSpeed) {
        this.particleManager.update(deltaTime); // Update particles first
        // --- Spawning ---
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
            // Spawn new lava ahead of the player
            const spawnZ = playerZ - GAME_AREA_LENGTH * 0.9; // Spawn far ahead
            this._spawnLava(spawnZ);
            this.spawnTimer = 0; // Reset timer
            // Decrease spawn interval for next time, down to the minimum
            // Ensure we use the updated MIN_SPAWN_INTERVAL here as well
            if (this.spawnInterval > MIN_SPAWN_INTERVAL) {
                this.spawnInterval = Math.max(MIN_SPAWN_INTERVAL, this.spawnInterval - SPAWN_INTERVAL_DECREMENT);
                // console.log("New Lava Spawn Interval:", this.spawnInterval.toFixed(2)); // Debugging
            }
        }
        // --- Movement & Despawning ---
        for (let i = this.lavaHazards.length - 1; i >= 0; i--) {
            const lava = this.lavaHazards[i];
            // Move lava and its particles together
            const moveZ = currentSpeed * deltaTime;
            lava.position.z += moveZ;
            if (lava.userData.particleSystem) {
                lava.userData.particleSystem.position.z += moveZ;
            }
            // Despawn lava that has gone past the player
            if (lava.position.z > playerZ + PLATFORM_DEPTH * 2) {
                if (lava.userData.particleSystem) {
                    this.particleManager.returnSystem(lava.userData.particleSystem);
                    lava.userData.particleSystem = null; // Clear reference
                }
                lava.visible = false;
                this.scene.remove(lava);
                this.pool.push(lava);
                this.lavaHazards.splice(i, 1);
            }
        }
    }

    // Updated signature to accept the full player object
    checkCollision(player) {
        const playerPosition = player.mesh.position;
        const playerIsJumping = player.isJumping;
        const JUMP_CLEARANCE_HEIGHT = 0.3; // Player Y must be above this relative to ground to clear lava
        
        // Check collision against each active lava hazard
        for (const lava of this.lavaHazards) {
            const laneX = LANES[lava.userData.lane];
            // Check X: Is the player horizontally overlapping with this lava's lane?
            if (Math.abs(playerPosition.x - laneX) < LANE_WIDTH / 2 * 0.9) {
                const lavaStartZ = lava.position.z - PLATFORM_DEPTH / 2;
                const lavaEndZ = lava.position.z + PLATFORM_DEPTH / 2;
                // Check Z: Does the player's Z position overlap with the lava's Z extent?
                if (playerPosition.z >= lavaStartZ && playerPosition.z <= lavaEndZ) {
                    // Check Y / Jump Status: Is the player jumping high enough?
                    if (playerIsJumping && playerPosition.y > player.jumpStartY + JUMP_CLEARANCE_HEIGHT) {
                        continue; // Check the next lava patch
                    } else {
                        // Player is either not jumping, or jumping but too low
                        // console.log(`Lava collision detected: Player(x:${playerPosition.x.toFixed(1)}, y:${playerPosition.y.toFixed(1)}, z:${playerPosition.z.toFixed(1)}) Lava(lane:${lava.userData.lane}, zStart:${lavaStartZ.toFixed(1)}, zEnd:${lavaEndZ.toFixed(1)})`);
                        return true; // Collision detected
                    }
                }
            }
        }
        return false; // No collision detected
    }
}