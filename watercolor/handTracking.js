// ===== HAND TRACKING FUNCTIONS =====

function smoothPosition(current, target, factor) {
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor
  };
}

function resizeHandCanvas() {
  const leftPanel = document.getElementById('leftPanel');
  if (canvasElement && leftPanel) {
    canvasElement.width = leftPanel.offsetWidth;
    canvasElement.height = leftPanel.offsetHeight;
  }
  if (webcamCanvas && leftPanel) {
    webcamCanvas.width = leftPanel.offsetWidth;
    webcamCanvas.height = leftPanel.offsetHeight;
  }
}

function drawWebcamFeed() {
  if (!webcamCanvas || !webcamCtx || !videoElement) return;

  webcamCtx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);
  webcamCtx.save();

  // Mirror the webcam feed horizontally
  webcamCtx.translate(webcamCanvas.width, 0);
  webcamCtx.scale(-1, 1);

  const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
  const canvasAspect = webcamCanvas.width / webcamCanvas.height;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (canvasAspect > videoAspect) {
    drawWidth = webcamCanvas.width;
    drawHeight = webcamCanvas.width / videoAspect;
    offsetX = 0;
    offsetY = (webcamCanvas.height - drawHeight) / 2;
  } else {
    drawWidth = webcamCanvas.height * videoAspect;
    drawHeight = webcamCanvas.height;
    offsetX = (webcamCanvas.width - drawWidth) / 2;
    offsetY = 0;
  }

  webcamCtx.drawImage(videoElement, offsetX, offsetY, drawWidth, drawHeight);
  webcamCtx.restore();
}

function onHandResults(results) {
  if (!canvasElement || !canvasCtx) return;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // Calculate video dimensions for coordinate mapping
    const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
    const canvasAspect = canvasElement.width / canvasElement.height;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (canvasAspect > videoAspect) {
      drawWidth = canvasElement.width;
      drawHeight = canvasElement.width / videoAspect;
      offsetX = 0;
      offsetY = (canvasElement.height - drawHeight) / 2;
    } else {
      drawWidth = canvasElement.height * videoAspect;
      drawHeight = canvasElement.height;
      offsetX = (canvasElement.width - drawWidth) / 2;
      offsetY = 0;
    }

    // Create array of detected hands with their positions
    const detectedHands = [];
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const wrist = landmarks[0];
      
      const wristX = (1 - wrist.x) * drawWidth + offsetX;
      const wristY = wrist.y * drawHeight + offsetY;
      
      detectedHands.push({
        index: i,
        landmarks: landmarks,
        wristX: wristX,
        wristY: wristY
      });
    }

    // Assign hands based on previous positions
    let assignedHand1 = null;
    let assignedHand2 = null;

    if (hand1Id !== null && lastHandPositions[hand1Id]) {
      let minDist = HAND_MATCH_THRESHOLD;
      for (const hand of detectedHands) {
        const dist = Math.sqrt(
          Math.pow(hand.wristX - lastHandPositions[hand1Id].x, 2) +
          Math.pow(hand.wristY - lastHandPositions[hand1Id].y, 2)
        );
        if (dist < minDist && !assignedHand2) {
          minDist = dist;
          assignedHand1 = hand;
        }
      }
    }

    if (hand2Id !== null && lastHandPositions[hand2Id]) {
      let minDist = HAND_MATCH_THRESHOLD;
      for (const hand of detectedHands) {
        if (hand === assignedHand1) continue;
        const dist = Math.sqrt(
          Math.pow(hand.wristX - lastHandPositions[hand2Id].x, 2) +
          Math.pow(hand.wristY - lastHandPositions[hand2Id].y, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          assignedHand2 = hand;
        }
      }
    }

    if (!assignedHand1 && detectedHands.length > 0) {
      assignedHand1 = detectedHands.reduce((leftmost, hand) => 
        hand.wristX < leftmost.wristX ? hand : leftmost
      );
      hand1Id = 'hand1';
    }

    if (!assignedHand2 && detectedHands.length > 1) {
      assignedHand2 = detectedHands.find(h => h !== assignedHand1);
      hand2Id = 'hand2';
    }

    // Store hand data for cross-hand drawing
    let hand1Data = null;
    let hand2Data = null;

    // Process hand 1 (turbulence and swirl scale control)
    if (assignedHand1) {
      const landmarks1 = assignedHand1.landmarks;
      const thumbTip1 = landmarks1[THUMB_TIP];
      const indexTip1 = landmarks1[INDEX_TIP];

      lastHandPositions[hand1Id] = { x: assignedHand1.wristX, y: assignedHand1.wristY };

      const rawThumbX1 = (1 - thumbTip1.x) * drawWidth + offsetX;
      const rawThumbY1 = thumbTip1.y * drawHeight + offsetY;
      const rawIndexX1 = (1 - indexTip1.x) * drawWidth + offsetX;
      const rawIndexY1 = indexTip1.y * drawHeight + offsetY;

      const targetThumb1 = { x: rawThumbX1, y: rawThumbY1 };
      const targetIndex1 = { x: rawIndexX1, y: rawIndexY1 };
      
      smoothedThumb = smoothPosition(smoothedThumb, targetThumb1, HAND_SMOOTHING_FACTOR);
      smoothedIndex = smoothPosition(smoothedIndex, targetIndex1, HAND_SMOOTHING_FACTOR);

      // Calculate pinch distance (for turbulence control)
      const distance1 = Math.sqrt(
        Math.pow(smoothedIndex.x - smoothedThumb.x, 2) + 
        Math.pow(smoothedIndex.y - smoothedThumb.y, 2)
      );

      // Map distance to turbulence (20px = 0.0, 250px = 5.0)
      const minDistance = 20;
      const maxDistance = 250;
      const normalizedDistance1 = Math.max(0, Math.min(1, (distance1 - minDistance) / (maxDistance - minDistance)));
      
      // Updated turbulence max to 5.0
      turbulence = normalizedDistance1 * 5.0;
      turbulence = Math.max(0.0, Math.min(5.0, turbulence));

      // Update turbulence UI
      document.getElementById("turbulence").value = turbulence;
      document.getElementById("turbulenceValue").textContent = turbulence.toFixed(2);

      // Use index finger Y position for swirl scale (0.1 to 10.0)
      const normalizedY = 1 - indexTip1.y; // Invert so up = higher value
      swirlScale = 0.1 + normalizedY * 9.9;
      swirlScale = Math.max(0.1, Math.min(10.0, swirlScale));

      // Update swirl scale UI
      document.getElementById("swirlScale").value = swirlScale;
      document.getElementById("swirlScaleValue").textContent = swirlScale.toFixed(2);

      hand1Data = {
        thumbX: smoothedThumb.x,
        thumbY: smoothedThumb.y,
        indexX: smoothedIndex.x,
        indexY: smoothedIndex.y,
        distance: distance1,
        value1: turbulence,
        value2: swirlScale
      };

      drawHandTracking(
        smoothedThumb.x, 
        smoothedThumb.y, 
        smoothedIndex.x, 
        smoothedIndex.y, 
        distance1,
        turbulence,
        swirlScale,
        1
      );
    } else {
      hand1Id = null;
    }

    // Process hand 2 (hue shift and saturation control)
    if (assignedHand2) {
      const landmarks2 = assignedHand2.landmarks;
      const thumbTip2 = landmarks2[THUMB_TIP];
      const indexTip2 = landmarks2[INDEX_TIP];

      lastHandPositions[hand2Id] = { x: assignedHand2.wristX, y: assignedHand2.wristY };

      const rawThumbX2 = (1 - thumbTip2.x) * drawWidth + offsetX;
      const rawThumbY2 = thumbTip2.y * drawHeight + offsetY;
      const rawIndexX2 = (1 - indexTip2.x) * drawWidth + offsetX;
      const rawIndexY2 = indexTip2.y * drawHeight + offsetY;

      const targetThumb2 = { x: rawThumbX2, y: rawThumbY2 };
      const targetIndex2 = { x: rawIndexX2, y: rawIndexY2 };
      
      smoothedThumb2 = smoothPosition(smoothedThumb2, targetThumb2, HAND_SMOOTHING_FACTOR);
      smoothedIndex2 = smoothPosition(smoothedIndex2, targetIndex2, HAND_SMOOTHING_FACTOR);

      // Calculate pinch distance (for saturation control)
      const distance2 = Math.sqrt(
        Math.pow(smoothedIndex2.x - smoothedThumb2.x, 2) + 
        Math.pow(smoothedIndex2.y - smoothedThumb2.y, 2)
      );

      // Map distance to saturation (20px = 0.0, 300px = 2.0)
      const minDistance = 20;
      const maxDistance = 300;
      const normalizedDistance2 = Math.max(0, Math.min(1, (distance2 - minDistance) / (maxDistance - minDistance)));
      saturation = normalizedDistance2 * 2.0;
      saturation = Math.max(0.0, Math.min(2.0, saturation));

      // Update saturation UI
      document.getElementById("saturation").value = saturation;
      document.getElementById("saturationValue").textContent = saturation.toFixed(2);

      // Use index finger Y position for hue shift (0 to 6.28)
      const normalizedY2 = 1 - indexTip2.y; // Invert so up = higher value
      hueShift = normalizedY2 * 6.28;
      hueShift = Math.max(0.0, Math.min(6.28, hueShift));

      // Update hue shift UI
      document.getElementById("hueShift").value = hueShift;
      document.getElementById("hueShiftValue").textContent = hueShift.toFixed(2);

      hand2Data = {
        thumbX: smoothedThumb2.x,
        thumbY: smoothedThumb2.y,
        indexX: smoothedIndex2.x,
        indexY: smoothedIndex2.y,
        distance: distance2,
        value1: saturation,
        value2: hueShift
      };

      drawHandTracking(
        smoothedThumb2.x, 
        smoothedThumb2.y, 
        smoothedIndex2.x, 
        smoothedIndex2.y, 
        distance2,
        saturation,
        hueShift,
        2
      );
    } else {
      hand2Id = null;
    }

    // Draw cross-hand connections and calculate flow speed when both hands are detected
    if (hand1Data && hand2Data) {
      drawCrossHandConnections(hand1Data, hand2Data);
    }

    if (detectedHands.length === 0) {
      lastHandPositions = {};
      hand1Id = null;
      hand2Id = null;
    }
  } else {
    lastHandPositions = {};
    hand1Id = null;
    hand2Id = null;
  }
}

function drawHandTracking(thumbX, thumbY, indexX, indexY, distance, value1, value2, handNumber) {
  if (!canvasCtx) return;

  // Draw line connecting thumb and index finger (yellow dotted, same as cross-hand lines)
  canvasCtx.strokeStyle = 'rgba(255, 220, 80, 0.8)';
  canvasCtx.lineWidth = 3;
  canvasCtx.shadowBlur = 10;
  canvasCtx.shadowColor = 'rgba(255, 220, 80, 0.5)';
  canvasCtx.setLineDash([8, 4]);
  canvasCtx.beginPath();
  canvasCtx.moveTo(thumbX, thumbY);
  canvasCtx.lineTo(indexX, indexY);
  canvasCtx.stroke();

  canvasCtx.setLineDash([]);
  canvasCtx.shadowBlur = 0;

  // Draw circles on fingertips
  canvasCtx.fillStyle = 'rgba(0, 0, 255, 0.9)';
  canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  canvasCtx.lineWidth = 2;

  // Thumb tip
  canvasCtx.beginPath();
  canvasCtx.arc(thumbX, thumbY, 10, 0, 2 * Math.PI);
  canvasCtx.fill();
  canvasCtx.stroke();

  // Index finger tip
  canvasCtx.beginPath();
  canvasCtx.arc(indexX, indexY, 10, 0, 2 * Math.PI);
  canvasCtx.fill();
  canvasCtx.stroke();

  // Draw text info
  canvasCtx.font = 'bold 14px monospace';
  canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  canvasCtx.lineWidth = 3;

  const textX = thumbX;
  const textY = thumbY + 35;

  if (handNumber === 1) {
    // Hand 1: turbulence (pinch) + swirl scale (Y position)
    const turbText = `TURB ${value1.toFixed(2)}`;
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    canvasCtx.strokeText(turbText, textX, textY);
    canvasCtx.fillText(turbText, textX, textY);
    
    const swirlText = `SWIRL ${value2.toFixed(2)}`;
    canvasCtx.strokeText(swirlText, textX, textY + 18);
    canvasCtx.fillText(swirlText, textX, textY + 18);
  } else {
    // Hand 2: saturation (pinch) + hue shift (Y position)
    const satText = `SAT ${value1.toFixed(2)}`;
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    canvasCtx.strokeText(satText, textX, textY);
    canvasCtx.fillText(satText, textX, textY);
    
    const hueText = `HUE ${value2.toFixed(2)}`;
    canvasCtx.strokeText(hueText, textX, textY + 18);
    canvasCtx.fillText(hueText, textX, textY + 18);
  }
}

/* --- handTracking.js (Modified Section) --- */

function drawCrossHandConnections(hand1Data, hand2Data) {
  if (!canvasCtx) return;

  // Calculate distances between corresponding fingers
  const indexDistance = Math.sqrt(
    Math.pow(hand2Data.indexX - hand1Data.indexX, 2) +
    Math.pow(hand2Data.indexY - hand1Data.indexY, 2)
  );

  const thumbDistance = Math.sqrt(
    Math.pow(hand2Data.thumbX - hand1Data.thumbX, 2) +
    Math.pow(hand2Data.thumbY - hand1Data.thumbY, 2)
  );

  // Calculate average distance for field scale
  const avgDistance = (indexDistance + thumbDistance) / 2;

  // Map average distance to field scale (50px = 0.2, 600px = 4.0)
  // Based on the slider range in index.html (0.2 to 4.0)
  const minDist = 50;
  const maxDist = 600;
  const normalizedDist = Math.max(0, Math.min(1, (avgDistance - minDist) / (maxDist - minDist)));
  
  // Field scale mapping logic
  fieldScale = 0.2 + normalizedDist * 3.8; 
  fieldScale = Math.max(0.2, Math.min(4.0, fieldScale));

  // Update field scale UI
  const fieldScaleSlider = document.getElementById("fieldScale");
  const fieldScaleVal = document.getElementById("fieldScaleValue");
  if (fieldScaleSlider) fieldScaleSlider.value = fieldScale;
  if (fieldScaleVal) fieldScaleVal.textContent = fieldScale.toFixed(2);

  // Draw line connecting index fingers (yellow dotted)
  canvasCtx.strokeStyle = 'rgba(255, 220, 80, 0.8)';
  canvasCtx.lineWidth = 3;
  canvasCtx.shadowBlur = 10;
  canvasCtx.shadowColor = 'rgba(255, 220, 80, 0.5)';
  canvasCtx.setLineDash([8, 4]);
  canvasCtx.beginPath();
  canvasCtx.moveTo(hand1Data.indexX, hand1Data.indexY);
  canvasCtx.lineTo(hand2Data.indexX, hand2Data.indexY);
  canvasCtx.stroke();

  // Draw line connecting thumbs (yellow dotted)
  canvasCtx.beginPath();
  canvasCtx.moveTo(hand1Data.thumbX, hand1Data.thumbY);
  canvasCtx.lineTo(hand2Data.thumbX, hand2Data.thumbY);
  canvasCtx.stroke();

  canvasCtx.setLineDash([]);
  canvasCtx.shadowBlur = 0;

  // Draw Field Scale label at midpoint between hands
  const midX = (hand1Data.indexX + hand2Data.indexX) / 2;
  const midY = (hand1Data.indexY + hand2Data.indexY) / 2 - 20;

  canvasCtx.font = 'bold 16px monospace';
  canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  canvasCtx.lineWidth = 3;
  canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';

  // Updated Label from FLOW to SCALE
  const scaleText = `SCALE ${fieldScale.toFixed(2)}`;
  canvasCtx.strokeText(scaleText, midX - 40, midY);
  canvasCtx.fillText(scaleText, midX - 40, midY);
}

async function initializeHandTracking() {
  if (typeof window.Hands === 'undefined') {
    alert('MediaPipe Hands library not loaded. Please check your internet connection.');
    return false;
  }

  const leftPanel = document.getElementById('leftPanel');
  const rightPanel = document.getElementById('rightPanel');
  leftPanel.classList.add('active');
  rightPanel.classList.add('split');

  setTimeout(() => {
    resizeCanvas();
  }, 350);

  videoElement = document.createElement('video');
  videoElement.id = 'webcam-video';
  videoElement.style.display = 'none';
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  document.body.appendChild(videoElement);

  webcamCanvas = document.createElement('canvas');
  webcamCanvas.id = 'webcam-canvas';
  webcamCanvas.style.position = 'absolute';
  webcamCanvas.style.top = '0';
  webcamCanvas.style.left = '0';
  webcamCanvas.style.width = '100%';
  webcamCanvas.style.height = '100%';
  webcamCanvas.style.objectFit = 'cover';
  webcamCanvas.style.pointerEvents = 'none';
  webcamCanvas.style.zIndex = '1';
  document.getElementById('leftPanel').appendChild(webcamCanvas);

  webcamCtx = webcamCanvas.getContext('2d');

  canvasElement = document.createElement('canvas');
  canvasElement.id = 'hand-tracking-canvas';
  canvasElement.style.position = 'absolute';
  canvasElement.style.top = '0';
  canvasElement.style.left = '0';
  canvasElement.style.width = '100%';
  canvasElement.style.height = '100%';
  canvasElement.style.pointerEvents = 'none';
  canvasElement.style.zIndex = '2';
  document.getElementById('leftPanel').appendChild(canvasElement);

  canvasCtx = canvasElement.getContext('2d');

  hands = new window.Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults(onHandResults);

  try {
    camera = new window.Camera(videoElement, {
      onFrame: async () => {
        if (isHandTrackingActive && hands) {
          drawWebcamFeed();
          await hands.send({ image: videoElement });
        }
      },
      width: 1500,
      height: 1500
    });

    await camera.start();
    isHandTrackingActive = true;
    
    resizeHandCanvas();
    window.addEventListener('resize', resizeHandCanvas);

    return true;
  } catch (error) {
    console.error('Error starting camera:', error);
    alert('Failed to start camera. Please ensure you have granted camera permissions.');
    return false;
  }
}

function stopHandTracking() {
  isHandTrackingActive = false;

  const leftPanel = document.getElementById('leftPanel');
  const rightPanel = document.getElementById('rightPanel');
  leftPanel.classList.remove('active');
  rightPanel.classList.remove('split');

  setTimeout(() => {
    resizeCanvas();
  }, 350);

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

  smoothedThumb = { x: 0, y: 0 };
  smoothedIndex = { x: 0, y: 0 };
  smoothedThumb2 = { x: 0, y: 0 };
  smoothedIndex2 = { x: 0, y: 0 };

  hand1Id = null;
  hand2Id = null;
  lastHandPositions = {};

  window.removeEventListener('resize', resizeHandCanvas);
}

// ===== END HAND TRACKING FUNCTIONS =====