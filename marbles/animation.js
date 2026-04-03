import { SphereType } from "./config.js";
import { enforceCubeBounds, resolveSphereCollision, maintainSphereSpeed } from "./physics.js";
import { cycleSphereLightColor } from "./spheres.js";
import { playCollisionSound } from "./sound-effects.js";

export function onSphereCollision(sphere, impactStrength, palette, otherSphere = null) {
  if (!sphere) {
    return;
  }

  cycleSphereLightColor(sphere, palette);
  
  // Only play sound if a glow sphere is involved
  const isGlowInvolved = sphere.type === SphereType.GLOW || (otherSphere && otherSphere.type === SphereType.GLOW);
  
  if (isGlowInvolved) {
    playCollisionSound({
      impactStrength,
      baseSpeed: typeof sphere.baseSpeed === "number" ? sphere.baseSpeed : 0,
      radius: typeof sphere.radius === "number" ? sphere.radius : 1,
      sphereType: typeof sphere.type === "string" ? sphere.type : "generic",
      hue: typeof sphere.hue === "number" ? sphere.hue : null
    });
  }
}

export function updateGlowBillboards(spheres, camera) {
  for (let i = 0; i < spheres.length; i += 1) {
    const sphere = spheres[i];
    if (sphere.type !== SphereType.GLOW || !sphere.glowMesh) {
      continue;
    }

    sphere.glowMesh.position.copy(sphere.mesh.position);
    sphere.glowMesh.lookAt(camera.position);
  }
}

export function updateSpheres(spheres, palette, uiState, delta, time) {
  const effectiveDelta = delta * uiState.speed;
  const count = spheres.length;

  // Update positions and handle collisions with bounds
  for (let i = 0; i < count; i += 1) {
    const sphere = spheres[i];
    const { mesh, velocity, hueDrift } = sphere;

    mesh.position.addScaledVector(velocity, effectiveDelta);

    const boundsCollision = enforceCubeBounds(sphere);

    const hue = (sphere.hue + time * hueDrift) % 1;
    const material = mesh.material;

    if (sphere.type === SphereType.GLOW) {
      material.attenuationColor.setHSL(hue, sphere.saturation, sphere.lightness + 0.1);
      if (material.sheenColor) {
        material.sheenColor.setHSL((hue + 0.05) % 1, sphere.saturation * 0.6, 0.6);
      }
      material.envMapIntensity = 1.35 + Math.sin(time * 0.4 + sphere.phase) * 0.28;

      const pulseOffset = typeof sphere.glowPulseOffset === "number" ? sphere.glowPulseOffset : sphere.phase;
      if (sphere.light) {
        const flicker = 0.92 + Math.sin(time * 1.3 + pulseOffset * 1.2) * 0.08;
        sphere.light.intensity = sphere.baseLightIntensity * uiState.brightness * uiState.glowStrength * flicker;
      }

      const emissivePulse = 0.85 + Math.sin(time * 1.1 + pulseOffset * 0.8) * 0.15;
      material.emissiveIntensity = sphere.baseEmissiveIntensity * uiState.brightness * uiState.glowStrength * emissivePulse;

      if (sphere.glowMaterial && sphere.glowMaterial.uniforms) {
        const uniforms = sphere.glowMaterial.uniforms;
        uniforms.uTime.value = time;
        if (uniforms.uPulse) {
          const pulse = 0.82 + Math.sin(time * 1.4 + pulseOffset) * 0.18;
          uniforms.uPulse.value = pulse;
        }
      }

      if (sphere.glowMesh) {
        const scalePulse = 0.94 + Math.sin(time * 0.8 + pulseOffset * 0.7) * 0.08;
        const scaleFactor = 0.5 + (uiState.glowStrength * 0.5);
        const targetScale = sphere.glowScale * scalePulse * scaleFactor;
        sphere.glowMesh.scale.set(targetScale, targetScale, targetScale);
      }
    } else {
      material.attenuationColor.set("#ffffff");
      if (material.sheenColor) {
        material.sheenColor.setHSL(0.58, 0.08, 0.72);
      }
      material.envMapIntensity = 1.12 + Math.sin(time * 0.3 + sphere.phase) * 0.12;
    }

    if (boundsCollision.collided) {
      onSphereCollision(sphere, boundsCollision.impactStrength, palette);
    }
  }

  // Handle sphere-to-sphere collisions
  for (let i = 0; i < count - 1; i += 1) {
    const a = spheres[i];
    for (let j = i + 1; j < count; j += 1) {
      const b = spheres[j];
      const collisionResult = resolveSphereCollision(a, b);
      if (collisionResult.collided) {
        onSphereCollision(a, collisionResult.impactStrength, palette, b);
        onSphereCollision(b, collisionResult.impactStrength, palette, a);
      }
    }
  }

  // Maintain sphere speeds
  for (let i = 0; i < count; i += 1) {
    maintainSphereSpeed(spheres[i]);
  }
}
