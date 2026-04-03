# Cat-Operated Photobooth

An AI-powered photo booth that uses real-time object detection to automatically take pictures when a cat is detected.

[Live Demo](https://www.funwithcomputervision.com/cat-cam/)

<img src="assets/cat-cam.webp">

## Features

- **Auto Cat Detection**: Uses machine learning to detect cats and dogs in real-time
- **Hands-Free Photos**: Automatically starts countdown when a cat is spotted
- **Fun Party Hats**: Optional hat overlay that follows detected cats
- **Photo Gallery**: View and download all captured photos
- **Sound Effects**: Countdown beeps and camera shutter sounds
- **Mobile Friendly**: Works on phones with front/back camera switching
- **No Server Required**: Runs entirely in the browser

## How It Works

1. **Setup**: Open the webpage and allow camera access
2. **Detection**: AI scans video feed for cats and dogs
3. **Countdown**: When a cat is detected, 3-second countdown begins
4. **Capture**: Photo is taken automatically with timestamp
5. **Gallery**: View all photos in built-in carousel viewer

## Tech Stack

### Frontend
- **HTML5**: Structure and video capture
- **CSS3**: Styling and responsive design
- **Vanilla JavaScript**: Core application logic

### Computer Vision
- **TensorFlow.js**: Browser-based machine learning
- **COCO-SSD Model**: Pre-trained object detection
- **Canvas API**: Image processing and photo editing

### Audio
- **Tone.js**: Sound effects

## File Structure

```
├── index.html          # Main HTML structure
├── main.js             # Core JavaScript application
├── styles.css          # CSS styling
└── assets/
    ├── hat2.png        # Party hat overlay
    └── shutter.mp3     # Camera sound effect
```

## Privacy

- All processing happens locally in your browser
- No photos or video are sent to external servers
- No data collection or tracking
- Camera access is only used for real-time detection