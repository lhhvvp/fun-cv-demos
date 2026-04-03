import * as THREE from 'three';
import { Game } from './game.js';
import { PoseTracker } from './poseTracker.js';

// Get the render target
const renderDiv = document.getElementById('renderDiv');

// --- UI Elements ---
// Create container for instructions and camera view
const uiContainer = document.createElement('div');
uiContainer.className = 'ui-container hidden'; // Start hidden
renderDiv.appendChild(uiContainer);

// --- Start Screen ---
const startScreenContainer = document.createElement('div');
startScreenContainer.className = 'start-screen';
renderDiv.appendChild(startScreenContainer);

const startTitle = document.createElement('h2');
startTitle.textContent = 'The Floor is Lava';
startTitle.className = 'start-title';
startScreenContainer.appendChild(startTitle);

const startInstructions = document.createElement('p');
startInstructions.className = 'start-instructions';
startInstructions.innerHTML = `
    📸 Allow webcam access<br/>
    🧍 Stand back<br/>
    🤸 Move left/right or jump!<br/>
    ♨️ Avoid the lava<br/>
    🏎️ The game gets faster as you go on
`;
startScreenContainer.appendChild(startInstructions);

const startStatusText = document.createElement('p');
startStatusText.textContent = 'Initializing - Please wait...';
startStatusText.className = 'start-status';
startScreenContainer.appendChild(startStatusText);

const startButton = document.createElement('button');
startButton.textContent = 'Start Game';
startButton.className = 'game-button start-button';
startButton.disabled = true;
startScreenContainer.appendChild(startButton);

// Game Over Screen container (initially hidden)
const gameOverContainer = document.createElement('div');
gameOverContainer.className = 'game-over-screen';
renderDiv.appendChild(gameOverContainer);

const gameOverText = document.createElement('h2');
gameOverText.textContent = 'Game Over!';
gameOverText.className = 'game-over-title';
gameOverContainer.appendChild(gameOverText);

const finalScoreText = document.createElement('p');
finalScoreText.className = 'final-score';
gameOverContainer.appendChild(finalScoreText);

const restartButton = document.createElement('button');
restartButton.textContent = 'Restart';
restartButton.className = 'game-button restart-button';
gameOverContainer.appendChild(restartButton);

const scoreElement = document.createElement('span');
scoreElement.textContent = 'Score: 0';
scoreElement.className = 'score-element';

const videoElement = document.createElement('video');
videoElement.className = 'video-element';
videoElement.autoplay = true;
videoElement.playsInline = true;
uiContainer.appendChild(videoElement);

// --- Score Container Setup ---
const scoreContainer = document.createElement('div');
scoreContainer.className = 'score-container hidden'; // Start hidden
renderDiv.appendChild(scoreContainer);
scoreContainer.appendChild(scoreElement);

// --- Initialization ---
let game = null;
let poseTracker = null;

// Variables for pose-based jump detection
let restingShoulderY = null;
const JUMP_DETECTION_THRESHOLD = 0.06;
let poseJumpCooldownTimer = 0;
const POSE_JUMP_COOLDOWN = 0.7;

async function initializeGame() {
    try {
        startStatusText.textContent = 'Setting up camera and pose detection... Allow camera access.';
        poseTracker = new PoseTracker(videoElement, handlePoseUpdate);
        await poseTracker.initialize();
        
        startStatusText.textContent = 'Ready!';
        startButton.disabled = false;
    } catch (error) {
        console.error("Initialization failed:", error);
        startStatusText.textContent = `Error: ${error.message}. Please refresh.`;
        startButton.disabled = true;
        startButton.textContent = 'Error';
        if (game) game.stop();
    }
}

// --- Keyboard Controls ---
function handleKeyDown(event) {
    if (game && game.isRunning()) {
        switch(event.key) {
            case 'ArrowLeft':
            case 'a':
                const currentLaneLeft = game.getPlayer().targetLane;
                game.getPlayer().setTargetLane(currentLaneLeft - 1);
                break;
            case 'ArrowRight':
            case 'd':
                const currentLaneRight = game.getPlayer().targetLane;
                game.getPlayer().setTargetLane(currentLaneRight + 1);
                break;
        }
    }
}

function handlePoseUpdate(normX, normShoulderY) {
    if (game && game.isRunning()) {
        const player = game.getPlayer();
        if (!player) return;
        
        // --- Horizontal Lane Switching ---
        const mirroredNormX = 1.0 - normX;
        if (mirroredNormX < 0.35) {
            player.setTargetLane(0);
        } else if (mirroredNormX > 0.65) {
            player.setTargetLane(2);
        } else {
            player.setTargetLane(1);
        }
        
        // --- Vertical Jump Detection ---
        if (poseJumpCooldownTimer > 0) {
            poseJumpCooldownTimer -= 1 / 60;
        }
        
        if (restingShoulderY === null && normShoulderY > 0 && normShoulderY < 1) {
            restingShoulderY = normShoulderY;
            console.log("Resting shoulder Y established:", restingShoulderY.toFixed(2));
        }
        
        if (restingShoulderY !== null && poseJumpCooldownTimer <= 0) {
            const yDifference = restingShoulderY - normShoulderY;
            if (yDifference > JUMP_DETECTION_THRESHOLD) {
                player.jump();
                poseJumpCooldownTimer = POSE_JUMP_COOLDOWN;
                restingShoulderY = normShoulderY + JUMP_DETECTION_THRESHOLD * 0.5;
            } else if (normShoulderY > restingShoulderY + JUMP_DETECTION_THRESHOLD * 0.5 && !player.isJumping) {
                restingShoulderY = restingShoulderY * 0.99 + normShoulderY * 0.01;
            }
        }
    }
}

function updateScoreDisplay(score) {
    scoreElement.innerHTML = `Score:<br>${score}`;
}

function showGameOverScreen(finalScore) {
    finalScoreText.textContent = `Final Score: ${Math.floor(finalScore)}`;
    gameOverContainer.classList.remove('hidden');
    gameOverContainer.classList.add('visible');
    uiContainer.classList.add('hidden');
    scoreContainer.classList.add('hidden');
    
    console.log("Game over screen shown with score:", Math.floor(finalScore));
}

function hideGameOverScreen() {
    gameOverContainer.classList.add('hidden');
    gameOverContainer.classList.remove('visible');
    uiContainer.classList.remove('hidden');
    scoreContainer.classList.remove('hidden');
}

function resetGameSession() {
    // Reset pose tracking variables
    restingShoulderY = null;
    poseJumpCooldownTimer = 0;
    
    // Reset score display to 0 immediately
    updateScoreDisplay(0);
    
    console.log("Game session reset");
}

// Restart Button Logic
restartButton.addEventListener('click', () => {
    console.log("Restart button clicked");
    
    if (game) {
        // Disable restart button temporarily to prevent double-clicks
        restartButton.disabled = true;
        restartButton.textContent = 'Restarting...';
        
        // Stop current game completely
        game.stop();
        
        // Wait a brief moment to ensure everything is stopped
        setTimeout(() => {
            // Hide game over screen and show game UI
            hideGameOverScreen();
            
            // Reset session variables
            resetGameSession();
            
            // Start new game
            game.start();
            
            // Re-enable restart button
            restartButton.disabled = false;
            restartButton.textContent = 'Restart';
            
            console.log("Game restarted successfully");
        }, 100); // Short delay to ensure cleanup
    }
});

// Start Button Logic
startButton.addEventListener('click', () => {
    console.log("Start button clicked");
    
    startScreenContainer.classList.add('hidden');
    uiContainer.classList.remove('hidden');
    scoreContainer.classList.remove('hidden');
    
    // Create new game instance
    game = new Game(renderDiv, updateScoreDisplay, showGameOverScreen);
    
    // Reset session and start game
    resetGameSession();
    game.start();
    hideGameOverScreen();
});

// Start initialization
initializeGame();

// Add keyboard listener
window.addEventListener('keydown', handleKeyDown);