import * as THREE from "three";
import { 
  sphereCountRange, 
  brightnessRange, 
  glowStrengthRange, 
  speedRange,
  sphereSizeScaleRange,
  SphereType,
  REFRACTION_THICKNESS_SCALE
} from "./config.js";
import { 
  createSphere, 
  removeSphere, 
  updateSphereLightIntensity,
  setSphereLightColor,
  updateSphereSize
} from "./spheres.js";

export function getUiElements() {
  return {
    paletteSelect: document.getElementById("color-palette"),
    paletteValue: document.querySelector('[data-value-for="color-palette"]'),
    sphereCountInput: document.getElementById("sphere-count"),
    sphereCountValue: document.querySelector('[data-value-for="sphere-count"]'),
    sphereSizeInput: document.getElementById("sphere-size"),
    sphereSizeValue: document.querySelector('[data-value-for="sphere-size"]'),
    brightnessInput: document.getElementById("scene-brightness"),
    brightnessValue: document.querySelector('[data-value-for="scene-brightness"]'),
    glowStrengthInput: document.getElementById("glow-strength"),
    glowStrengthValue: document.querySelector('[data-value-for="glow-strength"]'),
    speedInput: document.getElementById("movement-speed"),
    speedValue: document.querySelector('[data-value-for="movement-speed"]'),
    fpsCounter: document.getElementById("fps-counter"),
    pauseButton: document.getElementById("pause-button"),
    cameraButton: document.getElementById("camera-button"),
    panelToggle: document.getElementById("panel-toggle"),
    controlPanel: document.querySelector(".control-panel")
  };
}

function setControlValue(element, value, { decimals = 2, suffix = "" } = {}) {
  if (!element) {
    return;
  }

  let textValue;
  if (typeof decimals === "number") {
    textValue = decimals === 0 ? Math.round(value).toString() : Number(value).toFixed(decimals);
  } else {
    textValue = String(value);
  }

  element.textContent = `${textValue}${suffix}`;
}

export function updateSphereCount(spheres, sphereGroup, palette, uiState, uiElements, count) {
  const clamped = THREE.MathUtils.clamp(count, sphereCountRange.min, sphereCountRange.max);
  const target = Math.round(clamped);
  uiState.sphereCount = target;

  if (uiElements.sphereCountInput && uiElements.sphereCountInput.value !== String(target)) {
    uiElements.sphereCountInput.value = String(target);
  }
  setControlValue(uiElements.sphereCountValue, target, { decimals: 0 });

  if (target > spheres.length) {
    for (let i = spheres.length; i < target; i += 1) {
      const newSphere = createSphere(sphereGroup, spheres, palette, uiState);
      spheres.push(newSphere);
    }
  } else if (target < spheres.length) {
    for (let i = spheres.length; i > target; i -= 1) {
      const sphere = spheres.pop();
      removeSphere(sphere, sphereGroup);
    }
  }
}

export function updateBrightness(spheres, renderer, uiState, uiElements, level) {
  const value = THREE.MathUtils.clamp(level, brightnessRange.min, brightnessRange.max);
  uiState.brightness = value;

  if (uiElements.brightnessInput) {
    uiElements.brightnessInput.value = value.toFixed(2);
  }
  setControlValue(uiElements.brightnessValue, value, { decimals: 2 });

  spheres.forEach((sphere) => {
    updateSphereLightIntensity(sphere, uiState);
  });
  renderer.toneMappingExposure = 1.25 * value;
}

export function updateGlowStrength(spheres, uiState, uiElements, level) {
  const value = THREE.MathUtils.clamp(level, glowStrengthRange.min, glowStrengthRange.max);
  uiState.glowStrength = value;

  if (uiElements.glowStrengthInput) {
    uiElements.glowStrengthInput.value = value.toFixed(2);
  }
  setControlValue(uiElements.glowStrengthValue, value, { decimals: 2, suffix: "×" });

  spheres.forEach((sphere) => {
    if (sphere.type === SphereType.GLOW) {
      if (sphere.light && typeof sphere.baseLightIntensity === "number") {
        sphere.light.intensity = sphere.baseLightIntensity * uiState.brightness * value;
      }
      
      if (sphere.mesh && sphere.mesh.material && typeof sphere.baseEmissiveIntensity === "number") {
        sphere.mesh.material.emissiveIntensity = sphere.baseEmissiveIntensity * uiState.brightness * value;
      }
      
      if (sphere.glowMaterial && sphere.glowMaterial.uniforms && sphere.glowMaterial.uniforms.uBaseIntensity) {
        sphere.glowMaterial.uniforms.uBaseIntensity.value = sphere.baseGlowIntensity * uiState.brightness * value;
      }
      
      if (sphere.glowMesh && typeof sphere.glowScale === "number") {
        const scaleFactor = 0.5 + (value * 0.5);
        sphere.glowMesh.scale.set(
          sphere.glowScale * scaleFactor,
          sphere.glowScale * scaleFactor,
          sphere.glowScale * scaleFactor
        );
      }
    }
  });
}

export function updateSpeed(motionState, uiState, uiElements, level) {
  const value = THREE.MathUtils.clamp(level, speedRange.min, speedRange.max);
  uiState.speed = value;
  motionState.speedMultiplier = value;

  if (uiElements.speedInput) {
    uiElements.speedInput.value = value.toFixed(2);
  }
  setControlValue(uiElements.speedValue, value, { decimals: 2, suffix: "×" });
}

export function updateSphereSizeUI(spheres, uiState, uiElements, scale) {
  const clamped = THREE.MathUtils.clamp(scale, sphereSizeScaleRange.min, sphereSizeScaleRange.max);
  
  uiState.sphereSizeScale = clamped;

  if (uiElements.sphereSizeInput) {
    uiElements.sphereSizeInput.value = clamped.toFixed(2);
  }
  setControlValue(uiElements.sphereSizeValue, clamped, { decimals: 2, suffix: "×" });

  updateSphereSize(spheres, uiState, clamped);
}

export function updatePalette(spheres, palette, uiElements, paletteName) {
  if (uiElements.paletteValue) {
    const displayName = paletteName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    uiElements.paletteValue.textContent = displayName;
  }
  
  spheres.forEach((sphere, index) => {
    if (sphere.type === SphereType.GLOW) {
      const newColorIndex = index % palette.length;
      setSphereLightColor(sphere, newColorIndex, palette);
    }
  });
}

export function rebuildAllSpheres(spheres, sphereGroup, palette, uiState) {
  const targetCount = uiState.sphereCount;

  while (spheres.length > 0) {
    const sphere = spheres.pop();
    removeSphere(sphere, sphereGroup);
  }

  for (let i = 0; i < targetCount; i += 1) {
    const newSphere = createSphere(sphereGroup, spheres, palette, uiState);
    spheres.push(newSphere);
  }
}

export function initializeUiControls(
  spheres, 
  sphereGroup, 
  palette, 
  palettes,
  uiState, 
  motionState,
  uiElements,
  renderer,
  isPausedState,
  onPaletteChange,
  onCameraToggle
) {
  if (uiElements.paletteSelect) {
    uiElements.paletteSelect.addEventListener("change", (event) => {
      const newPalette = palettes[event.target.value];
      if (newPalette) {
        onPaletteChange(event.target.value);
        updatePalette(spheres, newPalette, uiElements, event.target.value);
      }
    });
  }

  if (uiElements.sphereSizeInput) {
    uiElements.sphereSizeInput.addEventListener("input", (event) => {
      updateSphereSizeUI(spheres, uiState, uiElements, Number(event.target.value));
    });
  }

  if (uiElements.sphereCountInput) {
    uiElements.sphereCountInput.addEventListener("input", (event) => {
      updateSphereCount(spheres, sphereGroup, palette, uiState, uiElements, Number(event.target.value));
    });
  }

  if (uiElements.brightnessInput) {
    uiElements.brightnessInput.addEventListener("input", (event) => {
      updateBrightness(spheres, renderer, uiState, uiElements, Number(event.target.value));
    });
  }

  if (uiElements.glowStrengthInput) {
    uiElements.glowStrengthInput.addEventListener("input", (event) => {
      updateGlowStrength(spheres, uiState, uiElements, Number(event.target.value));
    });
  }

  if (uiElements.speedInput) {
    uiElements.speedInput.addEventListener("input", (event) => {
      updateSpeed(motionState, uiState, uiElements, Number(event.target.value));
    });
  }

  if (uiElements.pauseButton) {
    uiElements.pauseButton.addEventListener("click", () => {
      isPausedState.value = !isPausedState.value;
      
      if (isPausedState.value) {
        uiElements.pauseButton.classList.add("paused");
        uiElements.pauseButton.setAttribute("aria-label", "Play animation");
      } else {
        uiElements.pauseButton.classList.remove("paused");
        uiElements.pauseButton.setAttribute("aria-label", "Pause animation");
      }
    });
  }

  if (uiElements.cameraButton && onCameraToggle) {
    uiElements.cameraButton.addEventListener("click", () => {
      const isActive = onCameraToggle();
      
      if (isActive) {
        uiElements.cameraButton.classList.add("active");
        uiElements.cameraButton.setAttribute("aria-label", "Stop camera tracking");
      } else {
        uiElements.cameraButton.classList.remove("active");
        uiElements.cameraButton.setAttribute("aria-label", "Start camera tracking");
      }
    });
  }

  if (uiElements.panelToggle && uiElements.controlPanel) {
    uiElements.panelToggle.addEventListener("click", () => {
      uiElements.controlPanel.classList.toggle("collapsed");
      
      if (uiElements.controlPanel.classList.contains("collapsed")) {
        uiElements.panelToggle.setAttribute("aria-label", "Show control panel");
      } else {
        uiElements.panelToggle.setAttribute("aria-label", "Hide control panel");
      }
    });
  }
}
