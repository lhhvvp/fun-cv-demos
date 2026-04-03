# Whirlpool Camera

This program creates a real-time visual effect using your webcam and hand tracking.

[Video](https://youtu.be/ml01caFUHPU?si=Jj6TysL_CysSUdWM) | [Live Demo](https://www.funwithcomputervision.com/whirlpool-camera/)

## What It Does

* Shows your webcam feed on screen
* Tracks your hands using the Mediapipe computer vision AI model
* Creates trippy visual distortions around your hands

## How It Works

* Gets Your Camera: Asks permission to use your webcam and displays the feed
* Finds Your Hands: Uses Google's MediaPipe AI to detect where your hands are in the video
* When it finds your hands, it warps and swirls the video around your hand positions
* Real-Time Processing: Uses your computer's graphics card (GPU) to apply these effects smoothly at 60fps

## The Controls

* EFFECT: choose between different shader styles
* DISTORT: How much the video warps around your hands
* DECAY: How quickly the trails fade away
* RADIUS: How big the effect area is around your hands

## Technology Stack

* Pure HTML/CSS/JavaScript (no frameworks like React or Vue)
* Three.js - JavaScript 3D library for WebGL rendering
* WebGL Shaders - Custom vertex and fragment shaders for real-time effects
* MediaPipe - Google's AI framework for hand tracking

## More About Shaders

This app uses "shaders" (special programs that run on your graphics card) to process every pixel of the video in real-time.

The swirling effect happens because it's constantly taking the current video frame, mixing it with the previous frame (creating trails), and warping the pixels based on where your hands are detected.