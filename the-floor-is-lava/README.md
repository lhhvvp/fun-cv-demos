# The Floor is Lava

This is a web game that uses computer vision and body movement tracking to control a 3D character.

Players move their body left/right and jump in real life to avoid lava obstacles on a 3-lane track.

Built with threejs and mediapipe computer vision, and HTML/CSS/JS.

[Video](https://youtu.be/gi5sFJbjR6o) | [Live Demo](https://www.funwithcomputervision.com/demo7/)

## File Overview:

**Core Game Files:**
- `main.js` - Entry point, handles UI, webcam setup, and game initialization
- `game.js` - Main game loop, manages all systems and collision detection
- `player.js` - Player character with 3D model, animations, and movement logic
- `constants.js` - Game configuration (speeds, dimensions, timings)

**Game Systems:**
- `lavaManager.js` - Spawns and manages lava obstacles
- `ParticleManager.js` - Creates lava particle effects using object pooling
- `sceneSetup.js` - Sets up 3D scene, lighting, camera, and floor

**Input/Control:**
- `poseTracker.js` - Uses MediaPipe to track body movement data via webcam for in-game controls

**UI/Styling:**
- `index.html` - Webpage structure
- `styles.css` - Styling for all game screens and UI elements

## Setup for Development

```bash
# Navigate to the project sub-folder
#(follow the steps on the main page to clone all files if you haven't already done so)
cd the-floor-is-lava

# Serve with your preferred method (example using Python)
python -m http.server

# Use your browser and go to:
http://localhost:8000
```

## Requirements

- Modern web browser with WebGL support
- Camera access

## Technologies

- **Three.js** for 3D rendering
- **MediaPipe** for body movement tracking
- **HTML5 Canvas** for visual feedback
- **JavaScript** for real-time interaction

## Key Learnings

[work in progress, to be added]