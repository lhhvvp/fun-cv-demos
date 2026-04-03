# 3D Hand Tracking Demo

A threejs / WebGL / MediaPipe-powered interactive demo that allows you to control a 3D sphere using hand gestures.

[Video](https://youtu.be/6_3ONmWvKYA) | [Live Demo](https://www.funwithcomputervision.com/demo1/)


<img src="demo.png">

## Setup for Development

```bash
# Navigate to the project sub-folder
#(follow the steps on the main page to clone all files if you haven't already done so)
cd hand-tracking-101

# Serve with your preferred method (example using Python)
python -m http.server

# Use your browser and go to:
http://localhost:8000
```

## Features

- **Real-time hand tracking** using MediaPipe Hands
- **Left hand gesture control:** Pinch thumb and index finger to resize the 3D sphere
- **Right hand interaction:** Touch the sphere with your index finger to change its color

## Requirements

- Modern web browser with WebGL support
- Camera access

## Technologies

- **Three.js** for 3D rendering
- **MediaPipe** for hand tracking and gesture recognition
- **HTML5 Canvas** for visual feedback
- **JavaScript** for real-time interaction

## License

MIT License

## Prompts Used

I created this program using Claude web.

Here are the prompts I used and some commentary as we're building it.

**Prompt 1**: "create a demo using mediapipe hand tracking and vanilla js. Show a full width/height webcam feed on the page (mirrored). draw hand landmarks on top of the user's hands. Keep it simple and ensure that it runs locally. We will add more features later on"

**Prompt 2**: "ok now let's integrate threejs into this demo. Draw a sphere in the scene. It should have a vibrant neon color fill and white wireframe outline. The scene should overlaid on top of the webcam feed and should have no background and no visual elements other than the floating shape. The shape should auto-rotate slowly and stay in the center of the screen. Keep it simple we will add hand tracking interaction after"

*[Note: This now gives us a threejs shape in the scene, but it's not yet linked with the hand movements]*

**Prompt 3**: "now let's add hand tracking interaction to this demo. Right hand: distance between thumb/index finger controls the size of the sphere. Left hand: if the index finger touches with the shape, the color fill of the shape should change to a random neon color"

*[Now we're cooking! The threejs shape is now linked with the mediapipe hand tracking. The positions of the fingers are now being used to drive the size and color of the shape in real-time.]*

**Prompt 4**: "add some smoothing to the resizing of the sphere, to prevent jittering/glitching of the rapid unintended size changes"

*Just some clean-up to make the size changes smoother.*

*Voila! Our demo is complete.*

*This was a basic example, but the same principles can be used to create games, interactive websites, and other fun augmented reality applications.*

## Key Learnings

[work in progress, to be added]