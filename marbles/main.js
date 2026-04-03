import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { initializeSoundEffects } from "./sound-effects.js";
import { initializeHandTracking, stopHandTracking, isHandTrackingEnabled } from "./hand-tracking.js";
import {
  roomSize,
  halfRoom,
  palettes,
  cameraConfig,
  controlsConfig,
  initialUiState
} from "./config.js";
import { createRoomMaterial } from "./materials.js";
import { createSphere } from "./spheres.js";
import {
  createCameraInertiaState,
  createZoomState,
  setupCameraControls,
  setupZoomListener,
  applySmoothZoom,
  applyCameraInertia,
  updateCameraInertiaTracking
} from "./camera.js";
import {
  getUiElements,
  updateSphereCount,
  updateBrightness,
  updateGlowStrength,
  updateSpeed,
  updateSphereSizeUI,
  initializeUiControls
} from "./ui.js";
import { updateSpheres, updateGlowBillboards } from "./animation.js";

// Initialize sound effects
initializeSoundEffects();

// Get container element
const container = document.getElementById("experience");

// Setup renderer
const renderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  alpha: true, 
  powerPreference: "high-performance" 
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;

// Set canvas z-index to be above webcam feed (z-index: 0) but below hand tracking overlay (z-index: 1000)
renderer.domElement.style.position = 'relative';
renderer.domElement.style.zIndex = '10';

container.appendChild(renderer.domElement);

// Setup scene
const scene = new THREE.Scene();
scene.background = new THREE.Color("#fffef1");

// Store original background for toggling
const originalBackground = scene.background.clone();

// Setup environment
const pmrem = new THREE.PMREMGenerator(renderer);
const envRenderTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRenderTarget.texture;
pmrem.dispose();

// Calculate horizontal offset for cube positioning
const horizontalOffset = roomSize * 0.8; // Shift cube to the right

// Create container group for cube and spheres (so they rotate together)
const cubeContainer = new THREE.Group();
cubeContainer.position.set(horizontalOffset, 0, 0); // Position at the target point
scene.add(cubeContainer);

// Create room (cube boundary)
const roomGeometry = new THREE.BoxGeometry(roomSize, roomSize, roomSize);
const roomMaterial = createRoomMaterial();
const roomMesh = new THREE.Mesh(roomGeometry, roomMaterial);
cubeContainer.add(roomMesh);

// Create wireframe for the cube
const wireframeMaterial = new THREE.LineBasicMaterial({ 
  color: 0xffffff,
  transparent: true,
  opacity: 0.3,
  linewidth: 1
});
const cubeWireframeGeometry = new THREE.EdgesGeometry(roomGeometry);
const cubeWireframe = new THREE.LineSegments(cubeWireframeGeometry, wireframeMaterial);
cubeContainer.add(cubeWireframe);

// Setup camera
const camera = new THREE.PerspectiveCamera(
  cameraConfig.fov,
  window.innerWidth / window.innerHeight,
  cameraConfig.near,
  cameraConfig.far
);
const cameraRadius = roomSize * cameraConfig.radiusMultiplier;
const cameraVerticalOffset = roomSize * cameraConfig.verticalOffsetMultiplier;

// Position camera to view cube on the right side of screen
// Move camera left and target right to shift cube right
camera.position.set(-horizontalOffset, cameraVerticalOffset, cameraRadius);
scene.add(camera);

// Setup controls with target at cube container position (center of rotation)
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(cubeContainer.position); // Target the cube container's position
controls.enableDamping = controlsConfig.enableDamping;
controls.dampingFactor = controlsConfig.dampingFactor;
controls.enablePan = controlsConfig.enablePan;
controls.rotateSpeed = controlsConfig.rotateSpeed;
controls.zoomSpeed = controlsConfig.zoomSpeed;
controls.enableZoom = controlsConfig.enableZoom;
controls.minPolarAngle = controlsConfig.minPolarAngle;
controls.maxPolarAngle = controlsConfig.maxPolarAngle;
controls.minDistance = roomSize * controlsConfig.minDistanceMultiplier;
controls.maxDistance = roomSize * controlsConfig.maxDistanceMultiplier;
controls.update();

// Setup camera inertia and zoom
const controlsInertia = createCameraInertiaState(controls);
const zoomState = createZoomState(camera, controls);
setupCameraControls(controls, controlsInertia);
setupZoomListener(renderer, zoomState, controls);

// Create sphere group (inside the cube container)
const sphereGroup = new THREE.Group();
cubeContainer.add(sphereGroup);

// Initialize state
const spheres = [];
let currentPaletteName = "neon";
let currentPalette = palettes[currentPaletteName];

const uiState = { ...initialUiState };
const motionState = {
  speedMultiplier: uiState.speed
};

// Get UI elements
const uiElements = getUiElements();

// Initialize UI controls with current values
updateSphereSizeUI(spheres, uiState, uiElements, uiState.sphereSizeScale);
updateSphereCount(spheres, sphereGroup, currentPalette, uiState, uiElements, uiState.sphereCount);
updateBrightness(spheres, renderer, uiState, uiElements, uiState.brightness);
updateGlowStrength(spheres, uiState, uiElements, uiState.glowStrength);
updateSpeed(motionState, uiState, uiElements, uiState.speed);

// FPS tracking
let fpsFrameCount = 0;
let fpsLastTime = performance.now();

// Pause state
const isPausedState = { value: false };

// Hand tracking state
let isHandTrackingActive = false;
let handRotationSpeed = 0;

// Palette cycling for fist gesture
const paletteNames = Object.keys(palettes);
let currentPaletteIndex = paletteNames.indexOf(currentPaletteName);

function cyclePalette() {
  currentPaletteIndex = (currentPaletteIndex + 1) % paletteNames.length;
  currentPaletteName = paletteNames[currentPaletteIndex];
  currentPalette = palettes[currentPaletteName];
  
  // Update spheres with new palette
  updateSphereCount(spheres, sphereGroup, currentPalette, uiState, uiElements, uiState.sphereCount);
  
  // Update UI dropdown to reflect the change
  if (uiElements.paletteSelect) {
    uiElements.paletteSelect.value = currentPaletteName;
  }
}

// Camera toggle handler
function handleCameraToggle() {
  if (isHandTrackingActive) {
    // Stop hand tracking
    stopHandTracking();
    isHandTrackingActive = false;
    handRotationSpeed = 0;
    
    // Restore scene background
    scene.background = originalBackground;
    
    // Restore canvas to full width
    renderer.domElement.style.width = '100%';
    handleResize();
    
    return false;
  } else {
    // Start hand tracking
    initializeHandTracking(
      (speed) => {
        // Update speed based on finger distance
        updateSpeed(motionState, uiState, uiElements, speed);
      },
      (rotSpeed, angle) => {
        // Update rotation speed based on hand orientation
        handRotationSpeed = rotSpeed;
      },
      () => {
        // Cycle palette on fist detection
        cyclePalette();
      },
      (brightness) => {
        // Update brightness based on index finger Y position
        updateBrightness(spheres, renderer, uiState, uiElements, brightness);
      }
    );
    isHandTrackingActive = true;
    
    // Make scene background transparent
    scene.background = null;
    
    // Set canvas to 75% width when camera active
    renderer.domElement.style.width = '75%';
    handleResize();
    
    return true;
  }
}

// Setup UI event listeners
initializeUiControls(
  spheres,
  sphereGroup,
  currentPalette,
  palettes,
  uiState,
  motionState,
  uiElements,
  renderer,
  isPausedState,
  (newPaletteName) => {
    currentPaletteName = newPaletteName;
    currentPalette = palettes[newPaletteName];
  },
  handleCameraToggle
);

// Setup clock for animation
const clock = new THREE.Clock();
let elapsedTime = 0;

// Animation loop
function renderLoop() {
  // FPS tracking
  fpsFrameCount++;
  const currentTime = performance.now();
  const elapsed = currentTime - fpsLastTime;
  
  if (elapsed >= 1000) {
    const fps = Math.round((fpsFrameCount * 1000) / elapsed);
    if (uiElements.fpsCounter) {
      uiElements.fpsCounter.textContent = `${fps} FPS`;
    }
    fpsFrameCount = 0;
    fpsLastTime = currentTime;
  }

  // Skip updates if paused, but still render
  if (!isPausedState.value) {
    const delta = Math.min(clock.getDelta(), 0.033);
    elapsedTime += delta;

    applySmoothZoom(camera, controls, zoomState, delta);
    applyCameraInertia(camera, controls, controlsInertia, delta);
    controls.update();
    updateCameraInertiaTracking(controls, controlsInertia, delta);

    // Apply hand rotation to cube container (rotates cube, wireframe, and spheres together)
    if (isHandTrackingActive && handRotationSpeed !== 0) {
      // Rotate around Y axis based on hand orientation
      // Speed is normalized -1 to 1, multiply by rotation rate
      // Negate handRotationSpeed to match intuitive direction
      const rotationRate = 2.5; // radians per second at full tilt (increased from 1.5)
      cubeContainer.rotation.y += -handRotationSpeed * rotationRate * delta;
    }

    updateSpheres(spheres, currentPalette, uiState, delta, elapsedTime);
    updateGlowBillboards(spheres, camera);
  } else {
    controls.update();
    clock.getDelta(); // Consume delta to prevent time jump on unpause
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(renderLoop);

// Handle visibility change
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clock.stop();
    renderer.setAnimationLoop(null);
  } else {
    clock.start();
    renderer.setAnimationLoop(renderLoop);
  }
});

// Handle window resize
function handleResize() {
  // Calculate width based on hand tracking state
  const canvasWidth = isHandTrackingActive ? window.innerWidth * 0.7 : window.innerWidth;
  
  camera.aspect = canvasWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(canvasWidth, window.innerHeight);
  controls.update();
}

window.addEventListener("resize", handleResize);

// Cleanup on unload
window.addEventListener("unload", () => {
  envRenderTarget.dispose();
});