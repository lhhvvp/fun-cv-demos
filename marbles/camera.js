import * as THREE from "three";

// Reusable vectors and spherical for camera calculations
const cameraOrbitOffset = new THREE.Vector3();
const cameraOrbitSpherical = new THREE.Spherical();
const cameraOrbitEpsilon = 1e-7;

export function createCameraInertiaState(controls) {
  return {
    isDragging: false,
    lastAzimuthalAngle: controls.getAzimuthalAngle(),
    lastPolarAngle: controls.getPolarAngle(),
    azimuthalVelocity: 0,
    polarVelocity: 0,
    maxVelocity: 15,
    minVelocity: 0.00002,
    decayStrength: 4.0,
    delta: { theta: 0, phi: 0 }
  };
}

export function createZoomState(camera, controls) {
  const currentDistance = camera.position.distanceTo(controls.target);
  return {
    currentDistance,
    targetDistance: currentDistance,
    isZooming: false,
    zoomSpeed: 8.0,
    zoomThreshold: 0.001
  };
}

export function setupCameraControls(controls, inertiaState) {
  controls.addEventListener("start", () => {
    inertiaState.isDragging = true;
    inertiaState.azimuthalVelocity = 0;
    inertiaState.polarVelocity = 0;
    inertiaState.lastAzimuthalAngle = controls.getAzimuthalAngle();
    inertiaState.lastPolarAngle = controls.getPolarAngle();
    inertiaState.delta.theta = 0;
    inertiaState.delta.phi = 0;
  });

  controls.addEventListener("end", () => {
    inertiaState.isDragging = false;
  });
}

export function setupZoomListener(renderer, zoomState, controls) {
  renderer.domElement.addEventListener("wheel", (event) => {
    const zoomDelta = event.deltaY * 0.01;
    const desiredDistance = zoomState.targetDistance * (1 + zoomDelta * controls.zoomSpeed * 0.01);
    
    zoomState.targetDistance = THREE.MathUtils.clamp(
      desiredDistance,
      controls.minDistance,
      controls.maxDistance
    );
    
    zoomState.isZooming = true;
  }, { passive: true });
}

function rotateCameraBy(camera, controls, azimuthDelta, polarDelta) {
  if (azimuthDelta === 0 && polarDelta === 0) {
    return;
  }

  cameraOrbitOffset.copy(camera.position).sub(controls.target);
  cameraOrbitSpherical.setFromVector3(cameraOrbitOffset);

  cameraOrbitSpherical.theta += azimuthDelta;
  cameraOrbitSpherical.phi = THREE.MathUtils.clamp(
    cameraOrbitSpherical.phi + polarDelta,
    controls.minPolarAngle,
    controls.maxPolarAngle
  );
  cameraOrbitSpherical.makeSafe();

  cameraOrbitSpherical.radius = THREE.MathUtils.clamp(
    cameraOrbitSpherical.radius,
    controls.minDistance,
    controls.maxDistance
  );

  cameraOrbitOffset.setFromSpherical(cameraOrbitSpherical);
  camera.position.copy(controls.target).add(cameraOrbitOffset);
  camera.lookAt(controls.target);
}

export function applySmoothZoom(camera, controls, zoomState, delta) {
  if (!zoomState.isZooming) {
    return;
  }

  const t = 1 - Math.exp(-zoomState.zoomSpeed * delta);
  zoomState.currentDistance = THREE.MathUtils.lerp(
    zoomState.currentDistance,
    zoomState.targetDistance,
    t
  );

  const distanceDiff = Math.abs(zoomState.currentDistance - zoomState.targetDistance);
  if (distanceDiff < zoomState.zoomThreshold) {
    zoomState.currentDistance = zoomState.targetDistance;
    zoomState.isZooming = false;
  }

  cameraOrbitOffset.copy(camera.position).sub(controls.target);
  cameraOrbitSpherical.setFromVector3(cameraOrbitOffset);
  cameraOrbitSpherical.radius = zoomState.currentDistance;
  cameraOrbitOffset.setFromSpherical(cameraOrbitSpherical);
  camera.position.copy(controls.target).add(cameraOrbitOffset);
}

export function applyCameraInertia(camera, controls, inertiaState, delta) {
  if (!inertiaState || inertiaState.isDragging) {
    return;
  }

  const azimuthalVelocity = inertiaState.azimuthalVelocity;
  const polarVelocity = inertiaState.polarVelocity;
  const minVelocity = inertiaState.minVelocity;

  if (Math.abs(azimuthalVelocity) > minVelocity) {
    inertiaState.delta.theta += azimuthalVelocity * delta;
  }

  if (Math.abs(polarVelocity) > minVelocity) {
    inertiaState.delta.phi += polarVelocity * delta;
  }

  if (Math.abs(inertiaState.delta.theta) > cameraOrbitEpsilon || Math.abs(inertiaState.delta.phi) > cameraOrbitEpsilon) {
    const useDamping = controls.enableDamping && controls.dampingFactor > 0;
    const dampingValue = useDamping ? THREE.MathUtils.clamp(controls.dampingFactor, 0, 1) : 1;
    const thetaStep = useDamping ? inertiaState.delta.theta * dampingValue : inertiaState.delta.theta;
    const phiStep = useDamping ? inertiaState.delta.phi * dampingValue : inertiaState.delta.phi;

    if (Math.abs(thetaStep) > cameraOrbitEpsilon || Math.abs(phiStep) > cameraOrbitEpsilon) {
      rotateCameraBy(camera, controls, thetaStep, phiStep);
    }

    if (useDamping) {
      const retainFactor = 1 - dampingValue;
      inertiaState.delta.theta *= retainFactor;
      inertiaState.delta.phi *= retainFactor;
    } else {
      inertiaState.delta.theta = 0;
      inertiaState.delta.phi = 0;
    }

    if (Math.abs(inertiaState.delta.theta) <= cameraOrbitEpsilon) {
      inertiaState.delta.theta = 0;
    }
    if (Math.abs(inertiaState.delta.phi) <= cameraOrbitEpsilon) {
      inertiaState.delta.phi = 0;
    }
  }

  const decay = Math.exp(-inertiaState.decayStrength * delta);
  inertiaState.azimuthalVelocity *= decay;
  inertiaState.polarVelocity *= decay;

  if (Math.abs(inertiaState.azimuthalVelocity) < minVelocity) {
    inertiaState.azimuthalVelocity = 0;
  }
  if (Math.abs(inertiaState.polarVelocity) < minVelocity) {
    inertiaState.polarVelocity = 0;
  }
}

function shortestAngleDifference(current, previous) {
  const difference = current - previous;
  return Math.atan2(Math.sin(difference), Math.cos(difference));
}

export function updateCameraInertiaTracking(controls, inertiaState, delta) {
  if (!inertiaState) {
    return;
  }

  const currentAzimuth = controls.getAzimuthalAngle();
  const currentPolar = controls.getPolarAngle();

  if (inertiaState.isDragging && delta > 1e-6) {
    const azimuthDelta = shortestAngleDifference(currentAzimuth, inertiaState.lastAzimuthalAngle);
    const polarDelta = currentPolar - inertiaState.lastPolarAngle;

    const azimuthVelocity = azimuthDelta / delta;
    const polarVelocity = polarDelta / delta;

    inertiaState.azimuthalVelocity = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(inertiaState.azimuthalVelocity, azimuthVelocity, 0.45),
      -inertiaState.maxVelocity,
      inertiaState.maxVelocity
    );

    inertiaState.polarVelocity = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(inertiaState.polarVelocity, polarVelocity, 0.45),
      -inertiaState.maxVelocity,
      inertiaState.maxVelocity
    );
  }

  inertiaState.lastAzimuthalAngle = currentAzimuth;
  inertiaState.lastPolarAngle = currentPolar;
}
