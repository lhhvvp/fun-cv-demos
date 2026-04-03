import * as THREE from "three";
import { 
  SphereType, 
  sphereConfig, 
  sphereSpeedRange, 
  halfRoom,
  REFRACTION_THICKNESS_SCALE,
  baseSphereSize
} from "./config.js";
import { 
  glowRayGeometry, 
  createGlowRayMaterial, 
  createSphereMaterial, 
  disposeMaterial 
} from "./materials.js";

// Reusable vector for position generation
const candidatePosition = new THREE.Vector3();

export function getRandomPaletteIndex(palette, excludeIndex = null) {
  if (palette.length <= 1) {
    return 0;
  }

  let index = Math.floor(Math.random() * palette.length);
  if (excludeIndex === null) {
    return index;
  }

  while (index === excludeIndex) {
    index = Math.floor(Math.random() * palette.length);
  }

  return index;
}

export function setSphereLightColor(sphere, paletteIndex, palette) {
  if (!sphere || sphere.type !== SphereType.GLOW) {
    if (sphere) {
      sphere.colorIndex = null;
    }
    return;
  }

  const paletteLength = palette.length;
  const safeIndex = paletteLength > 0 ? THREE.MathUtils.euclideanModulo(paletteIndex, paletteLength) : 0;
  sphere.colorIndex = safeIndex;
  const colorHex = paletteLength > 0 ? palette[safeIndex] : "#ffffff";

  if (sphere.light) {
    sphere.light.color.set(colorHex);
  }

  if (sphere.mesh && sphere.mesh.material && sphere.mesh.material.emissive) {
    sphere.mesh.material.emissive.set(colorHex);
  }

  if (sphere.glowMaterial && sphere.glowMaterial.uniforms && sphere.glowMaterial.uniforms.uColor) {
    sphere.glowMaterial.uniforms.uColor.value.set(colorHex);
  }
}

export function cycleSphereLightColor(sphere, palette) {
  if (!sphere || sphere.type !== SphereType.GLOW) {
    return;
  }

  const currentIndex = typeof sphere.colorIndex === "number" ? sphere.colorIndex : null;
  const nextIndex = getRandomPaletteIndex(palette, currentIndex);
  setSphereLightColor(sphere, nextIndex, palette);
}

export function updateSphereLightIntensity(sphere, uiState) {
  if (!sphere || !sphere.mesh || !sphere.mesh.material) {
    return;
  }

  const baseEmissive = typeof sphere.baseEmissiveIntensity === "number" ? sphere.baseEmissiveIntensity : 0;
  const baseLight = typeof sphere.baseLightIntensity === "number" ? sphere.baseLightIntensity : 0;
  const baseGlow = typeof sphere.baseGlowIntensity === "number" ? sphere.baseGlowIntensity : 0;

  if (sphere.type === SphereType.GLOW) {
    const brightness = uiState.brightness;
    const glowStrength = uiState.glowStrength;

    if (sphere.light) {
      sphere.light.intensity = baseLight * brightness * glowStrength;
    }
    sphere.mesh.material.emissiveIntensity = baseEmissive * brightness * glowStrength;

    if (sphere.glowMaterial && sphere.glowMaterial.uniforms && sphere.glowMaterial.uniforms.uBaseIntensity) {
      sphere.glowMaterial.uniforms.uBaseIntensity.value = baseGlow * brightness * glowStrength;
    }
  } else {
    if (sphere.light) {
      sphere.light.intensity = 0;
    }
    sphere.mesh.material.emissiveIntensity = 0;
    if (sphere.mesh.material.emissive) {
      sphere.mesh.material.emissive.setRGB(0, 0, 0);
    }
  }
}

export function generateNonCollidingPosition(radius, existingSpheres) {
  const maxAttempts = 400;
  const limit = halfRoom - radius - 0.3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // Generate position within cube
    candidatePosition.set(
      THREE.MathUtils.randFloatSpread(limit * 2),
      THREE.MathUtils.randFloatSpread(limit * 2),
      THREE.MathUtils.randFloatSpread(limit * 2)
    );

    let intersects = false;
    for (let i = 0; i < existingSpheres.length; i += 1) {
      const other = existingSpheres[i];
      const minDistance = radius + other.radius + 0.25;
      if (candidatePosition.distanceTo(other.mesh.position) < minDistance) {
        intersects = true;
        break;
      }
    }

    if (!intersects) {
      return candidatePosition.clone();
    }
  }

  return new THREE.Vector3(0, 0, 0);
}

export function createSphere(sphereGroup, existingSpheres, palette, uiState) {
  const radius = THREE.MathUtils.lerp(sphereConfig.minRadius, sphereConfig.maxRadius, Math.random());
  const geometry = new THREE.SphereGeometry(radius, 48, 48);

  const type = existingSpheres.length % 2 === 0 ? SphereType.GLOW : SphereType.GLASS;
  const hue = Math.random();
  const glowSaturation = 0.45 + Math.random() * 0.25;
  const glowLightness = 0.45 + Math.random() * 0.25;
  const glassLightness = 0.56 + Math.random() * 0.08;

  const material = createSphereMaterial(
    type, 
    hue, 
    glowSaturation, 
    glowLightness, 
    glassLightness, 
    radius, 
    REFRACTION_THICKNESS_SCALE
  );

  const mesh = new THREE.Mesh(geometry, material);
  const position = generateNonCollidingPosition(radius, existingSpheres);
  mesh.position.copy(position);
  sphereGroup.add(mesh);

  const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5);
  if (direction.lengthSq() < 1e-6) {
    direction.set(1, 0, 0);
  }
  direction.normalize();
  const baseSpeed = THREE.MathUtils.randFloat(sphereSpeedRange.min, sphereSpeedRange.max);
  const velocity = direction.clone().multiplyScalar(baseSpeed);

  const colorIndex = type === SphereType.GLOW ? getRandomPaletteIndex(palette) : null;
  const baseLightIntensity =
    type === SphereType.GLOW
      ? THREE.MathUtils.mapLinear(radius, sphereConfig.minRadius, sphereConfig.maxRadius, 160, 320)
      : 0;
  const baseEmissiveIntensity =
    type === SphereType.GLOW
      ? THREE.MathUtils.mapLinear(radius, sphereConfig.minRadius, sphereConfig.maxRadius, 1.6, 2.6)
      : 0;
  const baseGlowIntensity =
    type === SphereType.GLOW
      ? THREE.MathUtils.mapLinear(radius, sphereConfig.minRadius, sphereConfig.maxRadius, 1.45, 2.25)
      : 0;

  let light = null;
  let glowMaterial = null;
  let glowMesh = null;
  let glowScale = radius;
  const baseThickness = radius * (1.8 + Math.random() * 0.6);

  if (type === SphereType.GLOW) {
    const paletteColor = palette[colorIndex ?? 0];
    const lightDistance = radius * 20;
    light = new THREE.PointLight(paletteColor, baseLightIntensity * uiState.brightness * uiState.glowStrength, lightDistance, 1.6);
    light.decay = 2.2;
    light.castShadow = false;
    mesh.add(light);
    material.emissiveIntensity = baseEmissiveIntensity * uiState.brightness * uiState.glowStrength;

    glowMaterial = createGlowRayMaterial(paletteColor);
    if (glowMaterial.uniforms.uBaseIntensity) {
      glowMaterial.uniforms.uBaseIntensity.value = baseGlowIntensity * uiState.brightness * uiState.glowStrength;
    }
    if (glowMaterial.uniforms.uPulse) {
      glowMaterial.uniforms.uPulse.value = 1;
    }

    glowMesh = new THREE.Mesh(glowRayGeometry, glowMaterial);
    glowScale = radius * THREE.MathUtils.randFloat(3.0, 4.0);
    const scaleFactor = 0.5 + (uiState.glowStrength * 0.5);
    glowMesh.scale.set(glowScale * scaleFactor, glowScale * scaleFactor, glowScale * scaleFactor);
    glowMesh.position.copy(mesh.position);
    glowMesh.renderOrder = 5;
    glowMesh.frustumCulled = false;
    sphereGroup.add(glowMesh);
  }

  const sphereData = {
    mesh,
    radius,
    baseRadius: radius,
    creationScale: uiState.sphereSizeScale,
    velocity,
    baseSpeed,
    hue,
    saturation: type === SphereType.GLOW ? glowSaturation : 0,
    lightness: type === SphereType.GLOW ? glowLightness : glassLightness,
    hueDrift: THREE.MathUtils.randFloat(0.2, 0.92),
    phase: Math.random() * Math.PI * 2,
    baseThickness,
    baseBaseThickness: baseThickness,
    light,
    baseLightIntensity,
    colorIndex,
    type,
    baseEmissiveIntensity,
    lastMovementDirection: direction.clone(),
    glowMaterial,
    glowMesh,
    baseGlowIntensity,
    glowScale,
    baseGlowScale: glowScale,
    glowPulseOffset: Math.random() * Math.PI * 2
  };

  if (type === SphereType.GLOW) {
    setSphereLightColor(sphereData, colorIndex, palette);
  }

  updateSphereLightIntensity(sphereData, uiState);

  return sphereData;
}

export function removeSphere(sphere, sphereGroup) {
  if (!sphere) {
    return;
  }

  if (sphere.light) {
    if (sphere.light.parent) {
      sphere.light.parent.remove(sphere.light);
    }
    if (typeof sphere.light.dispose === "function") {
      sphere.light.dispose();
    }
  }

  if (sphere.glowMesh) {
    sphereGroup.remove(sphere.glowMesh);
  }
  if (sphere.glowMaterial && typeof sphere.glowMaterial.dispose === "function") {
    sphere.glowMaterial.dispose();
  }

  sphereGroup.remove(sphere.mesh);
  sphere.mesh.geometry.dispose();
  disposeMaterial(sphere.mesh.material);
}

export function updateSphereSize(spheres, uiState, scale) {
  spheres.forEach((sphere) => {
    const scaleRatio = scale / sphere.creationScale;
    
    sphere.radius = sphere.baseRadius * scaleRatio;
    sphere.mesh.scale.set(scaleRatio, scaleRatio, scaleRatio);
    
    if (sphere.baseBaseThickness) {
      sphere.baseThickness = sphere.baseBaseThickness * scaleRatio;
      if (sphere.mesh.material) {
        sphere.mesh.material.thickness = sphere.baseThickness * REFRACTION_THICKNESS_SCALE;
      }
    }
    
    if (sphere.light) {
      sphere.light.distance = sphere.radius * 20;
    }
    
    if (sphere.glowMesh && sphere.baseGlowScale) {
      sphere.glowScale = sphere.baseGlowScale * scaleRatio;
    }
  });
}
