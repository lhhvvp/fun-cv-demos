# OIIA Cat Rhythm Game 🎵

A hand-tracking rhythm game where you control virtual buttons by moving your hands in front of your camera.

Make music by hitting the O, I, and A buttons to create sounds and light effects!

## 🎮 How to Play

1. **Start the game** - Click the "OIIA" button to begin
2. **Allow camera access** - The game needs your camera to track your hands
3. **Move your hands** - Point your fingertips at the colored buttons (O, I, A) on screen
4. **Make music** - Each button plays a different sound when activated
5. **Toggle background music** - Click or point at the music note (🎵) to start/stop the soundtrack

## 🛠️ Tech Stack

### Frontend
- **HTML5** - Game structure and layout
- **CSS3** - Styling, animations, and responsive design
- **Vanilla JavaScript** - Game logic and interactions

### Computer Vision
- **MediaPipe Hands** - Real-time hand tracking and gesture recognition
- **WebRTC** - Camera access through getUserMedia API

### 3D Graphics
- **Three.js** - 3D model rendering and animations
- **WebGL** - Hardware-accelerated graphics rendering

### Audio
- **Web Audio API** - Sound effects and background music
- **HTML5 Audio** - Audio file playback with mobile optimization

## 🔧 Game Flow

### 1. Initialization
```
User clicks start → Camera setup → Load 3D model → Load sounds → Initialize MediaPipe
```

### 2. Hand Tracking Loop
```
Camera frame → MediaPipe processing → Hand landmark detection → Button collision detection
```

### 3. Game Interaction
```
Hand touches button → Play sound → Visual effects → 3D model animation → Stage lights
```

### 4. Audio System
```
Button hit → Audio unlock check → Play sound/fallback → Mobile optimization
```

## 📁 File Structure

```
├── index.html          # Main HTML structure
├── main.js            # Game logic and hand tracking
├── styles.css         # Styling and responsive design
└── assets/
    ├── oiia.glb       # 3D cat model
    ├── oiia.jpg       # Background image
    ├── O2.mp3         # Button O sound
    ├── I2.mp3         # Button I sound
    ├── A2.mp3         # Button A sound
    └── song.mp3       # Background music
```

## 🎯 Key Features

### Hand Tracking
- Detects up to 2 hands simultaneously
- Tracks 21 landmarks per hand
- Collision detection with fingertips

### Visual Effects
- Stage lighting that responds to button hits
- 3D model rotation and bobbing animation

### Audio System
- Individual sounds for each button
- Background music toggle
- Mobile audio unlock handling

### Performance Optimization
- Frame skipping on mobile devices
- Throttled MediaPipe processing
- Offscreen canvas for hand rendering

## Installation

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd oiia-cat-rhythm-game
   ```

2. **Serve the files**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Or any other local server
   ```

3. **Open in browser**
   ```
   http://localhost:8000
   ```

## Requirements

- Modern web browser with WebGL support
- Camera access permission
- Microphone permission (for audio unlock on mobile)
- Good lighting for hand tracking
- Stable internet connection (for CDN resources)