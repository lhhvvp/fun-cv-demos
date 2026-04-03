# 3D Hand Tracking with Glass Cube

A real-time interactive web application that tracks your hand through your webcam and controls a beautiful glass cube in 3D space.

## What Does This Do?

This project creates a split-screen experience:
- **Left side**: Shows your webcam feed with hand tracking overlay
- **Right side**: Displays a 3D glass cube that follows your hand movements

When you move your hand in front of your camera, the cube moves in 3D space matching your hand's position. The closer you bring your hand to the camera, the closer the cube comes to you. Move left, right, up, or down - the cube follows.

## How It Works

### Step 1: Webcam Capture
The app accesses your webcam and gets a live video feed.

### Step 2: Hand Detection
Using MediaPipe (Google's hand tracking technology), the app finds your hand in each video frame and identifies 21 key points on your hand (knuckles, fingertips, wrist, etc.).

### Step 3: Position Calculation
The app looks at where your wrist is located:
- **Left/Right position** (X): Based on where your wrist is horizontally in the frame
- **Up/Down position** (Y): Based on where your wrist is vertically in the frame  
- **Near/Far position** (Z): Calculated by measuring the size of your hand in the frame
  - Bigger hand = closer to camera = cube comes forward
  - Smaller hand = farther from camera = cube moves back

### Step 4: 3D Rendering
Three.js takes those coordinates and updates the position of a glass cube in a virtual 3D room.

### Step 5: Visual Display
The cube is rendered with:
- A white metallic frame
- Transparent blue glass panels
- Realistic lighting and shadows

## Technical Stack

### Libraries Used

1. **MediaPipe Hands** - Hand tracking and landmark detection
   - Detects up to 1 hand in real-time
   - Identifies 21 points on each hand
   - Runs at 30+ frames per second

2. **Three.js** - 3D graphics rendering
   - Creates the virtual 3D scene
   - Handles lighting, shadows, and materials
   - Renders the glass cube with realistic properties

3. **Camera Utils** - Webcam access and video processing
   - Captures video at 1920x1080 resolution
   - Sends frames to MediaPipe for processing

## Features

### Hand Tracking
- Real-time tracking with visible skeleton overlay
- Color-coded landmarks (blue when close, red when far)
- Hand connections drawn as white lines
- Displays X, Y, Z coordinates near your hand

### 3D Glass Cube
- **Frame**: White metallic edges with rounded corners
- **Glass panels**: Transparent blue material with refraction
- **Lighting**: Overhead directional light creating realistic shadows
- **Animation**: Smooth following movement + gentle rotation

### Performance Display
- FPS counter in top-right corner
- Typically runs at 30-60 FPS on modern computers

## How to Use

Everything is contained in one HTML file for simplicity. No build process needed.

### Basic Setup

1. **Download the file**
   ```bash
   # Clone this repository or download index.html
   git clone [your-repo-url]
   cd [project-folder]
   ```

2. **Open in browser**
   - Simply double-click `index.html`, OR
   - Serve it locally with a simple HTTP server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx http-server
   ```

3. **Allow camera access**
   - Your browser will ask for webcam permission
   - Click "Allow" to enable hand tracking

4. **Start moving your hand**
   - Hold your hand in front of the camera
   - Watch the cube follow your movements!

### Tips for Best Results

- **Lighting**: Make sure you have good lighting on your hand
- **Background**: A plain background helps with tracking accuracy
- **Distance**: Hold your hand 1-2 feet from the camera
- **Hand visibility**: Keep your whole hand in frame
- **Single hand**: The app tracks one hand at a time

## Understanding the Code

### Main Sections

1. **HTML/CSS (Lines 1-56)**: Page layout and styling
2. **Three.js Setup (Lines 77-202)**: 3D scene, lighting, and cube creation
3. **MediaPipe Setup (Lines 204-260)**: Hand tracking configuration
4. **Animation Loop (Lines 262-285)**: Updates every frame
5. **Camera Init (Lines 287-299)**: Starts the webcam

### Key Concepts

**Smoothing**: The cube doesn't jump instantly to your hand position. Instead, it moves part of the way each frame, creating smooth motion.

**Z-depth Calculation**: The app measures the distance between your wrist and middle knuckle. This hand size indicates depth:
```javascript
const handSize = Math.sqrt(dx*dx + dy*dy);
const rawZ = -((1 / handSize) * 1.5) + 8;
```

**Coordinate Mapping**: Your hand position (0-1 range) gets converted to 3D space (-12 to +12 for X/Y):
```javascript
const targetX = -(wrist.x - 0.5) * 25;
const targetY = -(wrist.y - 0.5) * 20 + 2;
```