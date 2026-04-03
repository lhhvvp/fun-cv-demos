import * as THREE from "three";

// Glow ray geometry (shared across all glow spheres)
export const glowRayGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

export function createGlowRayMaterial(colorHex) {
  const color = new THREE.Color(colorHex);

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uBaseIntensity: { value: 1 },
      uPulse: { value: 1 },
      uRayDensity: { value: THREE.MathUtils.randFloat(1000.5, 2000.5) },
      uRayFalloff: { value: THREE.MathUtils.randFloat(100.1, 200.1) },
      uGlowStrength: { value: THREE.MathUtils.randFloat(10.1, 15.2) },
      uNoiseShift: { value: Math.random() * 2000.0 }
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;

      uniform float uTime;
      uniform vec3 uColor;
      uniform float uBaseIntensity;
      uniform float uPulse;
      uniform float uRayDensity;
      uniform float uRayFalloff;
      uniform float uGlowStrength;
      uniform float uNoiseShift;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);

        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));

        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(a, b, u.x) +
               (c - a) * u.y * (1.0 - u.x) +
               (d - b) * u.x * u.y;
      }

      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float radius = length(centered);

        if (radius > 1.0) {
          discard;
        }

        float angle = atan(centered.y, centered.x);
        float rayWave = cos(angle * uRayDensity + uTime * 1.4 + uNoiseShift);
        float rayMask = pow(max(rayWave, 0.0), uRayFalloff * 100.4);

        vec2 noiseCoord = vec2(angle / 6.28318, radius);
        noiseCoord *= 4.0;
        noiseCoord += vec2(uTime * 0.1 + uNoiseShift, uTime * 0.13 + uNoiseShift * 0.5);

        float animatedNoise = noise(noiseCoord);
        float streakFalloff = pow(max(0.0, 1.0 - radius * 1.2), 1.6);
        float rays = rayMask * streakFalloff * (0.65 + 0.35 * animatedNoise);

        float glow = exp(-radius * radius * uGlowStrength);

        float intensity = uBaseIntensity * uPulse;
        float alpha = clamp((glow * 0.75 + rays) * intensity, 0.0, 1.0);
        vec3 color = uColor * (glow * 1.4 + rays * 2.8) * intensity;

        gl_FragColor = vec4(color, alpha);
      }
    `
  });
}

export function createRoomMaterial() {
  return new THREE.MeshPhysicalMaterial({
    side: THREE.BackSide,
    roughness: 0.5,
    metalness: 0.5,
    envMapIntensity: 0.0,
    color: new THREE.Color("#3c3c3c"),
    sheen: 0.5,
    sheenColor: new THREE.Color("#1e2c42"),
    sheenRoughness: 0.2
  });
}

export function createSphereMaterial(type, hue, glowSaturation, glowLightness, glassLightness, radius, thicknessScale) {
  const saturation = type === "glow" ? glowSaturation : 0;
  const lightness = type === "glow" ? glowLightness : glassLightness;

  const attenuationColor =
    type === "glow"
      ? new THREE.Color().setHSL(hue, glowSaturation, glowLightness + 0.1)
      : new THREE.Color("#ffffff");
      
  const sheenColor =
    type === "glow"
      ? new THREE.Color().setHSL((hue + 0.05) % 1, glowSaturation * 0.6, 0.6)
      : new THREE.Color().setHSL(0.58, 0.1, 0.72);

  const baseThickness = radius * (1.8 + Math.random() * 0.6);
  const attenuationDistance =
    type === "glow" ? 1.4 + Math.random() * 1.4 : THREE.MathUtils.randFloat(3.6, 5.2);

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffffff"),
    transmission: 1,
    roughness: type === "glow" ? 0.04 : 0.022,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: type === "glow" ? 0.05 : 0.02,
    thickness: baseThickness * thicknessScale,
    envMapIntensity: type === "glow" ? 1.35 : 1.18,
    attenuationColor,
    attenuationDistance,
    specularIntensity: 1,
    specularColor: new THREE.Color("#ffffff"),
    sheen: type === "glow" ? 0.4 : 0.28,
    sheenColor,
    sheenRoughness: type === "glow" ? 0.7 : 0.55,
    ior: 1.5,
    emissive: new THREE.Color("#000000"),
    emissiveIntensity: 0
  });
}

export function disposeMaterial(material) {
  if (!material) {
    return;
  }

  if (Array.isArray(material)) {
    material.forEach((item) => disposeMaterial(item));
    return;
  }

  if (typeof material.dispose === "function") {
    material.dispose();
  }
}
