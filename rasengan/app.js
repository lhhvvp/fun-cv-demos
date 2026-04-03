import * as THREE from 'three';
import {
  color,
  positionViewDirection,
  normalView,
  dot,
  mix,
  vec3,
  time,
  positionLocal,
  normalLocal,
  mx_noise_float,
  mx_noise_vec3,
  smoothstep,
  rotate,
  sin,
  float,
  uniform,
} from 'three/tsl';
import { OrbitControls } from 'https://unpkg.com/three@0.172.0/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// ── CONFIGURATION (Uniforms) ──
// These values drive the visual effect.

// 1. Geometry & Deformation
const uDispStrength = uniform(0.12);
const uDispScale = uniform(2);

// 2. Vortex & Flow Dynamics
const uVortexScale = uniform(0.2);
const uVortexSpeed = uniform(0.1);
const uRotationSpeed = uniform(0.1);
const uTwistAmount = uniform(90);

// 3. Electric Arc Pattern
const uElecScale = uniform(1);
const uElecSharpness = uniform(6.7);
const uElecFlowSpeed = uniform(1.5);
const uDistortionStrength = uniform(0.3);

// 4. Color & Intensity
const uDeepColor = uniform(new THREE.Color("#000000"));
const uMainColor = uniform(new THREE.Color("#00ffff"));
const uMainIntensity = uniform(0.3);
const uCoreColor = uniform(new THREE.Color("#00ffff"));
const uCoreThreshold = uniform(0.75);
const uCoreIntensity = uniform(50);

// 5. Post-Processing Effects
const uAberrationOffset = uniform(0.1);
const uPulseSpeed = uniform(1);
const uPulseStrength = uniform(0.07);

// 6. Material Properties
const uFresnelPower = uniform(1.1);
const uRimColor = uniform(new THREE.Color("#00aaff"));
const uRimIntensity = uniform(0);
const uOpacityMin = uniform(0.32);
const uOpacityMax = uniform(0.69);
const uGlobalOpacity = uniform(0.15); // Overall transparency of the ball (0-1)

// Entrance fade uniform (for opacity animation)
const uEntranceFade = uniform(0);



// ── GUI SETUP ──
const gui = new GUI({ title: 'Controls' });
gui.domElement.style.marginRight = '0px';
gui.domElement.style.right = '0px';
gui.close(); // Closed by default

// Helper to update uniform values from GUI
function updateUniform(uniformObj, value) {
  uniformObj.value = value;
}

// GUI Parameters object
const params = {
  // Geometry & Deformation
  dispStrength: 0.12,
  dispScale: 2,
  // Vortex & Flow
  vortexScale: 0.2,
  vortexSpeed: 0.1,
  rotationSpeed: 0.1,
  twistAmount: 90,
  // Electric Arcs
  elecScale: 1,
  elecSharpness: 6.7,
  elecFlowSpeed: 1.5,
  distortionStrength: 0.3,
  // Color
  mainColor: '#00ffff',
  mainIntensity: 0.3,
  coreColor: '#00ffff',
  coreIntensity: 50,
  coreThreshold: 0.75,
  // Pulse
  pulseSpeed: 1,
  pulseStrength: 0.07,
  // Aberration
  aberrationOffset: 0.1,
  // Opacity
  opacityMin: 0.32,
  opacityMax: 0.69,
  globalOpacity: 0.15,
};

// Geometry folder
const geoFolder = gui.addFolder('Geometry & Displacement');
geoFolder.add(params, 'dispStrength', 0, 0.5).onChange(v => updateUniform(uDispStrength, v));
geoFolder.add(params, 'dispScale', 0.5, 5).onChange(v => updateUniform(uDispScale, v));

// Vortex folder
const vortexFolder = gui.addFolder('Vortex & Flow');
vortexFolder.add(params, 'vortexScale', 0.05, 1).onChange(v => updateUniform(uVortexScale, v));
vortexFolder.add(params, 'vortexSpeed', 0, 0.5).onChange(v => updateUniform(uVortexSpeed, v));
vortexFolder.add(params, 'rotationSpeed', -0.5, 0.5).onChange(v => updateUniform(uRotationSpeed, v));
vortexFolder.add(params, 'twistAmount', 0, 360).onChange(v => updateUniform(uTwistAmount, v));

// Electric folder
const elecFolder = gui.addFolder('Electric Arcs');
elecFolder.add(params, 'elecScale', 0.5, 3).onChange(v => updateUniform(uElecScale, v));
elecFolder.add(params, 'elecSharpness', 1, 20).onChange(v => updateUniform(uElecSharpness, v));
elecFolder.add(params, 'elecFlowSpeed', 0, 5).onChange(v => updateUniform(uElecFlowSpeed, v));
elecFolder.add(params, 'distortionStrength', 0, 1).onChange(v => updateUniform(uDistortionStrength, v));

// Color folder
const colorFolder = gui.addFolder('Color & Intensity');
colorFolder.addColor(params, 'mainColor').onChange(v => uMainColor.value.set(v));
colorFolder.add(params, 'mainIntensity', 0, 1).onChange(v => updateUniform(uMainIntensity, v));
colorFolder.addColor(params, 'coreColor').onChange(v => uCoreColor.value.set(v));
colorFolder.add(params, 'coreIntensity', 0, 100).onChange(v => updateUniform(uCoreIntensity, v));
colorFolder.add(params, 'coreThreshold', 0.5, 1).onChange(v => updateUniform(uCoreThreshold, v));

// Pulse folder
const pulseFolder = gui.addFolder('Pulse & Effects');
pulseFolder.add(params, 'pulseSpeed', 0, 5).onChange(v => updateUniform(uPulseSpeed, v));
pulseFolder.add(params, 'pulseStrength', 0, 0.5).onChange(v => updateUniform(uPulseStrength, v));
pulseFolder.add(params, 'aberrationOffset', 0, 0.5).onChange(v => updateUniform(uAberrationOffset, v));

// Opacity folder
const opacityFolder = gui.addFolder('Opacity');
opacityFolder.add(params, 'opacityMin', 0, 1).onChange(v => updateUniform(uOpacityMin, v));
opacityFolder.add(params, 'opacityMax', 0, 1).onChange(v => updateUniform(uOpacityMax, v));
opacityFolder.add(params, 'globalOpacity', 0, 1).name('transparency').onChange(v => updateUniform(uGlobalOpacity, v));

// Scene setup - transparent background
const scene = new THREE.Scene();
// No background color - will be transparent

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 3);

// WebGPU Renderer with alpha transparency
const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ── SHADER LOGIC (TSL) ──

// Access basic context data
const pos = positionLocal;
const normal = normalView;
const viewDir = positionViewDirection;

// Time management
const safeTime = time.mod(600.0);
const PI2 = float(Math.PI * 2);
const periodicTime = time.mod(PI2);

// Global Pulse: Drives the breathing/flicker of the entire object
const pulse = sin(periodicTime.mul(uPulseSpeed))
  .mul(uPulseStrength)
  .add(1.0);

// ── STEP 1: Geometry Displacement (Shape) ──

// A. Macro Shape: Large, slow-moving vortex noise
const vortexTime = safeTime.mul(uVortexSpeed);
const vortexNoise = mx_noise_float(
  pos.mul(uVortexScale).add(vec3(0, vortexTime, 0)),
);

// B. Micro Detail: Fast, high-frequency surface noise
const dispTime = safeTime.mul(0.8);
const highFreqNoise = mx_noise_float(
  pos.mul(uDispScale).add(vec3(0, dispTime, 0)),
);

// Combine Macro + Micro to get organic displacement
const combinedDisp = highFreqNoise.mul(vortexNoise).mul(2.0);

// Apply displacement along the normal vector
const displacement = normalLocal
  .mul(combinedDisp.mul(uDispStrength))
  .mul(pulse);

const newPosition = pos.add(displacement);

// ── STEP 2: Electric Arcs & Flow (Texture) ──

// Masking: More twist/action near the 'energy clumps'
const vortexStrength = smoothstep(0.0, 1.0, vortexNoise);

// Calculate rotation: Base spin + Vortex twisting
const baseRotation = safeTime.mul(uRotationSpeed);
const vortexRotation = vortexStrength.mul(uTwistAmount);
const totalRotationY = baseRotation.add(vortexRotation);

// Rotate the sampling coordinates
const rotatedPos = rotate(pos, vec3(totalRotationY, totalRotationY, 0));

// Domain Warping: Distort the coordinate space like a fluid
const distortionScale = 1.5;
const distortion = mx_noise_vec3(rotatedPos.mul(distortionScale));
const perturbedPos = rotatedPos.add(distortion.mul(uDistortionStrength));

// Scroll the texture coordinates upward over time
const mainTime = safeTime.mul(uElecFlowSpeed);
const baseCoord = perturbedPos.mul(uElecScale).add(vec3(0, mainTime, 0));

// Chromatic Aberration: Sample noise 3 times with slight offsets for RGB split
const noiseR = mx_noise_float(baseCoord.sub(vec3(uAberrationOffset)));
const elecR = noiseR.abs().oneMinus().pow(uElecSharpness);

const noiseG = mx_noise_float(baseCoord);
const elecG = noiseG.abs().oneMinus().pow(uElecSharpness);

const noiseB = mx_noise_float(baseCoord.add(vec3(uAberrationOffset)));
const elecB = noiseB.abs().oneMinus().pow(uElecSharpness);

const electricityVec3 = vec3(elecR, elecG, elecB);
const pulsedElectricity = electricityVec3.mul(pulse);

// ── STEP 3: Color Composition ──

// Layer 1: Deep Background
let finalColor = uDeepColor;

// Layer 2: Main Energy Shell (Cyan)
const cyanColor = uMainColor.mul(uMainIntensity);
finalColor = finalColor.add(cyanColor.mul(pulsedElectricity));

// Layer 3: Hot Core (White/Bright)
const coreMask = smoothstep(uCoreThreshold, 1.0, elecG);
const whiteColor = uCoreColor.mul(uCoreIntensity);
finalColor = mix(finalColor, whiteColor, coreMask);

// Layer 4: Fresnel Rim Light
const fresnel = dot(viewDir, normal).oneMinus().pow(uFresnelPower);
finalColor = finalColor.add(
  uRimColor.mul(uRimIntensity).mul(fresnel).mul(pulse),
);

// ── STEP 4: Opacity & Transparency ──
const baseOpacity = elecG.add(fresnel).smoothstep(uOpacityMin, uOpacityMax);
const opacity = baseOpacity.mul(uEntranceFade).mul(uGlobalOpacity); // Apply entrance fade and global opacity

// Create mesh - initially hidden
const geometry = new THREE.SphereGeometry(1, 256, 256);
const material = new THREE.MeshBasicNodeMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// Apply TSL nodes
material.positionNode = newPosition;
material.colorNode = finalColor;
material.opacityNode = opacity;

const mesh = new THREE.Mesh(geometry, material);
mesh.visible = false; // Start hidden until hand detected
mesh.scale.setScalar(0); // Start at scale 0 for entrance animation
scene.add(mesh);

// ── HAND TRACKING SETUP ──
const video = document.getElementById('webcam');
const loadingText = document.getElementById('loading');

let handLandmarker = undefined;
let lastVideoTime = -1;
let handDetected = false;

// Smooth hand position with exponential smoothing
let targetPosition = new THREE.Vector3(0, 0, 0);
let currentPosition = new THREE.Vector3(0, 0, 0);
const smoothingFactor = 0.45; // Lower = more smoothing

// Landmark canvas setup
const landmarksCanvas = document.getElementById('landmarks');
const landmarksCtx = landmarksCanvas.getContext('2d');
landmarksCanvas.width = window.innerWidth;
landmarksCanvas.height = window.innerHeight;

// Smoothed landmark positions (for visualization)
let smoothedLandmarks = {};
const landmarkSmoothing = 0.45; // Exponential smoothing alpha for landmarks

// Impact frame animation setup
const impactCanvas = document.getElementById('impact-frame');
const impactCtx = impactCanvas.getContext('2d');
impactCanvas.width = window.innerWidth;
impactCanvas.height = window.innerHeight;

let impactAnimation = {
  active: false,
  progress: 0,
  duration: 0.3, // seconds
  flashIntensity: 1,
  frameCount: 0, // For video flicker timing
};

// Draw anime-style impact frame with sketchy hand-drawn lines
function drawImpactFrame(ctx, progress, width, height, time) {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.max(width, height) * 0.9;
  
  ctx.clearRect(0, 0, width, height);
  
  // Calculate fade alpha
  const fadeOut = Math.max(0, 1 - progress);
  
  // Dark vignette background
  ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * fadeOut})`;
  ctx.fillRect(0, 0, width, height);
  
  // White flash at start (intense)
  if (progress < 0.15) {
    const flashIntensity = 1 - (progress / 0.15);
    ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity})`;
    ctx.fillRect(0, 0, width, height);
  }
  
  ctx.save();
  ctx.translate(centerX, centerY);
  
  // Helper for sketchy line - draws multiple wobbly lines
  function drawSketchyLine(x1, y1, x2, y2, alpha, width) {
    const segments = 5;
    const wobble = 15 * (1 - progress * 0.5); // More wobble at start
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    
    // Draw 2-3 overlapping sketchy lines
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      ctx.moveTo(x1 + (Math.random() - 0.5) * wobble, y1 + (Math.random() - 0.5) * wobble);
      
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * wobble;
        const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * wobble;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  
  // Draw sketchy speed lines radiating from center (fewer lines)
  const numLines = 20; // Reduced from 50
  for (let i = 0; i < numLines; i++) {
    const angle = (i / numLines) * Math.PI * 2 + progress * 0.3;
    const innerRadius = 30 + Math.random() * 30;
    const outerRadius = maxRadius * (0.5 + progress * 0.5);
    
    const x1 = Math.cos(angle) * innerRadius;
    const y1 = Math.sin(angle) * innerRadius;
    const x2 = Math.cos(angle) * outerRadius;
    const y2 = Math.sin(angle) * outerRadius;
    
    drawSketchyLine(x1, y1, x2, y2, fadeOut * 0.9, 4);
  }
  
  // Draw sketchy impact circles (fewer circles)
  const numCircles = 2; // Reduced from 4
  for (let i = 0; i < numCircles; i++) {
    const delay = i * 0.08;
    const circleProgress = Math.max(0, Math.min((progress - delay) / 0.3, 1));
    const radius = 50 + circleProgress * maxRadius * 0.6;
    
    // Draw wobbly circle as multiple segments
    const segments = 12; // Reduced from 20
    ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - circleProgress) * fadeOut})`;
    ctx.lineWidth = 12 * (1 - circleProgress);
    ctx.lineCap = 'round';
    
    for (let r = 0; r < 2; r++) { // Draw twice for sketchy effect
      ctx.beginPath();
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        const wobble = 15 * (1 - circleProgress);
        const rWobble = radius + (Math.random() - 0.5) * wobble;
        const x = Math.cos(angle) * rWobble;
        const y = Math.sin(angle) * rWobble;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  
  // Draw sketchy cross lines
  drawSketchyLine(-maxRadius, 0, maxRadius, 0, fadeOut * 0.8, 8);
  drawSketchyLine(0, -maxRadius, 0, maxRadius, fadeOut * 0.8, 8);
  
  // Single center burst dot
  ctx.beginPath();
  ctx.arc(0, 0, 30 + progress * 50, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${fadeOut * 0.4})`;
  ctx.fill();
  
  ctx.restore();
}

// Ball floats above hand (Y offset)
const Y_OFFSET = 0.8;
const BALL_SCALE = 0.5; // Global scale multiplier (0.5 = half size)

// Direct wrist tracking - simple 1:1 mapping from wrist x to world x
// MediaPipe wrist.x: 0 (left) to 1 (right)
// Three.js world: roughly -3 (left) to 3 (right)

// Gesture confirmation frames (prevents false positives)
const REQUIRED_CONFIRM_FRAMES = 5;
let spawnConfirmCount = 0;
let shootConfirmCount = 0;

// Prevent misfires on first hand detection
const INITIAL_SPAWN_DELAY = 0.5; // seconds
let firstHandDetectedTime = null;
let handEverDetected = false;

// Ball state management - make accessible globally for debugging
window.ballState = 'hidden'; // 'hidden', 'active', 'shooting'
let ballAppeared = false; // Once true, ball stays until shot

// Entrance animation state
let entranceProgress = 0;
let wasHandDetected = false;
const ENTRANCE_DURATION = 2.0; // seconds - slower, more gradual
const OPACITY_FADE_DURATION = 0.8; // opacity fades in slightly faster

// Shooting animation state
let shootProgress = 0;
const SHOOT_DURATION = 0.6; // seconds to reach camera
let shootStartZ = 0;
let shootStartX = 0;
let shootStartY = 0;

// Smooth easing functions
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function easeOutQuart(x) {
  return 1 - Math.pow(1 - x, 4);
}

// Initialize MediaPipe HandLandmarker
async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
  );
  
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 1
  });
  
  loadingText.textContent = 'Camera starting...';
  startWebcam();
}

// Start webcam
function startWebcam() {
  const constraints = {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      facingMode: 'user'
    }
  };
  
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener('loadeddata', () => {
      loadingText.style.display = 'none';
      predictWebcam();
    });
  }).catch((err) => {
    loadingText.textContent = 'Camera access denied or not available';
    console.error(err);
  });
}

// Process video frames for hand detection
async function predictWebcam() {
  if (!handLandmarker || !video.videoWidth) {
    requestAnimationFrame(predictWebcam);
    return;
  }
  
  let startTimeMs = performance.now();
  
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, startTimeMs);
    
    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      // Get wrist position
      const wrist = landmarks[0];
      
      // Landmark indices
      const fingertips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky tips
      const knuckles = [2, 5, 9, 13, 17]; // Corresponding knuckles (MCP joints)
      const landmarkIndices = [0, 4, 8, 12, 16, 20]; // Wrist + 5 fingertips
      
      // Tolerance for activation gesture
      const TOLERANCE = 0.15;
      
      // Check if all fingertips are lower than or slightly above wrist (activation gesture)
      const allFingertipsLower = fingertips.every(idx => landmarks[idx].y >= wrist.y - TOLERANCE);
      
      // Check SHOOT gesture: 4 fingers extended upward (excluding thumb)
      // Index(8), Middle(12), Ring(16), Pinky(20) tips must be higher than their knuckles
      const shootFingertips = [8, 12, 16, 20]; // Exclude thumb (4)
      const shootKnuckles = [5, 9, 13, 17]; // Corresponding knuckles
      
      const allFingersExtended = shootFingertips.every((tipIdx, i) => {
        const knuckleIdx = shootKnuckles[i];
        return landmarks[tipIdx].y < landmarks[knuckleIdx].y - 0.05; // Tips clearly above knuckles
      });
      
      // Track first hand detection for spawn delay
      if (!handEverDetected) {
        handEverDetected = true;
        firstHandDetectedTime = performance.now();
      }
      
      // Check if enough time has passed since first hand detection
      const timeSinceFirstHand = (performance.now() - firstHandDetectedTime) / 1000;
      const canSpawn = timeSinceFirstHand >= INITIAL_SPAWN_DELAY;
      
      // Handle state transitions with frame confirmation
      if (window.ballState === 'hidden') {
        if (allFingertipsLower && canSpawn) {
          spawnConfirmCount++;
          if (spawnConfirmCount >= REQUIRED_CONFIRM_FRAMES) {
            // Activate ball - it appears and stays
            window.ballState = 'active';
            ballAppeared = true;
            handDetected = true;
            spawnConfirmCount = 0;
            
            // Set initial position - directly above wrist in 2D space
            // X: inverted to match mirrored webcam (wrist.x 0-1 -> world x 3 to -3)
            targetPosition.x = (0.5 - wrist.x) * 6;
            // Y: wrist.y (0-1, top to bottom) -> world y (1.5 to -1.5)
            targetPosition.y = (0.5 - wrist.y) * 3;
            targetPosition.z = -Math.abs(wrist.z) * 2;
            currentPosition.copy(targetPosition);
          }
        } else {
          spawnConfirmCount = 0; // Reset if gesture lost or can't spawn yet
        }
      }
      else if (window.ballState === 'active') {
        // Ball is active - update position but don't hide
        if (allFingersExtended) {
          shootConfirmCount++;
          if (shootConfirmCount >= REQUIRED_CONFIRM_FRAMES) {
            // SHOOT!
            window.ballState = 'shooting';
            shootStartX = mesh.position.x;
            shootStartY = mesh.position.y;
            shootStartZ = mesh.position.z;
            shootProgress = 0;
            shootConfirmCount = 0;
          }
        } else {
          shootConfirmCount = 0; // Reset if gesture lost
          // Normal tracking - position directly above wrist (inverted x for mirror)
          targetPosition.x = (0.5 - wrist.x) * 6;
          targetPosition.y = (0.5 - wrist.y) * 3;
          targetPosition.z = -Math.abs(wrist.z) * 2;
        }
        handDetected = true;
      }
      
      // Exponential smoothing for landmarks and draw them
      landmarksCtx.clearRect(0, 0, landmarksCanvas.width, landmarksCanvas.height);
      
      for (const idx of landmarkIndices) {
        const lm = landmarks[idx];
        
        // Initialize if not exists
        if (!smoothedLandmarks[idx]) {
          smoothedLandmarks[idx] = { x: lm.x, y: lm.y };
        } else {
          // Exponential smoothing: new = old * (1-alpha) + raw * alpha
          smoothedLandmarks[idx].x = smoothedLandmarks[idx].x * (1 - landmarkSmoothing) + lm.x * landmarkSmoothing;
          smoothedLandmarks[idx].y = smoothedLandmarks[idx].y * (1 - landmarkSmoothing) + lm.y * landmarkSmoothing;
        }
        
        // Draw white square (10x10 pixels)
        // Mirror X to match the mirrored video (CSS transform: scaleX(-1))
        const x = (1 - smoothedLandmarks[idx].x) * landmarksCanvas.width;
        const y = smoothedLandmarks[idx].y * landmarksCanvas.height;
        
        landmarksCtx.fillStyle = 'white';
        landmarksCtx.fillRect(x - 7, y - 7, 14, 14);
      }
      
      // If shooting, don't update hand position anymore
    } else {
      // No hand detected - but ball stays if already appeared
      handDetected = window.ballState !== 'hidden';
      // Clear landmarks when no hand
      landmarksCtx.clearRect(0, 0, landmarksCanvas.width, landmarksCanvas.height);
      smoothedLandmarks = {};
      // Reset first hand detection when hand is lost (only if ball is hidden)
      if (window.ballState === 'hidden') {
        handEverDetected = false;
        firstHandDetectedTime = null;
      }
    }
  }
  
  requestAnimationFrame(predictWebcam);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  landmarksCanvas.width = window.innerWidth;
  landmarksCanvas.height = window.innerHeight;
  impactCanvas.width = window.innerWidth;
  impactCanvas.height = window.innerHeight;
});

// Animation loop with hand position smoothing, entrance and shooting animation
async function animate() {
  const deltaTime = 0.016; // approx 60fps
  
  // Handle entrance animation trigger
  if (handDetected && !wasHandDetected && window.ballState !== 'hidden') {
    entranceProgress = 0;
  }
  wasHandDetected = handDetected;
  
  // Update entrance animation progress
  if (window.ballState !== 'hidden' && entranceProgress < 1) {
    entranceProgress += deltaTime / ENTRANCE_DURATION;
    entranceProgress = Math.min(entranceProgress, 1);
  }
  
  // Calculate entrance values
  const scaleProgress = easeOutQuart(entranceProgress);
  const opacityProgress = Math.min(entranceProgress / (OPACITY_FADE_DURATION / ENTRANCE_DURATION), 1);
  uEntranceFade.value = easeOutCubic(opacityProgress);
  
  if (window.ballState === 'hidden') {
    mesh.visible = false;
  }
  else if (window.ballState === 'active') {
    // Normal hand tracking
    currentPosition.lerp(targetPosition, smoothingFactor);
    
    // Apply position with Y offset so ball floats above hand
    mesh.position.x = currentPosition.x;
    mesh.position.y = currentPosition.y + Y_OFFSET;
    mesh.position.z = currentPosition.z;
    
    // Calculate base scale from Z depth
    const baseScale = (1 + (currentPosition.z + 1) * 0.3) * BALL_SCALE;
    mesh.scale.setScalar(baseScale * scaleProgress);
    
    mesh.visible = true;
  }
  else if (window.ballState === 'shooting') {
    // Update shoot progress
    shootProgress += deltaTime / SHOOT_DURATION;
    
    // Start impact animation slightly before ball reaches camera (at 85%)
    if (shootProgress >= 0.85 && !impactAnimation.active) {
      impactAnimation.active = true;
      impactAnimation.progress = 0;
      impactAnimation.frameCount = 0;
      video.classList.add('impact-flash');
    }
    
    if (shootProgress >= 1) {
      // Reset ball after shot completes
      window.ballState = 'hidden';
      ballAppeared = false;
      entranceProgress = 0;
      shootProgress = 0;
      spawnConfirmCount = 0;
      shootConfirmCount = 0;
      mesh.visible = false;
    } else {
      // Shooting animation - move toward camera center
      // Ease in for dramatic acceleration
      const shootEase = shootProgress * shootProgress; // easeInQuad
      
      // Move from current position toward camera center (x=0, y=0, z=2.5)
      const endZ = 2.5; // Just before camera
      mesh.position.x = shootStartX * (1 - shootEase); // Lerp to 0
      mesh.position.y = shootStartY * (1 - shootEase); // Lerp to 0
      mesh.position.z = shootStartZ + (endZ - shootStartZ) * shootEase;
      
      // Keep constant scale during shoot
      mesh.scale.setScalar(BALL_SCALE);
      
      mesh.visible = true;
    }
  }
  
  await renderer.renderAsync(scene, camera);
  controls.update();
  
  // Update impact frame animation
  if (impactAnimation.active) {
    impactAnimation.progress += deltaTime / impactAnimation.duration;
    impactAnimation.frameCount++;
    
    // Random flicker between B&W and normal (every 2-4 frames)
    if (impactAnimation.frameCount % (2 + Math.floor(Math.random() * 3)) === 0) {
      if (Math.random() > 0.2) { // 80% chance of B&W
        video.classList.add('impact-bw');
      } else {
        video.classList.remove('impact-bw');
      }
    }
    
    if (impactAnimation.progress >= 1) {
      impactAnimation.active = false;
      impactAnimation.progress = 0;
      impactAnimation.frameCount = 0;
      impactCtx.clearRect(0, 0, impactCanvas.width, impactCanvas.height);
      // Remove video flash effects
      video.classList.remove('impact-flash');
      video.classList.remove('impact-bw');
    } else {
      drawImpactFrame(impactCtx, impactAnimation.progress, impactCanvas.width, impactCanvas.height, performance.now());
    }
  }
  
  requestAnimationFrame(animate);
}

// Reset function for testing (call from console: resetBall())
window.resetBall = function() {
  window.ballState = 'hidden';
  ballAppeared = false;
  entranceProgress = 0;
  shootProgress = 0;
  spawnConfirmCount = 0;
  shootConfirmCount = 0;
  handEverDetected = false;
  firstHandDetectedTime = null;
  mesh.visible = false;
  uEntranceFade.value = 0;
  impactAnimation.active = false;
  impactAnimation.progress = 0;
  impactAnimation.frameCount = 0;
  impactCtx.clearRect(0, 0, impactCanvas.width, impactCanvas.height);
  video.classList.remove('impact-flash');
  video.classList.remove('impact-bw');
  console.log('Ball reset');
};

// Initialize and start
await renderer.init();
createHandLandmarker();
animate();
