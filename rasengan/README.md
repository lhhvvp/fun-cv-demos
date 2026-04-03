# Rasengan

A browser-based AR experience that lets you summon and shoot a Naruto-style rasengan using hand gestures — powered by real-time hand tracking via your webcam.

![Rasengan](assets/rasengan.png)

## Usage

Open `index.html` in a browser that supports WebGPU (Chrome 113+). Allow webcam access when prompted.

**Gestures:**
- **Open palm facing up** — summon the rasengan above your hand
- **Palm facing forward (fingers extended)** — shoot it toward the camera

> The GUI (top-right) exposes parameters to tweak the visual effect in real time.

## How it works

1. MediaPipe hand tracking detects landmarks from your webcam feed each frame
2. The wrist position maps to 3D world coordinates to anchor the ball above your hand
3. Gesture recognition (fingertip vs knuckle positions) triggers spawn and shoot states
4. On shoot, the ball animates toward the camera with an anime-style impact frame effect

## Tech stack

| Tool | Purpose |
|------|---------|
| [Three.js r172](https://threejs.org/) (WebGPU renderer) | 3D rendering |
| [Three.js TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) | Node-based shader for the energy ball effect |
| [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) | Real-time hand landmark detection |
| [lil-gui](https://lil-gui.georgealways.com/) | Runtime parameter controls |

No build step required — runs entirely in the browser via import maps.
