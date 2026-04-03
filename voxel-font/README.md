# Voxel Font

A real-time 3D text renderer in the browser. Type anything and watch it appear as spinning 3D cubes, live on top of your webcam feed.

## What it does

- **Type text** — letters appear as 3D pixel-art characters built from individual colored cubes
- **Cubes rotate** continuously in unison, showing off their colored faces (blue, yellow, red)
- **Webcam background** — your camera feed plays behind the scene in black and white
- **Hand gestures** control the rotation:
  - **Swipe left or right** — flick the cubes in that direction; they coast and slow down gradually
  - **Make a fist, then open your hand** — all cubes explode outward and the text clears

## How to use

Open `index.html` in a browser. Allow camera access when prompted. Start typing.

## Gesture guide

| Gesture | Effect |
|---|---|
| Show hand, swipe left/right | Spins cubes in that direction |
| Hold fist (~0.2s), then spread fingers | Explosion |

## How it works

- **3D rendering** — [Three.js](https://threejs.org) draws the scene in WebGL
- **Pixel font** — each character is defined as a 5×7 grid of on/off pixels; lit pixels become cubes
- **Hand tracking** — [MediaPipe Hands](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) detects 21 points on your hand 30 times per second, entirely in the browser with no data sent anywhere
- **Fist detection** — checks whether fingertips are closer or farther from the wrist than the knuckles; if most fingers are curled, it's a fist

## Requirements

A browser with WebGL and camera access (Chrome or Firefox recommended). No install, no server needed.
