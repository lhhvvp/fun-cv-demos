# Voxel Designer

An interactive 3D voxel design tool that responds to hand gestures. Shape colorful 3D patterns using hand movements.

**Live Demo**: [funwithcomputervision.com/voxel](https://funwithcomputervision.com/voxel/)

<img src="assets/voxel.png">

## ✨ Features

- **Hand Gesture Control**: Use pinch gestures and hand movements to control the 3D animation
- **Real-time 3D Visualization**: Dynamic voxel grid that moves in a wave-like rippling pattern
- **Color Palettes**: Multiple pixel art inspired color schemes

## 🎮 How to Use

1. **Start the Camera**: Click "Start Camera" to enable hand tracking
2. **Control Amplitude**: Pinch your thumb and index finger together, then spread them apart to control wave height
3. **Control Frequency**: Move your wrist up and down to adjust wave frequency
4. **Change Colors**: Flip your hand (index finger below thumb) to cycle through color palettes

## 🛠️ Tech Stack

- **Three.js**: 3D graphics and rendering
- **MediaPipe Hands**: Real-time hand tracking and gesture recognition
- **HTML5 Canvas**: Drawing hand tracking indicators
- **WebRTC**: Camera access through getUserMedia API
- **Vanilla JavaScript**: Core application logic
- **CSS3**: Styling and responsive design

## 📋 How It Works

### Step 1: Camera Setup
The app requests access to your webcam and creates a video stream that feeds into MediaPipe for hand detection.

### Step 2: Hand Tracking
MediaPipe analyzes each video frame to identify hand landmarks (21 points per hand including fingertips, joints, and wrist).

### Step 3: Gesture Recognition
The app calculates:
- **Pinch Distance**: Distance between thumb tip and index finger tip
- **Wrist Height**: Vertical position of the wrist
- **Hand Orientation**: Detects when the hand is flipped

### Step 4: Parameter Mapping
Gestures are mapped to mathematical parameters:
- Pinch distance → Wave amplitude (0.01 to 2.0)
- Wrist height → Wave frequency (0.5 to 4.0)
- Hand flip → Color palette cycling

### Step 5: 3D Visualization
A grid of cubes is positioned using the mathematical function:
```
z = amplitude × sin(frequency × radius + time) × cos(complexity × x × y + time)
```

### Step 6: Color Mapping
Each cube's height is mapped to colors from the selected palette, creating smooth color transitions across the 3D surface.