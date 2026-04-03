# AR Voxel Editor

A web-based Augmented Reality experiment that lets you build and destroy 3D voxel structures using only your hands. It runs entirely in the browser, using computer vision to track finger movements for drawing, rotating, and interacting with physics.

## Features

*   **Handless UI:** No mouse or keyboard required. All interactions—from drawing to clicking buttons—are controlled via hand gestures.
*   **3D Axis Locking:** Creates clean, straight lines by analyzing hand movement in 3D space and snapping to the dominant X, Y, or Z axis.
*   **Hybrid Physics System:** Blocks are static and optimized while building, but instantly convert to dynamic rigid bodies with mass and collision detection in "Destroy Mode."
*   **Neon Aesthetics:** Real-time lighting with refraction and reflection effects.
*   **Two-Handed Navigation:** Natural "pinch-to-zoom" and orbit mechanics using both hands simultaneously.

## How to Use

| Action | Gesture |
| :--- | :--- |
| **Draw Blocks** | Pinch thumb and index finger together and drag. The system will lock to the direction you move most. |
| **Extrude Face** | Start a pinch *on top* of an existing block to pull a new line out from that specific face. |
| **Rotate Camera** | Pinch with **both** hands simultaneously and move them to orbit the center. |
| **Switch Modes** | Hover your index finger over the "CREATE/DESTROY" button. Hold it there for a moment to trigger the press. |
| **Physics Interaction** | In **Destroy Mode**, simply poke or sweep your hand through blocks to knock them over. |

## Technical Stack

*   **[Three.js](https://threejs.org/):** Handles the 3D rendering, scene graph, lighting, and materials.
*   **[MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker):** Google's machine learning pipeline for real-time, high-fidelity hand and finger tracking directly in the browser.
*   **[Rapier](https://rapier.rs/):** A high-performance physics engine (compiled to WebAssembly) that handles the collisions and rigid body dynamics in Destroy Mode.

## Key Logic & Techniques

### 1. World-Space Axis Locking
Drawing in 3D with a 2D screen is usually difficult. This project solves it by calculating the 3D vector between the start of a pinch and the current hand position. It determines the dominant axis (X, Y, or Z) based on world coordinates, not screen pixels. This allows users to draw "depth" (Z-axis) simply by moving their hand toward the camera.

### 2. Input Smoothing (Lerp)
Raw data from webcam tracking can be jittery. The app applies Linear Interpolation (Lerp) to the hand coordinates. This creates a "smoothed" cursor position that lags slightly behind the raw input, resulting in cleaner drawings and less accidental noise.

### 3. State-Based Entity Management
*   **Create Mode:** Voxels are lightweight static meshes. This keeps performance high when rendering hundreds of blocks.
*   **Destroy Mode:** The static meshes are removed and replaced with Rapier RigidBodies. This allows for complex physics interactions (gravity, friction, impulse) only when necessary, saving CPU resources during the building phase.

### 4. Raycasting & Collision
The app uses Three.js Raycasters projected from the camera through the 2D screen coordinates of the index finger.
*   **In Create Mode:** It detects faces of existing blocks to calculate where to attach new ones (normals).
*   **In Destroy Mode:** It detects intersections with physics bodies to apply "impulse" forces, simulating the finger flicking a block.

## How to Run Locally

Because this project requires access to your webcam, browser security policies (CORS) prevent it from working if you just double-click the HTML file. You must run it through a local server.

### Option A: VS Code (Easiest)
1.  Install the **Live Server** extension.
2.  Right-click `index.html`.
3.  Select **"Open with Live Server"**.

### Option B: Python
1.  Open your terminal/command prompt in the project folder.
2.  Run: `python -m http.server`
3.  Open your browser to `http://localhost:8000`.

*Note: Allow camera permissions when prompted by your browser.*