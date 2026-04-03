// Hand tracking using MediaPipe Hands
let hands = null;
let camera = null;
let videoElement = null;
let canvasElement = null;
let canvasCtx = null;
let webcamCanvas = null;
let webcamCtx = null;
let isHandTrackingActive = false;
let onFingerDistanceChange = null;
let onHandRotationChange = null;
let onFistDetected = null;
let onBrightnessChange = null;

// Exponential smoothing for hand positions
let smoothedThumb = { x: 0, y: 0 };
let smoothedIndex = { x: 0, y: 0 };
let smoothedRotation = 0;
const SMOOTHING_FACTOR = 0.3; // 0 = no smoothing, 1 = max smoothing
const ROTATION_SMOOTHING = 0.2; // Slightly more responsive for rotation

// Speed change detection for glow effect
let lastSpeed = 1.5;
let speedChangeGlow = 0; // 0-1, decays over time
const SPEED_CHANGE_THRESHOLD = 0.05; // Minimum change to trigger glow
const GLOW_DECAY_RATE = 0.02; // How fast glow fades per frame

// Brightness change detection for glow effect
let lastBrightness = 1.0;
let brightnessChangeGlow = 0; // 0-1, decays over time
const BRIGHTNESS_CHANGE_THRESHOLD = 0.05; // Minimum change to trigger glow

// Fist detection state
let lastFistState = false;
let fistCooldown = 0;
const FIST_COOLDOWN_TIME = 1000; // 1 second cooldown between palette changes

const MEDIAPIPE_CONFIG = {
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
};

// Landmark indices for thumb tip and index finger tip
const THUMB_TIP = 4;
const INDEX_TIP = 8;

// Dead zone for rotation (when finger is pointing up, no rotation)
const ROTATION_DEAD_ZONE = 15; // degrees from vertical

export function isHandTrackingEnabled() {
  return isHandTrackingActive;
}

export async function initializeHandTracking(onDistanceCallback, onRotationCallback, onFistCallback, onBrightnessCallback) {
  if (typeof window.Hands === 'undefined') {
    console.error('MediaPipe Hands not loaded');
    return false;
  }

  onFingerDistanceChange = onDistanceCallback;
  onHandRotationChange = onRotationCallback;
  onFistDetected = onFistCallback;
  onBrightnessChange = onBrightnessCallback;

  // Create video element
  videoElement = document.createElement('video');
  videoElement.id = 'webcam-video';
  videoElement.style.display = 'none';
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  document.body.appendChild(videoElement);

  // Create canvas for webcam feed (background)
  webcamCanvas = document.createElement('canvas');
  webcamCanvas.id = 'webcam-canvas';
  webcamCanvas.style.position = 'fixed';
  webcamCanvas.style.top = '0';
  webcamCanvas.style.left = '0';
  webcamCanvas.style.width = '100%';
  webcamCanvas.style.height = '100%';
  webcamCanvas.style.objectFit = 'cover';
  webcamCanvas.style.pointerEvents = 'none';
  webcamCanvas.style.zIndex = '0';
  document.body.appendChild(webcamCanvas);
  
  webcamCtx = webcamCanvas.getContext('2d');

  // Create canvas for hand visualization (overlay)
  canvasElement = document.createElement('canvas');
  canvasElement.id = 'hand-tracking-canvas';
  canvasElement.style.position = 'fixed';
  canvasElement.style.top = '0';
  canvasElement.style.left = '0';
  canvasElement.style.width = '100%';
  canvasElement.style.height = '100%';
  canvasElement.style.pointerEvents = 'none';
  canvasElement.style.zIndex = '1000';
  document.body.appendChild(canvasElement);

  canvasCtx = canvasElement.getContext('2d');

  // Initialize MediaPipe Hands
  hands = new window.Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions(MEDIAPIPE_CONFIG);

  hands.onResults(onHandResults);

  // Get camera stream
  try {
    camera = new window.Camera(videoElement, {
      onFrame: async () => {
        if (isHandTrackingActive && hands) {
          // Draw webcam feed to background canvas (mirrored)
          drawWebcamFeed();
          // Send to MediaPipe
          await hands.send({ image: videoElement });
        }
      },
      width: 1920,
      height: 1080
    });

    await camera.start();
    isHandTrackingActive = true;
    
    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return true;
  } catch (error) {
    console.error('Error starting camera:', error);
    return false;
  }
}

function resizeCanvas() {
  if (canvasElement) {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
  }
  if (webcamCanvas) {
    webcamCanvas.width = window.innerWidth;
    webcamCanvas.height = window.innerHeight;
  }
}

function drawWebcamFeed() {
  if (!webcamCanvas || !webcamCtx || !videoElement) return;
  
  // Clear canvas
  webcamCtx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);
  
  // Save context state
  webcamCtx.save();
  
  // Mirror the webcam feed horizontally
  webcamCtx.translate(webcamCanvas.width, 0);
  webcamCtx.scale(-1, 1);
  
  // Calculate aspect ratio to fill screen
  const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
  const canvasAspect = webcamCanvas.width / webcamCanvas.height;
  
  let drawWidth, drawHeight, offsetX, offsetY;
  
  if (canvasAspect > videoAspect) {
    // Canvas is wider than video
    drawWidth = webcamCanvas.width;
    drawHeight = webcamCanvas.width / videoAspect;
    offsetX = 0;
    offsetY = (webcamCanvas.height - drawHeight) / 2;
  } else {
    // Canvas is taller than video
    drawWidth = webcamCanvas.height * videoAspect;
    drawHeight = webcamCanvas.height;
    offsetX = (webcamCanvas.width - drawWidth) / 2;
    offsetY = 0;
  }
  
  // Draw video frame
  webcamCtx.drawImage(videoElement, offsetX, offsetY, drawWidth, drawHeight);
  
  // Restore context state
  webcamCtx.restore();
}

function smoothPosition(current, target, factor) {
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor
  };
}

function onHandResults(results) {
  if (!canvasElement || !canvasCtx) return;

  // Clear overlay canvas
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Update fist cooldown
  if (fistCooldown > 0) {
    fistCooldown -= 16; // Approximate frame time in ms
  }

  // Decay speed change glow
  if (speedChangeGlow > 0) {
    speedChangeGlow = Math.max(0, speedChangeGlow - GLOW_DECAY_RATE);
  }

  // Decay brightness change glow
  if (brightnessChangeGlow > 0) {
    brightnessChangeGlow = Math.max(0, brightnessChangeGlow - GLOW_DECAY_RATE);
  }

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    // Get thumb tip and index finger tip positions
    const thumbTip = landmarks[THUMB_TIP];
    const indexTip = landmarks[INDEX_TIP];

    // Convert normalized coordinates to canvas coordinates (mirrored)
    const rawThumbX = (1 - thumbTip.x) * canvasElement.width; // Mirror horizontally
    const rawThumbY = thumbTip.y * canvasElement.height;
    const rawIndexX = (1 - indexTip.x) * canvasElement.width; // Mirror horizontally
    const rawIndexY = indexTip.y * canvasElement.height;

    // Apply exponential smoothing
    const targetThumb = { x: rawThumbX, y: rawThumbY };
    const targetIndex = { x: rawIndexX, y: rawIndexY };
    
    smoothedThumb = smoothPosition(smoothedThumb, targetThumb, SMOOTHING_FACTOR);
    smoothedIndex = smoothPosition(smoothedIndex, targetIndex, SMOOTHING_FACTOR);

    // Calculate distance using smoothed positions
    const distance = Math.sqrt(
      Math.pow(smoothedIndex.x - smoothedThumb.x, 2) + 
      Math.pow(smoothedIndex.y - smoothedThumb.y, 2)
    );

    // Detect fist (all fingertips close to palm)
    // Using wrist (0), middle finger tip (12), ring finger tip (16), pinky tip (20)
    const wrist = landmarks[0];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    // Calculate distances from fingertips to wrist
    const wristX = (1 - wrist.x) * canvasElement.width;
    const wristY = wrist.y * canvasElement.height;
    
    const middleX = (1 - middleTip.x) * canvasElement.width;
    const middleY = middleTip.y * canvasElement.height;
    const middleToWrist = Math.sqrt(Math.pow(middleX - wristX, 2) + Math.pow(middleY - wristY, 2));
    
    const ringX = (1 - ringTip.x) * canvasElement.width;
    const ringY = ringTip.y * canvasElement.height;
    const ringToWrist = Math.sqrt(Math.pow(ringX - wristX, 2) + Math.pow(ringY - wristY, 2));
    
    const pinkyX = (1 - pinkyTip.x) * canvasElement.width;
    const pinkyY = pinkyTip.y * canvasElement.height;
    const pinkyToWrist = Math.sqrt(Math.pow(pinkyX - wristX, 2) + Math.pow(pinkyY - wristY, 2));
    
    // Fist detected if all fingers are close to wrist
    const FIST_THRESHOLD = 100; // pixels
    const isFist = distance < FIST_THRESHOLD && 
                   middleToWrist < FIST_THRESHOLD && 
                   ringToWrist < FIST_THRESHOLD && 
                   pinkyToWrist < FIST_THRESHOLD;
    
    // Trigger palette change on fist close (edge detection)
    if (isFist && !lastFistState && fistCooldown <= 0 && onFistDetected) {
      onFistDetected();
      fistCooldown = FIST_COOLDOWN_TIME;
    }
    lastFistState = isFist;

    // Normalize distance to speed range (0.5 to 3.0)
    const minDistance = 20;
    const maxDistance = 300;
    const normalizedDistance = Math.max(0, Math.min(1, (distance - minDistance) / (maxDistance - minDistance)));
    const speed = 0.0 + normalizedDistance * 3.0;

    // Detect speed change
    const speedDelta = Math.abs(speed - lastSpeed);
    if (speedDelta > SPEED_CHANGE_THRESHOLD) {
      speedChangeGlow = 1.0; // Full glow on change
    }
    lastSpeed = speed;

    // Call the speed callback
    if (onFingerDistanceChange) {
      onFingerDistanceChange(speed);
    }

    // Calculate hand rotation angle (index finger direction)
    // Angle from index to thumb (represents hand orientation)
    const deltaX = smoothedThumb.x - smoothedIndex.x;
    const deltaY = smoothedThumb.y - smoothedIndex.y;
    
    // Calculate angle in degrees (0° = pointing up/north, 90° = pointing right/east)
    // atan2(x, y) gives us angle from vertical axis
    let angle = Math.atan2(deltaX, deltaY) * (180 / Math.PI);
    
    // Normalize to -180 to 180 range
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    
    // Apply smoothing to rotation
    const angleDiff = angle - smoothedRotation;
    // Handle wraparound for smoothing
    let adjustedDiff = angleDiff;
    if (adjustedDiff > 180) adjustedDiff -= 360;
    if (adjustedDiff < -180) adjustedDiff += 360;
    
    smoothedRotation += adjustedDiff * ROTATION_SMOOTHING;
    
    // Normalize smoothed rotation
    if (smoothedRotation > 180) smoothedRotation -= 360;
    if (smoothedRotation < -180) smoothedRotation += 360;

    // Check if fingers are too close - disable rotation if so
    const ROTATION_DISABLE_DISTANCE = 80; // pixels - disable rotation when fingers are close
    let rotationSpeed = 0;
    
    if (distance > ROTATION_DISABLE_DISTANCE) {
      // Apply dead zone around vertical (pointing up)
      if (Math.abs(smoothedRotation) > ROTATION_DEAD_ZONE) {
        // Map angle to rotation speed
        // -90° (left) = -1.0 speed, +90° (right) = +1.0 speed
        const effectiveAngle = smoothedRotation - Math.sign(smoothedRotation) * ROTATION_DEAD_ZONE;
        rotationSpeed = Math.max(-1, Math.min(1, effectiveAngle / (90 - ROTATION_DEAD_ZONE)));
      }
    }

    // Call the rotation callback
    if (onHandRotationChange) {
      onHandRotationChange(rotationSpeed, smoothedRotation);
    }

    // Calculate brightness based on index finger Y position
    // Lower Y value (top of screen) = brighter, Higher Y value (bottom) = dimmer
    const minY = canvasElement.height * 0.2; // Top 20% of screen
    const maxY = canvasElement.height * 0.8; // Bottom 80% of screen
    const normalizedY = Math.max(0, Math.min(1, (smoothedIndex.y - minY) / (maxY - minY)));
    // Invert so higher finger = brighter (0.2 to 2.0 range)
    const brightness = 2.0 - (normalizedY * 1.8);

    // Detect brightness change
    const brightnessDelta = Math.abs(brightness - lastBrightness);
    if (brightnessDelta > BRIGHTNESS_CHANGE_THRESHOLD) {
      brightnessChangeGlow = 1.0; // Full glow on change
    }
    lastBrightness = brightness;

    // Call the brightness callback
    if (onBrightnessChange) {
      onBrightnessChange(brightness);
    }

    // Draw visualization using smoothed positions
    drawHandTracking(smoothedThumb.x, smoothedThumb.y, smoothedIndex.x, smoothedIndex.y, speed, rotationSpeed, isFist, speedChangeGlow, brightness, brightnessChangeGlow);
  }
}

function drawHandTracking(thumbX, thumbY, indexX, indexY, speed, rotationSpeed, isFist, speedGlow, brightness, brightnessGlow) {
  if (!canvasCtx) return;

  // Determine if rotation is active
  const isRotationActive = Math.abs(rotationSpeed) > 0.01;

  // Draw line connecting thumb and index finger - always white
  canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  canvasCtx.lineWidth = 2;
  canvasCtx.shadowBlur = 0;
  canvasCtx.beginPath();
  canvasCtx.moveTo(thumbX, thumbY);
  canvasCtx.lineTo(indexX, indexY);
  canvasCtx.stroke();

  // Draw circles on fingertips
  canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  canvasCtx.strokeStyle = 'rgba(255, 255, 255, 1)';
  canvasCtx.lineWidth = 2;

  // Thumb tip
  canvasCtx.beginPath();
  canvasCtx.arc(thumbX, thumbY, 10, 0, 2 * Math.PI);
  canvasCtx.fill();
  canvasCtx.stroke();

  // Index finger tip (larger, as it indicates direction)
  canvasCtx.beginPath();
  canvasCtx.arc(indexX, indexY, 12, 0, 2 * Math.PI);
  canvasCtx.fill();
  canvasCtx.stroke();

  // Draw text info below thumb (increased size and moved down)
  canvasCtx.font = 'bold 24px monospace';
  canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  canvasCtx.lineWidth = 3;
  
  const textX = thumbX;
  const textY = thumbY + 60; // Moved down from 30
  
  // Format speed value - always white, add glow if recently changed
  const speedText = `SPEED: ${speed.toFixed(1)}`;
  canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  
  if (speedGlow > 0) {
    canvasCtx.shadowBlur = 8 * speedGlow;
    canvasCtx.shadowColor = `rgba(0, 255, 255, ${1.0 * speedGlow})`;
  } else {
    canvasCtx.shadowBlur = 0;
  }
  
  canvasCtx.strokeText(speedText, textX, textY);
  canvasCtx.fillText(speedText, textX, textY);
  
  // Reset shadow
  canvasCtx.shadowBlur = 0;
  
  // Format rotation text - always white, add glow if active
  let rotateText = 'ROTATE: OFF';
  if (Math.abs(rotationSpeed) > 0.01) {
    if (rotationSpeed < 0) {
      rotateText = 'ROTATE: RIGHT';
    } else {
      rotateText = 'ROTATE: LEFT';
    }
  }
  
  canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  
  if (isRotationActive) {
    canvasCtx.shadowBlur = 8;
    canvasCtx.shadowColor = 'rgba(0, 255, 255, 1.0)';
  } else {
    canvasCtx.shadowBlur = 0;
  }
  
  canvasCtx.strokeText(rotateText, textX, textY + 30);
  canvasCtx.fillText(rotateText, textX, textY + 30);
  
  // Reset shadow
  canvasCtx.shadowBlur = 0;
  
  // Format brightness text - always white, add glow if recently changed
  const brightnessText = `BRIGHTNESS: ${brightness.toFixed(1)}`;
  canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  
  if (brightnessGlow > 0) {
    canvasCtx.shadowBlur = 8 * brightnessGlow;
    canvasCtx.shadowColor = `rgba(0, 255, 255, ${0.9 * brightnessGlow})`;
  } else {
    canvasCtx.shadowBlur = 0;
  }
  
  canvasCtx.strokeText(brightnessText, textX, textY + 60);
  canvasCtx.fillText(brightnessText, textX, textY + 60);
  
  // Reset shadow
  canvasCtx.shadowBlur = 0;
  
  // Draw fist indicator if fist detected
  if (isFist) {
    const fistText = 'CHANGE PALETTE';
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    canvasCtx.strokeText(fistText, textX, textY + 90);
    canvasCtx.fillText(fistText, textX, textY + 90);
  }
}

export function stopHandTracking() {
  isHandTrackingActive = false;

  if (camera) {
    camera.stop();
    camera = null;
  }

  if (videoElement) {
    const stream = videoElement.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    videoElement.srcObject = null;
    videoElement.remove();
    videoElement = null;
  }

  if (canvasElement) {
    canvasElement.remove();
    canvasElement = null;
  }

  if (webcamCanvas) {
    webcamCanvas.remove();
    webcamCanvas = null;
  }

  canvasCtx = null;
  webcamCtx = null;
  
  // Reset smoothed positions
  smoothedThumb = { x: 0, y: 0 };
  smoothedIndex = { x: 0, y: 0 };
  smoothedRotation = 0;
  lastFistState = false;
  fistCooldown = 0;
  lastSpeed = 1.5;
  speedChangeGlow = 0;
  lastBrightness = 1.0;
  brightnessChangeGlow = 0;
  
  window.removeEventListener('resize', resizeCanvas);
}

export function toggleHandTracking(onDistanceCallback, onRotationCallback, onFistCallback, onBrightnessCallback) {
  if (isHandTrackingActive) {
    stopHandTracking();
    return false;
  } else {
    initializeHandTracking(onDistanceCallback, onRotationCallback, onFistCallback, onBrightnessCallback);
    return true;
  }
}