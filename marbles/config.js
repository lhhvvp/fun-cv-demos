// Room and boundary configuration
export const roomSize = 15;
export const halfRoom = roomSize / 2;

// Sphere types
export const SphereType = Object.freeze({
  GLOW: "glow",
  GLASS: "glass"
});

// Refraction constants
export const REFRACTION_IOR = 1.5;
export const REFRACTION_THICKNESS_SCALE = 1.0;

// Sphere size configuration
export const baseSphereSize = {
  minRadius: 0.5,
  maxRadius: 2.0
};

export const sphereSizeScaleRange = { min: 0.5, max: 2.0 };

export const sphereConfig = {
  minRadius: baseSphereSize.minRadius,
  maxRadius: baseSphereSize.maxRadius
};

// Speed and movement ranges
export const sphereSpeedRange = { min: 1.9, max: 2.8 };
export const sphereCountRange = { min: 2, max: 20 };
export const brightnessRange = { min: 0.2, max: 2.0 };
export const glowStrengthRange = { min: 0.2, max: 3.0 };
export const speedRange = { min: 0.0, max: 3 };

// Color palettes for different themes
export const palettes = {
  neon: ["#0000ff", "#00ff00", "#ff0000"],
  pastel: ["#ffb3d9", "#b3d9ff", "#d9ffb3", "#ffe6b3", "#e6b3ff", "#ffccb3"],
  evangelion: ["#9b59b6", "#1abc9c", "#f39c12", "#e74c3c"],
  akira: ["#ff0040", "#ff6b9d", "#c71585", "#8b008b", "#4b0082"],
  "cowboy-bebop": ["#ffd700", "#ff8c00", "#dc143c", "#4169e1", "#2f4f4f"],
  bloomberg: ["#000000", "#ff6600", "#0066cc", "#00cc66"],
  "tokyo-night": ["#7aa2f7", "#bb9af7", "#9ece6a", "#e0af68", "#f7768e", "#73daca"]
};

// Camera configuration
export const cameraConfig = {
  fov: 45,
  near: 0.1,
  far: 100,
  radiusMultiplier: 1.8,
  verticalOffsetMultiplier: 0.08
};

// Camera controls configuration
export const controlsConfig = {
  enableDamping: true,
  dampingFactor: 0.08,
  enablePan: false,
  rotateSpeed: 0.6,
  zoomSpeed: 0.75,
  enableZoom: false,
  minPolarAngle: Math.PI * 0.08,
  maxPolarAngle: Math.PI - Math.PI * 0.12,
  minDistanceMultiplier: 0.18,
  maxDistanceMultiplier: 4.0
};

// Camera inertia configuration
export const inertiaConfig = {
  maxVelocity: 15,
  minVelocity: 0.00002,
  decayStrength: 4.0
};

// Zoom configuration
export const zoomConfig = {
  zoomSpeed: 8.0,
  zoomThreshold: 0.001
};

// Physics configuration
export const restitution = 5.0;

// Initial UI state
export const initialUiState = {
  sphereSizeScale: 1,
  sphereCount: 12,
  brightness: 1,
  glowStrength: 1,
  speed: 2
};
