const canvas = document.getElementById("glCanvas");
const gl =
  canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: true,
  }) ||
  canvas.getContext("experimental-webgl", {
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: true,
  });

if (!gl) {
  document.body.innerHTML =
    '<div style="color: white; padding: 40px; text-align: center;"><h2>WebGL not supported</h2><p>Your browser does not support WebGL</p></div>';
  throw new Error("WebGL not supported");
}

console.log("WebGL Version:", gl.getParameter(gl.VERSION));
console.log("GLSL Version:", gl.getParameter(gl.SHADING_LANGUAGE_VERSION));

// Aspect ratio state
let aspectRatio = 'fullscreen';

// Resize canvas
function resizeCanvas() {
  const rightPanel = document.getElementById('rightPanel');
  if (rightPanel) {
    const panelWidth = rightPanel.clientWidth;
    const panelHeight = rightPanel.clientHeight;
    
    let canvasWidth, canvasHeight;
    
    switch(aspectRatio) {
      case 'fullscreen':
        canvasWidth = panelWidth;
        canvasHeight = panelHeight;
        break;
        
      case 'square':
        const squareSize = Math.min(panelWidth, panelHeight);
        canvasWidth = squareSize;
        canvasHeight = squareSize;
        break;
        
      case 'landscape':
        const landscapeByWidth = panelWidth;
        const landscapeByHeight = (panelWidth / 16) * 9;
        
        if (landscapeByHeight <= panelHeight) {
          canvasWidth = landscapeByWidth;
          canvasHeight = landscapeByHeight;
        } else {
          canvasHeight = panelHeight;
          canvasWidth = (panelHeight / 9) * 16;
        }
        break;
        
      case 'portrait':
        const portraitByHeight = panelHeight;
        const portraitByWidth = (panelHeight / 16) * 9;
        
        if (portraitByWidth <= panelWidth) {
          canvasWidth = portraitByWidth;
          canvasHeight = portraitByHeight;
        } else {
          canvasWidth = panelWidth;
          canvasHeight = (panelWidth / 9) * 16;
        }
        break;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// CFD Shader parameters - tuned for watercolor aesthetic
let flowSpeed = 0.8;
let turbulence = 0.3;
let viscosity = 0.5;
let vorticity = 0.4;
let swirlScale = 2.0;
let colorMode = 0;
let colorIntensity = 1.2;
let hueShift = 0.0;
let saturation = 1.5;
let brightness = 1.2;
let detail = 10;
let fieldScale = 1.0;
let distortion = 0.0;
let noiseAmount = 0.0;

// Enhanced mouse rotation control with inertia
let mouseX = 0;
let mouseY = 0;
let targetRotationX = 0;
let targetRotationY = 0;
let currentRotationX = 0;
let currentRotationY = 0;
let velocityX = 0;
let velocityY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let lastMoveTime = 0;

// Enhanced scale control with inertia
let targetScale = 1.0;
let currentScale = 1.0;
let scaleVelocity = 0;
let scale = 1.0;

// Smoothed flow speed for graceful transitions
let targetFlowSpeed = 1.0;
let currentFlowSpeed = 1.0;
const FLOW_SPEED_SMOOTHING = 0.2;

// Physics constants
const ROTATION_SMOOTHING = 0.05;
const ROTATION_FRICTION = 0.3;
const ROTATION_SENSITIVITY = 0.003;
const SCALE_SMOOTHING = 0.05;
const SCALE_FRICTION = 0.3;
const SCALE_SENSITIVITY = 0.001;

// Hand tracking state
let isHandTrackingActive = false;
let hands = null;
let camera = null;
let videoElement = null;
let canvasElement = null;
let canvasCtx = null;
let webcamCanvas = null;
let webcamCtx = null;

// Hand tracking smoothing
let smoothedThumb = { x: 0, y: 0 };
let smoothedIndex = { x: 0, y: 0 };
let smoothedThumb2 = { x: 0, y: 0 };
let smoothedIndex2 = { x: 0, y: 0 };
const HAND_SMOOTHING_FACTOR = 0.1;

// Auto-animation state
let autoRotate = false;
let autoRotateTime = 0;

// Hand tracking state for stable assignment
let hand1Id = null;
let hand2Id = null;
let lastHandPositions = {};
const HAND_MATCH_THRESHOLD = 200;

// Hand tracking constants
const THUMB_TIP = 4;
const INDEX_TIP = 8;

// Vertex shader
const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

// Impressionist Watercolor Fragment Shader
const fragmentShaderSource = `
    precision highp float;
    uniform vec2 iResolution;
    uniform float iTime;
    uniform float uFlowSpeed;
    uniform float uTurbulence;
    uniform float uViscosity;
    uniform float uVorticity;
    uniform float uSwirlScale;
    uniform int uColorMode;
    uniform float uColorIntensity;
    uniform float uHueShift;
    uniform float uSaturation;
    uniform float uBrightness;
    uniform int uDetail;
    uniform float uFieldScale;
    uniform float uDistortion;
    uniform float uNoise;
    uniform vec2 uMouse;
    
    // Simplex noise functions
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        i = mod289(i);
        vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
    
    // HSV to RGB conversion
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    // Bold Impressionist Palettes
    vec3 palette1(float t, float accent) {
        // Monet Water Lilies - rich blues, greens, pinks
        vec3 deepBlue = vec3(0.12, 0.22, 0.50);
        vec3 vibrantTeal = vec3(0.18, 0.50, 0.55);
        vec3 freshGreen = vec3(0.30, 0.60, 0.35);
        vec3 softPink = vec3(0.85, 0.50, 0.60);
        vec3 warmYellow = vec3(0.95, 0.82, 0.40);
        
        vec3 color;
        if(t < 0.25) color = mix(deepBlue, vibrantTeal, t * 4.0);
        else if(t < 0.5) color = mix(vibrantTeal, freshGreen, (t - 0.25) * 4.0);
        else if(t < 0.75) color = mix(freshGreen, softPink, (t - 0.5) * 4.0);
        else color = mix(softPink, warmYellow, (t - 0.75) * 4.0);
        
        return mix(color, warmYellow, accent * 0.2);
    }
    
    vec3 palette2(float t, float accent) {
        // Van Gogh Starry Night - deep blues, bright yellows
        vec3 deepNavy = vec3(0.08, 0.10, 0.32);
        vec3 richBlue = vec3(0.18, 0.32, 0.60);
        vec3 vibrantCyan = vec3(0.25, 0.55, 0.70);
        vec3 brightYellow = vec3(0.95, 0.88, 0.25);
        vec3 warmOrange = vec3(0.95, 0.60, 0.20);
        
        vec3 color;
        if(t < 0.3) color = mix(deepNavy, richBlue, t / 0.3);
        else if(t < 0.5) color = mix(richBlue, vibrantCyan, (t - 0.3) / 0.2);
        else if(t < 0.75) color = mix(vibrantCyan, brightYellow, (t - 0.5) / 0.25);
        else color = mix(brightYellow, warmOrange, (t - 0.75) / 0.25);
        
        return mix(color, brightYellow, accent * 0.15);
    }
    
    vec3 palette3(float t, float accent) {
        // Renoir Garden - warm pinks, greens, golden
        vec3 deepRose = vec3(0.65, 0.25, 0.35);
        vec3 softPink = vec3(0.88, 0.50, 0.55);
        vec3 creamPeach = vec3(0.96, 0.82, 0.65);
        vec3 leafGreen = vec3(0.35, 0.60, 0.30);
        vec3 goldenYellow = vec3(0.92, 0.78, 0.30);
        
        vec3 color;
        if(t < 0.25) color = mix(deepRose, softPink, t * 4.0);
        else if(t < 0.5) color = mix(softPink, creamPeach, (t - 0.25) * 4.0);
        else if(t < 0.75) color = mix(creamPeach, leafGreen, (t - 0.5) * 4.0);
        else color = mix(leafGreen, goldenYellow, (t - 0.75) * 4.0);
        
        return mix(color, creamPeach, accent * 0.15);
    }
    
    vec3 palette4(float t, float accent) {
        // Degas Ballet - purples, warm peach, stage gold
        vec3 deepPurple = vec3(0.30, 0.20, 0.45);
        vec3 softLavender = vec3(0.60, 0.50, 0.70);
        vec3 warmPeach = vec3(0.94, 0.72, 0.60);
        vec3 paleGold = vec3(0.96, 0.90, 0.65);
        vec3 softWhite = vec3(0.96, 0.94, 0.90);
        
        vec3 color;
        if(t < 0.25) color = mix(deepPurple, softLavender, t * 4.0);
        else if(t < 0.5) color = mix(softLavender, warmPeach, (t - 0.25) * 4.0);
        else if(t < 0.75) color = mix(warmPeach, paleGold, (t - 0.5) * 4.0);
        else color = mix(paleGold, softWhite, (t - 0.75) * 4.0);
        
        return mix(color, paleGold, accent * 0.2);
    }
    
    vec3 palette5(float t, float accent) {
        // Cezanne Provence - terracotta, ochre, Mediterranean
        vec3 terracotta = vec3(0.75, 0.40, 0.25);
        vec3 warmOchre = vec3(0.88, 0.65, 0.35);
        vec3 oliveGreen = vec3(0.45, 0.50, 0.30);
        vec3 skyBlue = vec3(0.50, 0.70, 0.88);
        vec3 deepBlue = vec3(0.25, 0.40, 0.65);
        
        vec3 color;
        if(t < 0.25) color = mix(terracotta, warmOchre, t * 4.0);
        else if(t < 0.5) color = mix(warmOchre, oliveGreen, (t - 0.25) * 4.0);
        else if(t < 0.75) color = mix(oliveGreen, skyBlue, (t - 0.5) * 4.0);
        else color = mix(skyBlue, deepBlue, (t - 0.75) * 4.0);
        
        return mix(color, warmOchre, accent * 0.15);
    }
    
    void main() {
        vec2 fragCoord = gl_FragCoord.xy;
        vec2 uv = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
        uv *= uFieldScale/5.0;
        
        float time = iTime * uFlowSpeed * 0.2;
        
        // Mouse influence
        vec2 mouseInfluence = (uMouse - 0.5) * uDistortion * 0.6;
        vec2 pos = uv + mouseInfluence;
        
        // === IMPRESSIONIST BRUSHSTROKE LAYERS ===
        
        // Layer 1: Large sweeping strokes
        vec3 p1 = vec3(pos * uSwirlScale * 0.35, time * 0.2);
        float baseFlow = snoise(p1) * 0.5 + 0.5;
        
        // Organic warp
        vec2 warp1 = vec2(
            snoise(vec3(pos * 0.5, time * 0.1)),
            snoise(vec3(pos * 0.5 + 100.0, time * 0.1))
        ) * uTurbulence * 0.4;
        
        // Layer 2: Medium strokes with vortex
        vec3 p2 = vec3((pos + warp1) * uSwirlScale * 0.6, time * 0.25);
        float midFlow = snoise(p2);
        float vortex = snoise(vec3(pos * uVorticity * 1.8, time * 0.15)) * uVorticity * 1.5;
        midFlow = (midFlow + vortex) * 0.5 + 0.5;
        
        // Layer 3: Fine brushwork
        vec2 warp2 = vec2(
            snoise(vec3(pos * 1.2, time * 0.15 + 50.0)),
            snoise(vec3(pos * 1.2 + 200.0, time * 0.15))
        ) * uTurbulence * 1.2;
        
        vec3 p3 = vec3((pos + warp2) * uSwirlScale * 1.2, time * 0.3);
        float fineDetail = snoise(p3) * 0.5 + 0.5;
        
        // Accent layer
        vec3 p4 = vec3(pos * uSwirlScale * 0.4, time * 0.1);
        float accent = snoise(p4) * 0.5 + 0.5;
        
        // Blend layers
        float detailMix = 1.0 - uViscosity * 1.0;
        float combined = baseFlow * 0.4 + midFlow * 0.35 + fineDetail * 0.25 * detailMix;
        
        // Contrast and range
        combined = pow(combined, 1.0 / (uColorIntensity * 0.7 + 0.5));
        combined = smoothstep(0.05, 0.95, combined);
        
        // Apply palette
        vec3 color;
        if(uColorMode == 0) color = palette1(combined, accent);
        else if(uColorMode == 1) color = palette2(combined, accent);
        else if(uColorMode == 2) color = palette3(combined, accent);
        else if(uColorMode == 3) color = palette4(combined, accent);
        else color = palette5(combined, accent);
        
        // HSV adjustments
        float maxC = max(max(color.r, color.g), color.b);
        float minC = min(min(color.r, color.g), color.b);
        float delta = maxC - minC;
        
        vec3 hsv;
        hsv.z = maxC;
        hsv.y = (maxC > 0.0) ? delta / maxC : 0.0;
        
        if(delta > 0.0) {
            if(maxC == color.r) hsv.x = (color.g - color.b) / delta + (color.g < color.b ? 6.0 : 0.0);
            else if(maxC == color.g) hsv.x = (color.b - color.r) / delta + 2.0;
            else hsv.x = (color.r - color.g) / delta + 4.0;
            hsv.x /= 6.0;
        } else hsv.x = 0.0;
        
        // Apply hue shift and boost saturation
        hsv.x = fract(hsv.x + uHueShift / 6.28318);
        hsv.y = min(hsv.y * uSaturation * 1.4, 1.0);
        hsv.z *= uBrightness * 1.5;
        
        color = hsv2rgb(hsv);
        
        // Canvas texture
        if(uNoise > 0.0) {
            float tex = fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453);
            color += (tex - 0.5) * uNoise * 0.6;
        }
        
        // Soft vignette
        float vig = 1.0 - length(uv / uFieldScale) * 0.2;
        vig = smoothstep(0.4, 1.0, vig);
        color *= mix(0.9, 1.0, vig);

        // Blue noise-style grain (static)
      vec2 grainUV = fragCoord / 2.0;
      float grain = fract(sin(dot(floor(grainUV), vec2(12.9898, 78.233))) * 43758.5453);
      grain += fract(sin(dot(floor(grainUV * 2.0) + 0.5, vec2(39.346, 11.135))) * 43758.5453);
      grain += fract(sin(dot(floor(grainUV * 4.0) + 0.25, vec2(73.156, 52.235))) * 43758.5453);
      grain = grain / 3.0 - 0.5;
      color += grain * 0.5; // Adjust 0.04 for intensity
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

// Compile shader
function compileShader(source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error("Shader compile error:", info);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Create program
const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

if (!vertexShader || !fragmentShader) {
  throw new Error("Shader compilation failed");
}

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  const info = gl.getProgramInfoLog(program);
  console.error("Program link error:", info);
  throw new Error("Program linking failed");
}

gl.useProgram(program);

// Set up geometry
const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

// Get uniform locations
const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
const iTimeLocation = gl.getUniformLocation(program, "iTime");
const uFlowSpeedLocation = gl.getUniformLocation(program, "uFlowSpeed");
const uTurbulenceLocation = gl.getUniformLocation(program, "uTurbulence");
const uViscosityLocation = gl.getUniformLocation(program, "uViscosity");
const uVorticityLocation = gl.getUniformLocation(program, "uVorticity");
const uSwirlScaleLocation = gl.getUniformLocation(program, "uSwirlScale");
const uColorModeLocation = gl.getUniformLocation(program, "uColorMode");
const uColorIntensityLocation = gl.getUniformLocation(program, "uColorIntensity");
const uHueShiftLocation = gl.getUniformLocation(program, "uHueShift");
const uSaturationLocation = gl.getUniformLocation(program, "uSaturation");
const uBrightnessLocation = gl.getUniformLocation(program, "uBrightness");
const uDetailLocation = gl.getUniformLocation(program, "uDetail");
const uFieldScaleLocation = gl.getUniformLocation(program, "uFieldScale");
const uDistortionLocation = gl.getUniformLocation(program, "uDistortion");
const uNoiseLocation = gl.getUniformLocation(program, "uNoise");
const uMouseLocation = gl.getUniformLocation(program, "uMouse");

// Animation
let startTime = Date.now();

// FPS tracking
let frameCount = 0;
let lastFpsUpdate = Date.now();
let currentFps = 0;

function render() {
  const currentTime = (Date.now() - startTime) / 1000.0;

  // FPS calculation
  frameCount++;
  const now = Date.now();
  if (now - lastFpsUpdate >= 500) {
    currentFps = Math.round(frameCount / ((now - lastFpsUpdate) / 1000));
    frameCount = 0;
    lastFpsUpdate = now;
    const fpsElement = document.getElementById("fpsValue");
    if (fpsElement) {
      fpsElement.textContent = currentFps;
    }
  }

  // Auto-animate (slowly shifts the view)
  if (autoRotate && !isDragging && !isHandTrackingActive) {
    autoRotateTime += 0.003;
    targetRotationX = Math.sin(autoRotateTime * 0.7) * 0.3;
    targetRotationY = Math.cos(autoRotateTime) * 0.3;
    velocityX = 0;
    velocityY = 0;
  }

  // Apply inertia to rotation when not dragging and not hand tracking
  if (!isDragging && !isHandTrackingActive && !autoRotate) {
    targetRotationX += velocityX;
    targetRotationY += velocityY;
    velocityX *= ROTATION_FRICTION;
    velocityY *= ROTATION_FRICTION;

    if (Math.abs(velocityX) < 0.0001) velocityX = 0;
    if (Math.abs(velocityY) < 0.0001) velocityY = 0;
  }

  // Smooth rotation interpolation
  currentRotationX += (targetRotationX - currentRotationX) * ROTATION_SMOOTHING;
  currentRotationY += (targetRotationY - currentRotationY) * ROTATION_SMOOTHING;

  // Smooth scale interpolation
  currentScale += (targetScale - currentScale) * SCALE_SMOOTHING;
  scale = currentScale;

  // Smooth flow speed interpolation for graceful transitions
  targetFlowSpeed = flowSpeed;
  currentFlowSpeed += (targetFlowSpeed - currentFlowSpeed) * FLOW_SPEED_SMOOTHING;

  // Mouse position for shader (normalized 0-1)
  const mouseNormX = 0.5 + currentRotationY;
  const mouseNormY = 0.5 + currentRotationX;

  gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
  gl.uniform1f(iTimeLocation, currentTime);
  gl.uniform1f(uFlowSpeedLocation, currentFlowSpeed);
  gl.uniform1f(uTurbulenceLocation, turbulence);
  gl.uniform1f(uViscosityLocation, viscosity);
  gl.uniform1f(uVorticityLocation, vorticity);
  gl.uniform1f(uSwirlScaleLocation, swirlScale);
  gl.uniform1i(uColorModeLocation, colorMode);
  gl.uniform1f(uColorIntensityLocation, colorIntensity);
  gl.uniform1f(uHueShiftLocation, hueShift);
  gl.uniform1f(uSaturationLocation, saturation);
  gl.uniform1f(uBrightnessLocation, brightness);
  gl.uniform1i(uDetailLocation, detail);
  gl.uniform1f(uFieldScaleLocation, fieldScale * scale);
  gl.uniform1f(uDistortionLocation, distortion);
  gl.uniform1f(uNoiseLocation, noiseAmount);
  gl.uniform2f(uMouseLocation, mouseNormX, mouseNormY);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(render);
}

render();