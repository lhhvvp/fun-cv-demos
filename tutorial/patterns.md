# JavaScript MediaPipe Webcam Tracking Patterns

This file is a living "cheat sheet" of the most important and reusable code patterns for MediaPipe and Three.js projects. It exists to help you (and coding assistants like AI/LLMs!) quickly find, reuse, and understand the core building blocks for computer vision and interactive graphics in the browser. Patterns are distilled from real projects and tutorials, and are meant to save you time, encourage best practices, and provide context for both humans and AI helpers.

## Core Implementation Patterns

### 1. Webcam Initialization Pattern
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

### 2. MediaPipe Hands Initialization Pattern
```javascript
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});
```

### 3. Three.js Integration Pattern
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

### 4. Responsive Layout Pattern
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

### 5. Gesture Detection Pattern
```javascript
function calculateDistance(p1, p2) {
    return Math.sqrt(
        (p1.x - p2.x) ** 2 + 
        (p1.y - p2.y) ** 2 + 
        (p1.z - p2.z) ** 2
    );
}
```

### 6. MediaPipe onResults Pattern
```javascript
hands.onResults((results) => {
    if (results.multiHandLandmarks) {
        // Process landmarks here
    }
});
```

### 7. Drawing Landmarks Pattern
```javascript
function drawLandmarks(ctx, landmarks) {
    for (const point of landmarks) {
        ctx.beginPath();
        ctx.arc(point.x * ctx.canvas.width, point.y * ctx.canvas.height, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
}
```

### 8. Animation Loop Pattern
```javascript
function animate() {
    requestAnimationFrame(animate);
    // Update scene or UI
    renderer.render(scene, camera);
}
animate();
```

### 9. Error Handling Pattern
```javascript
try {
    // Some async or risky operation
} catch (e) {
    console.error('Something went wrong:', e);
}
```

## Best Practices

1. Always use `requestAnimationFrame` for rendering loops
2. Maintain proper script loading order:
   ```html
   <script src="hands.js"></script>
   <script src="drawing_utils.js"></script>
   <script src="camera_utils.js"></script>
   <script src="three.js"></script>
   <script src="main.js"></script>
   ```
3. Use `locateFile` for MediaPipe module loading
4. Implement proper error handling for webcam access
5. Keep canvas size responsive to window changes
6. Use `onResults` callback for processing landmarks

---

*This file is intentionally concise and pattern-focused, so you can copy, adapt, and understand the essentials quickly—whether you're a human or an AI assistant helping with code!*