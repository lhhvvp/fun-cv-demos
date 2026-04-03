# Marble Aquarium

An interactive 3D visualization of glowing and glass spheres bouncing inside a transparent cube. Built with Three.js and WebGL.

<img src="assets/marbles.png">

## What It Does

- Spheres float and collide in a 3D space
- Some spheres glow with animated lights and colors
- Others are transparent like glass
- Collisions trigger color changes and musical notes
- Camera can be controlled with mouse drag and zoom
- Optional hand tracking with your webcam to control the scene

## Tech Stack

- **Three.js** - 3D graphics and rendering
- **WebGL** - GPU-accelerated graphics
- **Tone.js** - Musical collision sounds
- **MediaPipe Hands** - Webcam hand tracking (optional)
- **Vanilla JavaScript** - No frameworks, just ES6 modules

## File Structure

### Core Files

**`index.html`**  
The main page. Loads all dependencies and sets up the UI controls (sliders for brightness, speed, glow strength, etc).

**`main.js`**  
Entry point that orchestrates everything. Sets up the 3D scene, camera, lighting, and starts the animation loop.

**`config.js`**  
All settings in one place: room size, sphere sizes, speed ranges, color palettes, camera settings, physics values.

### 3D Graphics

**`materials.js`**  
Creates visual materials for spheres and the cube room. Handles the glow shader effects and glass refraction.

**`spheres.js`**  
Creates and manages individual spheres. Generates random positions, assigns colors, adds lights to glowing spheres.

### Physics & Animation

**`physics.js`**  
Collision detection and response. Keeps spheres inside the cube boundaries and handles sphere-to-sphere collisions.

**`animation.js`**  
Updates sphere positions every frame, handles collision events, updates visual effects like pulsing glow.

### Camera & Controls

**`camera.js`**  
Camera movement with smooth inertia and zoom. When you drag and release, the camera keeps spinning for a bit.

**`ui.js`**  
Connects HTML controls to the 3D scene. When you move a slider, this updates the corresponding visual property.

### Audio & Tracking

**`sound-effects.js`**  
Generates musical notes when spheres collide. Uses synthesizers to create tones based on sphere properties.

**`hand-tracking.js`**  
Uses your webcam to detect hand gestures:
- Finger distance controls speed
- Hand tilt rotates the cube
- Closed fist changes color palette
- Index finger height adjusts brightness

## How to Run

1. Open `index.html` in a modern web browser
2. The scene loads automatically with default settings
3. Use the control panel (bottom right) to adjust parameters
4. Click the camera button (bottom left) to enable hand tracking

## Controls

- **Mouse drag** - Rotate camera around the scene
- **Mouse wheel** - Zoom in/out
- **Pause button** - Stop/resume animation
- **Camera button** - Toggle hand tracking
- **Color palette** - Switch between different color themes
- **Sliders** - Adjust sphere count, size, brightness, glow, and speed

## How It Works

1. **Initialization**: Scene, camera, and cube room are created
2. **Sphere Creation**: spheres spawn at random non-overlapping positions
3. **Animation Loop**: Every frame:
   - Update sphere positions based on velocity
   - Check for collisions with walls and other spheres
   - Apply physics responses (bouncing)
   - Update visual effects (pulsing lights, color shifts)
   - Play sounds on collisions
4. **User Input**: Control sliders and hand tracking update properties in real-time