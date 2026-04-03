# 🏋️‍♂️ Do a Chin-Up, Save a Cat 🐈

A body movement game that uses your camera to track your chin-up movements and lets you save virtual cats!

[Video](https://youtu.be/EI35woKvt_s) | [Live Demo](https://www.funwithcomputervision.com/chinup/) 

## 🎮 How It Works

1. **Camera Setup**: The game uses your webcam
2. **Pose Detection**: mediapipe AI tracks your body movements in real-time
3. **Chin-Up Tracking**: When you do a chin-up, the game detects it
4. **Cat Rescue**: Each successful chin-up saves a cat from the fire below

## 🎯 Game Features

### Camera & Pose Tracking
- Uses **MediaPipe** AI to track your body
- Focuses on your head (nose), elbows, and wrists

### Chin-Up Detection
- **Hanging State**: Head is below your elbows
- **Pulling State**: Head moves up toward your wrists
- **Complete**: Head reaches wrist level = cat saved!

### Cat System
- **Wandering Cats**: 30 cats walk around at the bottom
- **Rescue Animation**: Cat floats up to your head during chin-up
- **Saving Animation**: Cat moves to safety after successful chin-up

### Audio Effects
- **Meow Sounds**: Random cat sounds when starting chin-ups
- **Celebration**: Musical notes when completing chin-ups

### Visual Effects
- **Fire Animation**: Animated fire at the bottom of screen
- **Pose Lines**: Shows your body outline while tracking
- **Responsive Design**: Works on phones and computers

## 🔧 Technical Details

### Tech Stack

**Frontend Framework**
- **Vanilla JavaScript** - No frameworks, pure ES6+ modules
- **HTML5** - Canvas and video elements
- **CSS3** - Animations, flexbox, responsive design

**3D Graphics & Rendering**
- **Three.js (v0.161.0)** - 3D scene management and rendering
- **WebGL** - Hardware-accelerated graphics
- **Orthographic Camera** - 2D-style projection for UI elements
- **Sprite System** - 2D images in 3D space for cats and effects

**Computer Vision & AI**
- **MediaPipe Tasks Vision (v0.10.14)** - Google's pose detection AI vision model
- **PoseLandmarker** - Real-time body keypoint detection
- **WebAssembly (WASM)** - High-performance AI inference in browser

**Audio Processing**
- **Web Audio API** - Low-latency audio synthesis and playback
- **AudioContext** - Real-time audio processing
- **Oscillator Nodes** - Procedural sound generation
- **Gain Nodes** - Volume control and audio effects

### Architecture Overview

**Game Class (`game.js`)**
- **Scene Management**: Three.js scene setup and rendering loop
- **Camera Pipeline**: Webcam → MediaPipe → pose landmarks
- **State Machine**: Chin-up detection with hanging/pulling states
- **Object Pooling**: Efficient cat sprite reuse and management
- **Animation System**: Smooth interpolation for cat movements
- **Coordinate Transformation**: Camera space → screen space → 3D world
