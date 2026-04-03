# Handcrafted Shaders

Using hand gestures and voice commands to control a shader, with a liquid Chladni pattern

An interactive web app built with threejs, mediapipe computer vision, and web speech API

- Hand #1 controls the frequency of the waves
- Hand #2 controls the amplitude of the waves
- Pinch to change shader plane size
- Speak to change colours

[Video](https://youtu.be/9Q87Qc6K2xg) | [Live Demo](https://www.funwithcomputervision.com/demo6/)

<img src="demo.png">

## Setup for Development

```bash
# Navigate to the project sub-folder
#(follow the steps on the main page to clone all files if you haven't already done so)
cd handcrafted-shader

# Serve with your preferred method (example using Python)
python -m http.server

# Use your browser and go to:
http://localhost:8000
```

## Requirements

- Modern web browser with WebGL support
- Camera access enabled for hand tracking
- Microphone access for voice commands

## Technologies

- **MediaPipe** for hand tracking and gesture recognition
- **Three.js** for audio reactive visual rendering
- **Web Speech API** for voice to text transcription
- **HTML5 Canvas** for visual feedback
- **JavaScript** for real-time interaction

## Tutorial

I created this project by importing my basic hand + voice tracking template, and then used Claude to design this program.

Here are the key prompts that I used:

* use threejs to create a 2D square plane overlaid onto the webcam video

* this 2D plane should have a shader animation running on it, with some transparency so that the webcam still shows underneath it

* use liquid Chladni type patterns

* if both hands pinch (thumb/index finger tip), the plane should be able to be resized

* I want one hand to control the Frequency oscillation range by making a fist and then moving the hand up or down (to increase or decrease the value)

* The other hand should control the Amplitude of the waves, using a similar movement mechanic

* add a text label at the palm of each hand, describing the variable that it controls, along with the real-time value

* now I want to incorporate voice control into this

* show some minimal UI element labels at the top-left: Blue, Red, Yellow, Black. when the user speaks one of those words, the shader color should change accordingly

Those were the key prompts to create this.

There were several rounds of smaller prompts and adjustments to fix errors, change UI sizing / colors, and the overall aesthetic of the program.