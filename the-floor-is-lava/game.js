import * as THREE from 'three';
import { SceneSetup } from './sceneSetup.js';
import { Player } from './player.js';
// Removed PlatformManager import
import { LavaManager } from './lavaManager.js'; // Import LavaManager
import { LANES, LANE_WIDTH, INITIAL_GAME_SPEED, MAX_GAME_SPEED, GAME_SPEED_INCREASE_RATE } from './constants.js'; // Import speed constants

export class Game {
    constructor(renderDiv, updateScoreCallback, showGameOverCallback) {
        this.renderDiv = renderDiv;
        this.updateScoreCallback = updateScoreCallback; // Store the score callback
        this.showGameOverCallback = showGameOverCallback; // Store the game over callback
        this.sceneSetup = new SceneSetup(renderDiv);
        this.scene = this.sceneSetup.scene;
        this.camera = this.sceneSetup.camera;
        this.renderer = this.sceneSetup.renderer;
        this.player = new Player();
        this.scene.add(this.player.mesh);
        // Removed PlatformManager instantiation
        this.lavaManager = new LavaManager(this.scene); // Instantiate LavaManager
        this.clock = new THREE.Clock();
        this.running = false;
        this.gameOver = false;
        this.score = 0; // Add score property
        this.currentSpeed = INITIAL_GAME_SPEED; // Add current speed state
        this.animationId = null; // Track animation frame ID
        this._update = this._update.bind(this);
        window.addEventListener('resize', this._onWindowResize.bind(this), false);
    }

    start() {
        console.log("Game starting...");
        
        // FORCE STOP any existing game loop first
        this._stopGameLoop();
        
        // Wait a frame to ensure any pending updates complete
        requestAnimationFrame(() => {
            // Reset all game state completely
            this._resetGameState();
            
            // Update display with reset score
            this.updateScoreCallback(this.score);
            
            // Start the game loop
            this.running = true;
            this.gameOver = false;
            this.clock.start(); // Restart the clock
            this._update();
            
            console.log("Game loop started with ID:", this.animationId);
        });
    }

    stop() {
        console.log("Game stopping...");
        this._stopGameLoop();
        this.gameOver = true;
        // Preserve current speed and score for game over display
    }

    _stopGameLoop() {
        this.running = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            console.log("Game loop cancelled");
        }
    }

    _resetGameState() {
        // Reset all game variables to initial state
        this.score = 0;
        this.currentSpeed = INITIAL_GAME_SPEED;
        this.running = false; // Will be set to true after reset
        this.gameOver = false;
        
        // Reset all game components
        this.lavaManager.reset();
        this.player.reset();
        this.sceneSetup.resetAppearance();
        this.sceneSetup.resetCamera();
        
        // Reset the clock
        this.clock.stop();
        this.clock = new THREE.Clock(); // Create a fresh clock
        
        console.log("Game state reset - Score:", this.score, "Speed:", this.currentSpeed);
    }

    isRunning() {
        return this.running && !this.gameOver;
    }

    getPlayer() {
        return this.player;
    }

    _update() {
        // Store the animation ID immediately
        this.animationId = requestAnimationFrame(this._update);
        
        // Exit immediately if not running
        if (!this.running || this.gameOver) {
            this._stopGameLoop();
            return;
        }
        
        const deltaTime = this.clock.getDelta();
        
        // Double-check running state after getting delta time
        if (!this.running || this.gameOver) {
            this._stopGameLoop();
            return;
        }
        
        // Increase speed over time
        this.currentSpeed = Math.min(MAX_GAME_SPEED, this.currentSpeed + GAME_SPEED_INCREASE_RATE * deltaTime);
        
        // Update game objects
        this.player.update(deltaTime);
        this.lavaManager.update(deltaTime, this.player.mesh.position.z, this.currentSpeed);
        
        // Update Score
        const SCORE_RATE = 10; // Points per second
        this.score += deltaTime * SCORE_RATE;
        this.updateScoreCallback(Math.floor(this.score));
        
        // Collision Checks / Game Over Conditions
        const hitLava = this.lavaManager.checkCollision(this.player);
        
        if (hitLava) {
            console.log("Game Over - Hit Lava! Final Score:", Math.floor(this.score), "Final Speed:", this.currentSpeed.toFixed(2));
            this.gameOver = true;
            this.running = false;
            this._stopGameLoop(); // Immediately stop the loop
            this.sceneSetup.setGameOverBackground();
            this.showGameOverCallback(this.score);
            return; // Exit immediately
        }
        
        // Adjust camera to follow player's lane smoothly
        const targetCameraX = LANES[this.player.currentLane];
        const cameraFollowSpeed = 0.4;
        this.camera.position.x += (targetCameraX - this.camera.position.x) * cameraFollowSpeed;
        
        // Update Directional Light Position and Target
        const dirLight = this.sceneSetup.directionalLight;
        if (dirLight) {
            dirLight.position.copy(this.camera.position);
            dirLight.target.position.copy(this.player.mesh.position);
            dirLight.target.updateMatrixWorld();
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    _onWindowResize() {
        this.sceneSetup.updateSize();
    }
}