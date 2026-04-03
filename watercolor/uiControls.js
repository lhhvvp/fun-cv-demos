// Enhanced mouse controls with inertia (disabled when hand tracking is active)
const glCanvas = document.getElementById("glCanvas");

glCanvas.addEventListener("mousedown", (e) => {
  if (isHandTrackingActive) return;
  isDragging = true;
  mouseX = e.clientX;
  mouseY = e.clientY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  lastMoveTime = Date.now();
  velocityX = 0;
  velocityY = 0;
});

glCanvas.addEventListener("mousemove", (e) => {
  if (isHandTrackingActive) return;
  if (isDragging) {
    const currentTime = Date.now();
    const deltaTime = Math.max(1, currentTime - lastMoveTime);
    
    const deltaX = e.clientX - mouseX;
    const deltaY = e.clientY - mouseY;

    targetRotationY += deltaX * ROTATION_SENSITIVITY;
    targetRotationX += deltaY * ROTATION_SENSITIVITY;

    velocityY = (deltaX * ROTATION_SENSITIVITY) / deltaTime * 16;
    velocityX = (deltaY * ROTATION_SENSITIVITY) / deltaTime * 16;

    mouseX = e.clientX;
    mouseY = e.clientY;
    lastMoveTime = currentTime;
  }
});

glCanvas.addEventListener("mouseup", () => {
  isDragging = false;
});

glCanvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

// Enhanced touch controls with inertia
let touchStartX = 0;
let touchStartY = 0;
let lastTouchX = 0;
let lastTouchY = 0;
let lastTouchTime = 0;

glCanvas.addEventListener("touchstart", (e) => {
  if (isHandTrackingActive) return;
  if (e.touches.length === 1) {
    isDragging = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    lastTouchTime = Date.now();
    velocityX = 0;
    velocityY = 0;
  }
});

glCanvas.addEventListener("touchmove", (e) => {
  if (isHandTrackingActive) return;
  if (isDragging && e.touches.length === 1) {
    const currentTime = Date.now();
    const deltaTime = Math.max(1, currentTime - lastTouchTime);
    
    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;

    targetRotationY += deltaX * ROTATION_SENSITIVITY;
    targetRotationX += deltaY * ROTATION_SENSITIVITY;

    velocityY = (deltaX * ROTATION_SENSITIVITY) / deltaTime * 16;
    velocityX = (deltaY * ROTATION_SENSITIVITY) / deltaTime * 16;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    lastTouchTime = currentTime;
  }
});

glCanvas.addEventListener("touchend", () => {
  isDragging = false;
});

// Enhanced mouse wheel scale with inertia
glCanvas.addEventListener(
  "wheel",
  (e) => {
    if (isHandTrackingActive) return;
    e.preventDefault();
    
    const scrollDelta = e.deltaY * SCALE_SENSITIVITY;
    scaleVelocity -= scrollDelta;
    
    scaleVelocity = Math.max(-0.1, Math.min(0.1, scaleVelocity));
  },
  { passive: false }
);

// Hand tracking button
const handTrackingBtn = document.getElementById("handTrackingBtn");
handTrackingBtn.addEventListener("click", async () => {
  if (!isHandTrackingActive) {
    handTrackingBtn.textContent = "INITIALIZING...";
    handTrackingBtn.disabled = true;
    
    const success = await initializeHandTracking();
    
    if (success) {
      handTrackingBtn.textContent = "STOP TRACKING";
      handTrackingBtn.classList.add("active");
    } else {
      handTrackingBtn.textContent = "START HAND TRACKING";
    }
    handTrackingBtn.disabled = false;
  } else {
    stopHandTracking();
    handTrackingBtn.textContent = "START HAND TRACKING";
    handTrackingBtn.classList.remove("active");
  }
});

// Collapse/expand controls
const controlsEl = document.getElementById("controls");
const controlsHeader = document.getElementById("controlsHeader");
const toggleBtn = document.getElementById("toggleBtn");

controlsHeader.addEventListener("click", () => {
  controlsEl.classList.toggle("collapsed");
});

// Aspect ratio control
document.getElementById("aspectRatio").addEventListener("change", (e) => {
  aspectRatio = e.target.value;
  resizeCanvas();
});

// Auto-animate control
document.getElementById("autoRotate").addEventListener("change", (e) => {
  autoRotate = e.target.checked;
  if (autoRotate) {
    autoRotateTime = 0;
  }
});

// Flow Dynamics Controls
document.getElementById("flowSpeed").addEventListener("input", (e) => {
  flowSpeed = parseFloat(e.target.value);
  document.getElementById("flowSpeedValue").textContent = flowSpeed.toFixed(2);
});

document.getElementById("turbulence").addEventListener("input", (e) => {
  turbulence = parseFloat(e.target.value);
  document.getElementById("turbulenceValue").textContent = turbulence.toFixed(2);
});

document.getElementById("viscosity").addEventListener("input", (e) => {
  viscosity = parseFloat(e.target.value);
  document.getElementById("viscosityValue").textContent = viscosity.toFixed(2);
});

document.getElementById("vorticity").addEventListener("input", (e) => {
  vorticity = parseFloat(e.target.value);
  document.getElementById("vorticityValue").textContent = vorticity.toFixed(2);
});

document.getElementById("swirlScale").addEventListener("input", (e) => {
  swirlScale = parseFloat(e.target.value);
  document.getElementById("swirlScaleValue").textContent = swirlScale.toFixed(1);
});

// Visual Style Controls
document.getElementById("colorMode").addEventListener("change", (e) => {
  colorMode = parseInt(e.target.value);
});

document.getElementById("colorIntensity").addEventListener("input", (e) => {
  colorIntensity = parseFloat(e.target.value);
  document.getElementById("colorIntensityValue").textContent = colorIntensity.toFixed(2);
});

document.getElementById("hueShift").addEventListener("input", (e) => {
  hueShift = parseFloat(e.target.value);
  document.getElementById("hueShiftValue").textContent = hueShift.toFixed(2);
});

document.getElementById("saturation").addEventListener("input", (e) => {
  saturation = parseFloat(e.target.value);
  document.getElementById("saturationValue").textContent = saturation.toFixed(2);
});

document.getElementById("brightness").addEventListener("input", (e) => {
  brightness = parseFloat(e.target.value);
  document.getElementById("brightnessValue").textContent = brightness.toFixed(2);
});

// Field Properties Controls

document.getElementById("fieldScale").addEventListener("input", (e) => {
  fieldScale = parseFloat(e.target.value);
  document.getElementById("fieldScaleValue").textContent = fieldScale.toFixed(2);
});

// Randomize button
document.getElementById("randomizeBtn").addEventListener("click", () => {
  const random = (min, max, step = 0.01) => {
    const range = (max - min) / step;
    return min + Math.floor(Math.random() * (range + 1)) * step;
  };

  // Randomize flow dynamics
  flowSpeed = random(0.1, 6.0);
  turbulence = random(0.0, 5.0);
  viscosity = random(0.01, 1.0);
  vorticity = random(0.0, 2.0);
  swirlScale = random(0.1, 10.0, 0.1);

  // Randomize visual style
  colorMode = Math.floor(Math.random() * 5);
  colorIntensity = random(0.3, 3.0);
  hueShift = random(0.0, 6.28);
  saturation = random(0.0, 2.0);
  brightness = random(0.8, 2.0);

  // Randomize field properties
  fieldScale = random(0.2, 4.0);

  // Random view position
  targetRotationX = random(-1, 1);
  targetRotationY = random(-1, 1);
  currentRotationX = targetRotationX;
  currentRotationY = targetRotationY;
  velocityX = 0;
  velocityY = 0;

  // Update all UI elements
  document.getElementById("flowSpeed").value = flowSpeed;
  document.getElementById("flowSpeedValue").textContent = flowSpeed.toFixed(2);

  document.getElementById("turbulence").value = turbulence;
  document.getElementById("turbulenceValue").textContent = turbulence.toFixed(2);

  document.getElementById("viscosity").value = viscosity;
  document.getElementById("viscosityValue").textContent = viscosity.toFixed(2);

  document.getElementById("vorticity").value = vorticity;
  document.getElementById("vorticityValue").textContent = vorticity.toFixed(2);

  document.getElementById("swirlScale").value = swirlScale;
  document.getElementById("swirlScaleValue").textContent = swirlScale.toFixed(1);

  document.getElementById("colorMode").value = colorMode;

  document.getElementById("colorIntensity").value = colorIntensity;
  document.getElementById("colorIntensityValue").textContent = colorIntensity.toFixed(2);

  document.getElementById("hueShift").value = hueShift;
  document.getElementById("hueShiftValue").textContent = hueShift.toFixed(2);

  document.getElementById("saturation").value = saturation;
  document.getElementById("saturationValue").textContent = saturation.toFixed(2);

  document.getElementById("brightness").value = brightness;
  document.getElementById("brightnessValue").textContent = brightness.toFixed(2);

  document.getElementById("fieldScale").value = fieldScale;
  document.getElementById("fieldScaleValue").textContent = fieldScale.toFixed(2);

});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ignore if user is typing in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }
  
  // 'r' key - Randomize All
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    document.getElementById("randomizeBtn").click();
  }
  
  // 'a' key - Toggle Auto-Animate
  if (e.key === 'a' || e.key === 'A') {
    e.preventDefault();
    const autoRotateCheckbox = document.getElementById("autoRotate");
    autoRotateCheckbox.checked = !autoRotateCheckbox.checked;
    autoRotateCheckbox.dispatchEvent(new Event('change'));
  }
  
  // 's' key - Save canvas as PNG
  if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    
    const canvas = document.getElementById("glCanvas");
    
    requestAnimationFrame(() => {
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.download = `cfd-fluid-${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }
  
  // '1-5' keys - Quick color mode switch
  if (e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    colorMode = parseInt(e.key) - 1;
    document.getElementById("colorMode").value = colorMode;
  }
});