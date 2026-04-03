# JavaScript MediaPipe Webcam Tracking Tutorial

Welcome to this hands-on mini-project! This lesson is designed to be your first, approachable step into real-time hand tracking and 3D visualization in the browser. We’ll keep things simple and focused, so you can learn by doing and see results quickly. If you want to go further, check out the “Spotlight” at the end for ideas and a link to a more advanced demo.

> **Why a mini-project?**
> We want you to build something useful and working, but not get overwhelmed. This lesson covers the essentials—just enough to get you started and confident. You’ll see how to expand on this foundation later!

We’ll use [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html) for hand detection and [Three.js](https://threejs.org/) for 3D graphics. No prior experience with these libraries is required—I'll explain everything step by step, and you can always refer to the [patterns file](patterns.md) for reusable code snippets and best practices.

---

## Step 1: Setting Up the Project

Before we dive into code, let's organize our project. Good structure makes your life easier, especially as a beginner!

### 1.1 Create Project Structure

First, create a folder for your project. Inside, you'll have a few files:

```
tutorial-01/
├── index.html        # The main web page
├── main.js           # Your JavaScript code
├── styles.css        # Optional: for custom styles
├── patterns.md       # (Optional) For notes or patterns
└── tutorial.md       # This tutorial!
```

You can create these files using your code editor or the terminal. For example, in Linux:

```bash
mkdir tutorial-01
cd tutorial-01
touch index.html main.js styles.css patterns.md tutorial.md
```

---

### 1.2 Basic HTML Setup

Let's start with the `index.html` file. This is the backbone of your web app. We'll include all the necessary scripts and set up the basic layout.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediaPipe Webcam Tracking</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <video id="webcam" autoplay playsinline></video>
    <canvas id="canvas"></canvas>
    <div id="status">Loading MediaPipe...</div>
    
    <!-- MediaPipe and Three.js libraries -->
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="main.js"></script>
</body>
</html>
```

**What's happening here?**
- We add a `<video>` element to show the webcam feed.
- A `<canvas>` for drawing overlays or 3D graphics.
- A `<div>` for status messages.
- We load MediaPipe Hands, drawing utilities, camera utilities, and Three.js from CDNs (Content Delivery Networks). This means you don't need to install anything—just copy and paste!
- Finally, we load our own `main.js` script, where all the magic will happen.

---

## Step 2: JavaScript Implementation

Now, let's write the JavaScript that will power our app. We'll break it down into manageable steps.

### 2.1 Webcam Initialization

First, we need to access the user's webcam. This is done using the `navigator.mediaDevices.getUserMedia` API, which is built into all modern browsers.

```javascript
async function initWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'user'
            }
        });
        videoElement.srcObject = stream;
    } catch (error) {
        console.error('Webcam access failed:', error);
    }
}
```

**Explanation:**
- We use `async/await` to handle the asynchronous nature of webcam access.
- The `video` object specifies our preferences: high resolution and the front-facing camera (for laptops and phones).
- If the user grants permission, we set the webcam stream as the source for our `<video>` element.
- If something goes wrong (e.g., the user denies access), we log an error.

**Try it now:**
- Save the html into a file and serve it locally, or put it into JSFiddle etc.
- Open your browser's DevTools console (usually F12 or right-click → Inspect → Console). In JSFiddle click Run and then the "Console" link below the output pane.
- Type `initWebcam()` and press Enter. You should see your webcam feed appear in the video element (if you allow access).
- If you want, you can also add a temporary call to `initWebcam();` at the end of your script to see it run automatically.

---

### 2.2 MediaPipe Hands Setup

Now, let's set up MediaPipe Hands. This library detects hands and their landmarks (key points) in real time.

```javascript
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});
```

**Explanation:**
- We create a new `Hands` object.
- The `locateFile` function tells MediaPipe where to find its internal files. By using a CDN, we avoid having to download anything manually.

**Try it now:**
- Cut and paste this new function into your console in Dev Tools, or in JSFiddle copy it into the Javascript panel and click "Run" again.
- In your browser console, type `hands` and press Enter. You should see the Hands object printed out, showing its available methods and properties.
- Try calling `hands.setOptions({ maxNumHands: 2 });` in the console to change the number of hands it will detect.

---

### 2.3 Three.js Integration

Let's add some 3D magic! Three.js is a popular library for 3D graphics in the browser. We'll use it to visualize hand landmarks or create interactive scenes.

```javascript
function initThreeJS() {
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera with proper aspect ratio
    camera = new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        1000
    );
    
    // Create transparent renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true 
    });
}
```

**Explanation:**
- `scene`: The container for all 3D objects.
- `camera`: Defines what part of the scene is visible. The perspective camera mimics how our eyes see the world.
- `renderer`: Draws the scene onto the canvas. We enable `antialias` for smoother edges and `alpha` for transparency.

**Try it now:**
- In your browser console, type `initThreeJS()` and press Enter. Then type `scene`, `camera`, or `renderer` to inspect these objects.
- You can also try `console.log(scene)` to see the scene structure.
- (If you want to see the renderer's canvas, you can temporarily add `document.body.appendChild(renderer.domElement);` inside the function.)

---

## How to Test Code Interactively

Before you try running any JavaScript functions in the browser console, you need to make sure your HTML and JavaScript are loaded in a real web page. Here are three easy ways to do this:

1. **JSFiddle (Recommended for Beginners):**
   - Go to [jsfiddle.net](https://jsfiddle.net/).
   - Copy your HTML into the HTML panel, and your JavaScript into the JS panel.
   - Click "Run" (▶️) to load the page.
   - Open the browser DevTools console (F12 or right-click → Inspect → Console).
   - Now you can type function names (like `initWebcam()`) in the console and see them run, because the HTML elements and functions are loaded.

2. **VSCode + Live Server:**
   - Save your `index.html` and `main.js` files in a folder.
   - Open the folder in VSCode.
   - Install the "Live Server" extension.
   - Right-click `index.html` and choose "Open with Live Server".
   - The page will open in your browser. Open DevTools console to interact with your code.

3. **Local File:**
   - Save your `index.html` and `main.js` files in a folder.
   - Double-click `index.html` to open it in your browser (note: webcam and some features may not work due to browser security restrictions).
   - Open DevTools console to interact with your code.

> **Note:**
> If you just paste a function into the console on a blank page (like about:blank), it won’t work because the required HTML elements (like `<video id="webcam">`) don’t exist. Always load your HTML and JS together in a real page first!

---

## Step 3: Advanced Features

Once you have the basics working, let's add some polish and interactivity.

### 3.1 Responsive Design

We want our app to look good on any device. Let's make the canvas and renderer resize automatically when the window changes size.

```javascript
function updateCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', () => {
    updateCanvasSize();
    if (renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
```

**Explanation:**
- `updateCanvasSize` sets the canvas size to match the window.
- We listen for the `resize` event and update both the canvas and the Three.js renderer.

**Try it now:**
- With your page loaded (see "How to Test Code Interactively" above), open the DevTools console.
- Type `updateCanvasSize()` and press Enter. The canvas should resize to fit the window.
- Try resizing your browser window and see the effect. You can also type `window.dispatchEvent(new Event('resize'))` in the console to trigger the resize event manually.

---

### 3.2 Gesture Detection

Let's add a simple function to calculate the distance between two hand landmarks. This is useful for detecting gestures, like pinching or spreading fingers.

```javascript
function calculateDistance(p1, p2) {
    return Math.sqrt(
        (p1.x - p2.x) ** 2 + 
        (p1.y - p2.y) ** 2 + 
        (p1.z - p2.z) ** 2
    );
}
```

**Explanation:**
- This function uses the 3D coordinates (`x`, `y`, `z`) of two points to calculate the Euclidean distance between them.
- You can use this to detect if fingers are close together (e.g., for a pinch gesture).

**Try it now:**
- In the DevTools console, try calling `calculateDistance({x:0, y:0, z:0}, {x:1, y:1, z:1})` and see the result.
- Once you have MediaPipe running, you can use real hand landmark objects as arguments.
- For more practice, try changing the values and see how the result changes.

---

## Putting It All Together: Complete Example & Startup Code

It's not enough to just define functions—you need to make sure your code actually runs! In JavaScript, this usually means calling your setup or initialization functions at the end of your script. This is especially important for beginners, as it's a common source of confusion.

Below is a complete, minimal `main.js` example that you can copy and paste into your project (or JSFiddle, VSCode, etc.) and it will just work. This code brings together webcam setup, MediaPipe Hands, and Three.js initialization, and ensures everything starts up automatically:

```javascript
// Get references to DOM elements
const videoElement = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const statusDiv = document.getElementById('status');

let scene, camera, renderer;

async function initWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'user'
            }
        });
        videoElement.srcObject = stream;
        statusDiv.textContent = 'Webcam ready!';
    } catch (error) {
        statusDiv.textContent = 'Webcam access failed.';
        console.error('Webcam access failed:', error);
    }
}

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
}

function updateCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.addEventListener('resize', updateCanvasSize);

// --- MediaPipe Hands setup ---
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults((results) => {
    // Draw landmarks or do something with results here
    // For now, just log them
    console.log(results);
});

// --- Startup code ---
async function startApp() {
    await initWebcam();
    initThreeJS();
    updateCanvasSize();
    // You can now start processing video frames with MediaPipe, etc.
}

// Call the startup function to kick things off!
startApp();
```

**How to use this:**
- Copy and paste this code into your `main.js` file (or the JS section of JSFiddle).
- Make sure your `index.html` includes the correct script tags (as shown above).
- The app will automatically initialize the webcam, set up Three.js, and prepare MediaPipe Hands.

**Why is this important?**
- If you only define functions but never call them, nothing will happen!
- By calling `startApp()` at the end, you ensure your app starts up as soon as the page loads.

**Tip:**
- You can add more logic inside the `onResults` callback to draw hand landmarks or trigger actions based on gestures.

---

## Best Practices

Here are some tips to help you write clean, efficient, and maintainable code:

1. **Always use `requestAnimationFrame` for rendering loops**
   - This ensures smooth animations and efficient use of resources.

2. **Maintain proper script loading order**
   - Libraries like MediaPipe and Three.js must be loaded before your own script. Example:
   ```html
   <script src="hands.js"></script>
   <script src="drawing_utils.js"></script>
   <script src="camera_utils.js"></script>
   <script src="three.js"></script>
   <script src="main.js"></script>
   ```

3. **Use `locateFile` for MediaPipe module loading**
   - This avoids errors when MediaPipe tries to load its internal files.

4. **Implement proper error handling for webcam access**
   - Always use `try/catch` and inform the user if something goes wrong.

5. **Keep canvas size responsive to window changes**
   - This ensures your app looks good on all devices.

6. **Use `onResults` callback for processing landmarks**
   - MediaPipe Hands provides an `onResults` callback where you can access detected hand landmarks and draw or process them.

---

## Wrapping Up

Congratulations! You've just built the foundation for a real-time hand tracking web app using JavaScript, MediaPipe, and Three.js. From here, you can:
- Visualize hand landmarks in 2D or 3D
- Recognize gestures and trigger actions
- Build interactive games or creative tools

**Don't stop here!**
- Try changing the camera angle in Three.js
- Experiment with different gestures
- Add your own creative twist

If you get stuck, don't worry—debugging is part of the learning process. Check the browser console for errors, and read the documentation for MediaPipe and Three.js. And remember, you can always refer to the [patterns file](patterns.md) for quick help with common code!

---

## Spotlight: Going Further

This mini-project is just the beginning. If you want to see how a more advanced version looks—with a better UI, more features, and extra polish—check out the [Hand Tracking 101 demo](../hand-tracking-101) in this repo.

**What does the demo add?**
- Smoother UI and layout
- More robust error handling
- Interactive 3D elements
- Additional gesture support

**Next Steps:**
- Try adding a new gesture (like a pinch or spread) and print a message when it’s detected.
- Add a button to toggle the 3D view on and off.
- Explore the [patterns file](patterns.md) for more reusable code and ideas.

---

> This lesson is intentionally simple, transparent, and chatty—so you know not just what to do, but why. The goal is to help you build confidence and curiosity. When you’re ready, move on to the next chapter for more advanced features!