# Advanced JavaScript MediaPipe & Three.js Hand Tracking Tutorial (Mini-Project)

Welcome back! This chapter is a hands-on, focused mini-project that builds on your foundation and adds powerful new features to your hand tracking web app. We’ll keep the walkthrough clear and approachable, but always explain why we make each choice. At the end, you’ll find a “Spotlight” on more advanced demos and suggestions for next steps.

> **Why a mini-project?**
> This lesson is intentionally scoped to help you master the essentials of 3D hand landmark visualization and gesture recognition, without getting lost in complexity. You’ll see how to expand on this in the Spotlight section!

---

## Step 1: Project Preparation & Review

Before we add new features, let's organize our project. Good structure makes your life easier, especially as you add more advanced features!

### 1.1 Create Project Structure

For this chapter, create a new folder for your project:

```
tutorial-02/
├── index.html        # The main web page
├── main.js           # Your JavaScript code
├── styles.css        # Optional: for custom styles
├── patterns.md       # (Optional) For notes or patterns
└── tutorial.md       # This tutorial!
```

You can create these files using your code editor or the terminal. For example, in Linux:

```bash
mkdir tutorial-02
cd tutorial-02
touch index.html main.js styles.css patterns.md tutorial.md
```

---

Before we add new features, let's review our setup and discuss why we made certain choices. This will help you understand the trade-offs and alternatives as your projects grow. (For reusable code, check the [patterns file](patterns.md)!)


### 1.1 Why Use MediaPipe Hands?
- **Accuracy & Speed:** MediaPipe Hands is optimized for real-time performance in the browser, using WebAssembly and efficient models. Alternatives like TensorFlow.js or custom models are possible, but MediaPipe is easier to set up and more efficient for hand tracking.
- **No Installation Needed:** Loading from a CDN means no build steps or package managers. For production, you might self-host or bundle, but for learning and prototyping, CDN is fastest.
- **Alternatives:** TensorFlow.js, OpenCV.js, or custom ML models. These offer more flexibility but require more setup and expertise.

### 1.2 Why Three.js for Visualization?
- **WebGL Made Easy:** Three.js abstracts away the complexity of raw WebGL, letting you focus on creativity.
- **Community & Resources:** Tons of examples, documentation, and plugins.
- **Alternatives:** Babylon.js (also great), raw WebGL (more control, but much harder), or 2D libraries like p5.js (for simpler visuals).

---

## Step 2: Real-Time Landmark Visualization in 3D

Let's make our app more interactive and visually rich by rendering hand landmarks as 3D spheres in a Three.js scene, updating in real time.

### 2.1 Setting Up the Scene

We'll create a 3D scene with a camera, lighting, and a group of spheres representing hand landmarks.

```javascript
let scene, camera, renderer, handGroup;

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 2; // Move camera back so hand fits in view

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add a soft light for better visibility
    const light = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(light);

    // Group to hold landmark spheres
    handGroup = new THREE.Group();
    scene.add(handGroup);
}
```

**Why this setup?**
- **AmbientLight** gives even lighting, so landmarks are always visible. You could add DirectionalLight for shadows, but for simple spheres, ambient is best.
- **Group** lets us easily update or clear all landmark spheres each frame.
- **Camera position** is set so the hand fits nicely in the view. You can experiment with this for different effects.

---

## How to Test Code Interactively (Quick Review)

If you haven't already, see the previous tutorial for a detailed guide on testing code interactively using JSFiddle, VSCode + Live Server, or a local file. For each function below, you can use the browser DevTools console to call and experiment with it, as long as your HTML and JS are loaded in a real page.

---

**Try it now:**
- With your page loaded, open the DevTools console.
- Type `initThreeJS()` and press Enter. You should see the Three.js scene and renderer appear (a blank canvas with lighting).
- Type `scene`, `camera`, or `renderer` to inspect these objects.
- You can also try moving the camera: `camera.position.z = 5; renderer.render(scene, camera);`

---

### 2.2 Creating Landmark Spheres

For each hand landmark, we'll create a small sphere. We'll reuse these spheres for performance, rather than creating/destroying them every frame.

```javascript
const LANDMARK_COUNT = 21;
let landmarkSpheres = [];

function createLandmarkSpheres() {
    const geometry = new THREE.SphereGeometry(0.02, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ffcc });
    for (let i = 0; i < LANDMARK_COUNT; i++) {
        const sphere = new THREE.Mesh(geometry, material.clone());
        handGroup.add(sphere);
        landmarkSpheres.push(sphere);
    }
}
```

**Why reuse objects?**
- Creating and destroying meshes every frame is slow and can cause memory leaks. By creating them once and updating their positions, we keep performance high.
- **MeshStandardMaterial** gives a nice look with lighting, but you could use MeshBasicMaterial for flat color (faster, but less pretty).

---

**Try it now:**
- After running `initThreeJS()`, type `createLandmarkSpheres()` in the console.
- Type `handGroup` or `landmarkSpheres` to see the group and spheres in the scene.
- Try changing the color of a sphere: `landmarkSpheres[0].material.color.set(0xff0000); renderer.render(scene, camera);`

---

### 2.3 Mapping Landmarks to 3D Space

MediaPipe gives us normalized coordinates (x, y, z) in the range [0, 1] (or sometimes [-1, 1] for z). We need to map these to our 3D scene.

```javascript
function updateLandmarkPositions(landmarks) {
    for (let i = 0; i < LANDMARK_COUNT; i++) {
        const lm = landmarks[i];
        // Map x/y from [0,1] to [-1,1], flip y for Three.js
        landmarkSpheres[i].position.set(
            lm.x * 2 - 1,
            -(lm.y * 2 - 1),
            -lm.z // z is usually negative (towards camera)
        );
    }
}
```

**Why this mapping?**
- Three.js uses a coordinate system where (0,0) is the center, x is right, y is up, and z is depth. MediaPipe's (0,0) is top-left, so we remap and flip y.
- Negative z brings the hand closer to the camera, matching MediaPipe's convention.

---

**Try it now:**
- After creating the spheres, try updating their positions manually:
  - `updateLandmarkPositions(Array.from({length:21}, (_,i)=>({x:Math.random(),y:Math.random(),z:Math.random()}))); renderer.render(scene, camera);`
- This will scatter the spheres randomly in 3D space. Try different values to see how the mapping works.

---

### 2.4 Integrating with MediaPipe's onResults

We'll use the `onResults` callback to update our 3D scene every time MediaPipe detects a hand.

```javascript
hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        updateLandmarkPositions(results.multiHandLandmarks[0]);
    }
    renderer.render(scene, camera);
});
```

**Why use onResults?**
- MediaPipe processes frames asynchronously. `onResults` is the official way to get the latest landmarks and update your UI.
- Rendering only when new results arrive is efficient, but you can also use `requestAnimationFrame` for smoother animation if you add more 3D elements.

---

**Try it now:**
- Once you have MediaPipe running, the `onResults` callback will update the scene automatically.
- For practice, you can call `updateLandmarkPositions` or `updateLandmarkColors` manually in the console to see their effects.

---

## Step 3: Gesture Recognition (Pinch Detection)

Let's add a simple gesture: detecting when the user pinches their thumb and index finger together.

```javascript
function isPinching(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const distance = calculateDistance(thumbTip, indexTip);
    return distance < 0.05; // Tune this threshold as needed
}
```

**Why this approach?**
- Pinch is a common, intuitive gesture. By measuring the distance between two fingertips, we can detect it reliably.
- You could use more complex ML models for gesture recognition, but this method is fast and easy to understand.

---

**Try it now:**
- In the console, try `isPinching([{x:0,y:0,z:0},{},{},{},{x:0.01,y:0.01,z:0.01},{},{},{},{x:0.02,y:0.02,z:0.02}])` (fill in dummy objects for unused indices). See if it returns `true` or `false`.
- Once MediaPipe is running, you can use real landmark data.

---

## Step 4: Visual Feedback for Gestures

Let's give the user feedback when a pinch is detected by changing the color of the spheres.

```javascript
function updateLandmarkColors(isPinched) {
    for (let sphere of landmarkSpheres) {
        sphere.material.color.set(isPinched ? 0xff3366 : 0x00ffcc);
    }
}

// In your onResults callback:
hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        updateLandmarkPositions(landmarks);
        const pinched = isPinching(landmarks);
        updateLandmarkColors(pinched);
    }
    renderer.render(scene, camera);
});
```

**Why visual feedback?**
- Immediate feedback helps users understand what the app is detecting. It's also fun!
- You could add sound, haptic feedback, or trigger other actions as well.

---

**Try it now:**
- After creating the spheres, try `updateLandmarkColors(true)` or `updateLandmarkColors(false)` in the console to see the color change.
- Combine with the previous steps to experiment with different gestures and feedback.

---

## Step 5: Performance & Usability Tips

- **Reuse objects:** As above, always reuse meshes and materials for best performance.
- **Debounce gestures:** If you trigger actions on pinch, add a cooldown or debounce so it doesn't fire too rapidly.
- **Mobile support:** Test on phones! Touch events and camera permissions can behave differently.
- **Accessibility:** Consider adding keyboard shortcuts or alternative input for users who can't use hand gestures.

---

## Wrapping Up

You've now built a much more advanced hand tracking app! You:
- Visualized hand landmarks in 3D
- Detected gestures and gave real-time feedback
- Learned why each design choice matters

---

## Spotlight: Going Further

This mini-project is just the beginning. If you want to see how these ideas scale up, check out these advanced demos in this repo:

- [Shape Creator](../shape-creator): Multiple shapes, color changes, more gestures, and a richer UI.
- [3D Editor](../3d-editor): Real-time editing of 3D objects with hand gestures, more advanced Three.js usage.

**What do these demos add?**
- Support for multiple objects and gestures
- More complex scene management
- UI for selecting and editing objects
- Smoother user experience and polish

**Next Steps:**
- Try adding a new gesture (like a peace sign or fist) and trigger a color change or animation.
- Add a UI element to toggle between different 3D visualization modes.
- Explore the [patterns file](patterns.md) for more reusable code and ideas.

---

> This lesson is intentionally focused, transparent, and chatty—so you know not just what to do, but why. The goal is to help you build confidence and curiosity. When you’re ready, move on to the next chapter or explore the advanced demos for inspiration!
