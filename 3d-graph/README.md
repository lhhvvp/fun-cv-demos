# 3D Graph Control

A 3D graph visualization program that you control with hand gestures and voice commands instead of a mouse or keyboard.

Uses computer vision to track your hands and lets you manipulate a force-directed graph through natural movements.

[Video](https://youtu.be/sAuPvVoLXqs) | [Live Demo](https://www.funwithcomputervision.com/3d-graph/)

<img src="assets/3d-graph.png">

## 🎯 What You See
- A 3D network of connected nodes (like a constellation of dots connected by lines)  
- Your webcam feed in the background
- White lines drawn over your hands showing finger positions
- A speech bubble that shows voice commands
- Interactive UI for switching between control modes

## 🖐️ How You Control It

The program has 3 interaction modes:

### 1. **Drag Mode**
- **Gesture**: Pinch your thumb and index finger together
- **Action**: Grab and move individual nodes around the 3D space
- **Visual Feedback**: Nodes highlight when hovered, lock when grabbed

### 2. **Rotate Mode**  
- **Gesture**: Make a fist and move your hand
- **Action**: Rotate the entire graph in 3D space
- **Features**: Smooth orbital rotation around the graph center

### 3. **Zoom Mode**
- **Gesture**: Use both hands - move your wrists closer/apart  
- **Action**: Zoom in and out of the graph
- **Range**: Configurable min/max zoom limits for optimal viewing

## 🗣️ Voice Control
- Say **"drag"**, **"rotate"**, or **"zoom"** to switch modes
- Real-time speech recognition with visual feedback in speech bubble

## 🔧 Technical Implementation

### Hand Tracking & Computer Vision
- **MediaPipe** (Google's AI) analyzes webcam feed to find hand positions
- Tracks 21 anatomical landmarks on each hand (fingertips, knuckles, wrist, etc.)
- Real-time gesture recognition for pinch, fist, and two-hand interactions
- Smoothing algorithms to reduce jitter and improve accuracy

### 3D Graphics & Visualization  
- **[3d-force-graph](https://github.com/vasturiano/3d-force-graph)** - Main force-directed graph component using ThreeJS/WebGL
- **Three.js** - 3D scene management, camera controls, lighting, and rendering
- **CSS2DRenderer** - Adds text labels to nodes that scale with perspective
- **Post-processing effects** - Bloom/glow effects for enhanced visual appeal
- **Force-directed layout** - Physics simulation for natural node positioning

### Audio & Speech
- **Web Audio API** - Procedural sound generation for interaction feedback
- **Web Speech API** - Real-time voice command recognition
- **AudioContext** - Spatial audio effects and dynamic sound synthesis

### Architecture
```
┌─ Main Application (main.js)
├─ Game Controller (game.js)
│  ├─ Hand Tracking (MediaPipe)  
│  ├─ 3D Graphics (Three.js + 3d-force-graph)
│  ├─ Interaction Logic
│  └─ UI Management
├─ Audio Manager (audioManager.js)
├─ Speech Manager (SpeechManager.js)  
├─ HTML Layout (index.html)
└─ Styling (styles.css)
```

## 📁 File Structure

### Core Application Files
- **`main.js`** - Application entry point and initialization
- **`game.js`** - Main game logic, hand tracking, and 3D graphics coordination
- **`index.html`** - HTML structure and layout
- **`styles.css`** - CSS styling and responsive design

### Specialized Managers  
- **`audioManager.js`** - Web Audio API sound effects generation
- **`SpeechManager.js`** - Speech recognition and voice command handling

### Data
- **`assets/data.json`** - Graph data structure (nodes and links)

## 🔗 Dependencies & Libraries

### Core 3D Visualization
- **[3d-force-graph](https://github.com/vasturiano/3d-force-graph)** by Vasco Asturiano
  - 3D force-directed graph component using ThreeJS/WebGL
  - Uses d3-force-3d or ngraph for underlying physics engine
  - Part of a larger ecosystem including 2D, VR, and AR versions

### Computer Vision & AI
- **[MediaPipe](https://developers.google.com/mediapipe)** - Google's ML framework for hand landmark detection
- Real-time hand tracking with 21 3D landmarks per hand
- GPU-accelerated inference for smooth performance

### 3D Graphics & Rendering
- **[Three.js](https://threejs.org/)** - WebGL 3D graphics library
- **[postprocessing](https://github.com/pmndrs/postprocessing)** - Post-processing effects
- **CSS2DRenderer** - HTML/CSS overlay rendering in 3D space

### Physics & Layout
- **d3-force-3d** - 3D force simulation for node positioning
- **ngraph** - Alternative physics engine option
- Force-directed layout with customizable parameters

## 🎮 User Experience Features

### Visual Feedback
- **Hand skeleton overlay** - Real-time hand tracking visualization
- **Node highlighting** - Hover effects and selection feedback  
- **Smooth animations** - Gesture-based camera controls
- **Responsive UI** - Adaptive interface for different screen sizes

### Interaction Modes
- **Mode switching** - Click UI buttons or use voice commands
- **Gesture recognition** - Natural hand movements for control
- **Multi-modal input** - Combine gestures, voice, and traditional UI

### Accessibility
- **Visual indicators** - Clear feedback for all interactions
- **Voice commands** - Alternative to gesture-only control
- **Responsive design** - Works on desktop and mobile devices
- **Error handling** - Graceful fallbacks for unsupported features

## 🚀 Getting Started

1. **Clone the repository**
2. **Serve the files** using a local web server
3. **Allow camera and microphone access** when prompted
4. **Start interacting** with hand gestures!

### Graph Data
- Modify `assets/data.json` to load your own network data
- Standard format: `{"nodes": [...], "links": [...]}`
- Supports custom node properties and styling

## 🔬 Technical Deep Dive

### Hand Tracking Pipeline
1. **Video capture** from user's webcam
2. **MediaPipe processing** - AI landmark detection  
3. **Coordinate transformation** - Video space to 3D world space
4. **Gesture recognition** - Distance calculations and state tracking
5. **Smoothing** - Temporal filtering to reduce noise

### 3D Coordinate Systems
- **Video coordinates** - Normalized MediaPipe output (0-1 range)
- **Screen coordinates** - 2D pixel positions on canvas
- **World coordinates** - 3D positions in ThreeJS scene
- **Graph coordinates** - Force-directed layout space

## Credit

This project builds upon the excellent **[3d-force-graph](https://github.com/vasturiano/3d-force-graph)** library by Vasco Asturiano:

> *A web component to represent a graph data structure in a 3-dimensional space using a force-directed iterative layout. Uses ThreeJS/WebGL for 3D rendering and either d3-force-3d or ngraph for the underlying physics engine.*

## 🎯 Potential Use Cases

### Educational Applications
- **Network topology visualization** - Understand complex system relationships (wikipedia articles, scientific papers, social media networks)
- **Scientific modeling** - Visualize molecular structures, social networks
- **System architecture** - Visualize microservices and dependencies
- **Interactive art** - Gesture-controlled visual experiences