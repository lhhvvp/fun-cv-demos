// shaders/ascii-shader.js
import * as THREE from 'three';
import { BaseShader } from './base-shader.js';

export class AsciiShader extends BaseShader {
    constructor() {
        super();
        
        // ASCII shader specific uniforms
        this.asciiUniforms = {
            uAsciiRadius: { value: 200.0 },
            uAsciiSize: { value: 8.0 },
            uColorIntensity: { value: 0.0 }, // 0 = B&W, 1 = full rainbow
            uPortalSoftness: { value: 0.3 }
        };
    }

    getFragmentShader() {
        return `
            uniform sampler2D uVideo;
            uniform sampler2D uTrail;
            uniform vec2 uResolution;
            uniform vec2 uHandPositions[2];
            uniform int uHandCount;
            uniform float uTime;
            uniform float uVideoAspectRatio;
            uniform float uScreenAspectRatio;
            
            // ASCII specific uniforms
            uniform float uAsciiRadius;
            uniform float uAsciiSize;
            uniform float uColorIntensity;
            uniform float uPortalSoftness;
            
            varying vec2 vUv;
            varying vec2 vVideoUv;
            
            ${this.getCommonShaderFunctions()}
            
            // Convert HSV to RGB for rainbow colors
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }
            
            // Generate rainbow color based on position and time
            vec3 getRainbowColor(vec2 uv, float brightness, float time) {
                // Create hue variation based on position and time
                float hue = fract(
                    uv.x * 0.5 + 
                    uv.y * 0.3 + 
                    time * 0.1 + 
                    brightness * 0.2
                );
                
                // Higher saturation for brighter areas
                float saturation = 0.7 + brightness * 0.3;
                
                // Use brightness as value, but keep it reasonably bright
                float value = 0.3 + brightness * 0.7;
                
                return hsv2rgb(vec3(hue, saturation, value));
            }
            
            // Draw realistic ASCII characters using SDF-like techniques
            float drawAt(vec2 uv) {
                // '@' symbol - circle with inner circle and line
                float outer = 1.0 - smoothstep(0.35, 0.4, length(uv - 0.5));
                float inner = smoothstep(0.15, 0.2, length(uv - 0.5));
                float innerCircle = 1.0 - smoothstep(0.08, 0.12, length(uv - vec2(0.6, 0.4)));
                float line = 1.0 - smoothstep(0.02, 0.04, abs(uv.x - 0.6));
                line *= step(0.4, uv.y) * step(uv.y, 0.7);
                return outer * inner + innerCircle + line;
            }
            
            float drawHash(vec2 uv) {
                // '#' symbol - two horizontal and two vertical lines
                float h1 = 1.0 - smoothstep(0.02, 0.04, abs(uv.y - 0.35));
                float h2 = 1.0 - smoothstep(0.02, 0.04, abs(uv.y - 0.65));
                float v1 = 1.0 - smoothstep(0.02, 0.04, abs(uv.x - 0.35));
                float v2 = 1.0 - smoothstep(0.02, 0.04, abs(uv.x - 0.65));
                return max(max(h1, h2), max(v1, v2));
            }
            
            float drawPercent(vec2 uv) {
                // '%' symbol - two circles and diagonal line
                float topCircle = 1.0 - smoothstep(0.08, 0.12, length(uv - vec2(0.3, 0.3)));
                float bottomCircle = 1.0 - smoothstep(0.08, 0.12, length(uv - vec2(0.7, 0.7)));
                float diagonal = 1.0 - smoothstep(0.02, 0.04, abs((uv.x - uv.y) - 0.1));
                return max(max(topCircle, bottomCircle), diagonal);
            }
            
            float drawAsterisk(vec2 uv) {
                // '*' symbol - three lines intersecting
                vec2 center = uv - 0.5;
                float line1 = 1.0 - smoothstep(0.01, 0.03, abs(center.x));
                float line2 = 1.0 - smoothstep(0.01, 0.03, abs(center.y));
                float line3 = 1.0 - smoothstep(0.01, 0.03, abs(center.x - center.y));
                float line4 = 1.0 - smoothstep(0.01, 0.03, abs(center.x + center.y));
                return max(max(line1, line2), max(line3, line4)) * step(length(center), 0.2);
            }
            
            float drawO(vec2 uv) {
                // 'o' symbol - circle with hole
                float outer = 1.0 - smoothstep(0.15, 0.2, length(uv - 0.5));
                float inner = smoothstep(0.08, 0.12, length(uv - 0.5));
                return outer * inner;
            }
            
            float drawPlus(vec2 uv) {
                // '+' symbol - horizontal and vertical lines
                float h = 1.0 - smoothstep(0.02, 0.04, abs(uv.y - 0.5));
                float v = 1.0 - smoothstep(0.02, 0.04, abs(uv.x - 0.5));
                h *= step(0.2, uv.x) * step(uv.x, 0.8);
                v *= step(0.2, uv.y) * step(uv.y, 0.8);
                return max(h, v);
            }
            
            float drawDot(vec2 uv) {
                // '.' symbol - small circle
                return 1.0 - smoothstep(0.05, 0.08, length(uv - vec2(0.5, 0.8)));
            }
            
            float drawComma(vec2 uv) {
                // ',' symbol - small circle with tail
                float dot = 1.0 - smoothstep(0.04, 0.06, length(uv - vec2(0.5, 0.75)));
                float tail = 1.0 - smoothstep(0.01, 0.02, abs(uv.x - 0.45));
                tail *= step(0.75, uv.y) * step(uv.y, 0.85);
                return max(dot, tail);
            }
            
            float drawMinus(vec2 uv) {
                // '-' symbol - horizontal line
                float line = 1.0 - smoothstep(0.02, 0.04, abs(uv.y - 0.5));
                return line * step(0.2, uv.x) * step(uv.x, 0.8);
            }
            
            // ASCII character approximation using realistic character shapes
            float getAsciiChar(vec2 uv, float brightness) {
                // Normalize UV to character cell (0-1)
                vec2 charUv = fract(uv);
                
                // Different ASCII characters based on brightness levels
                float pattern = 0.0;
                
                if (brightness > 0.9) {
                    // Very bright - '@' symbol
                    pattern = drawAt(charUv);
                } else if (brightness > 0.75) {
                    // Bright - '#' symbol
                    pattern = drawHash(charUv);
                } else if (brightness > 0.6) {
                    // Medium-bright - '%' symbol
                    pattern = drawPercent(charUv);
                } else if (brightness > 0.45) {
                    // Medium - '*' symbol
                    pattern = drawAsterisk(charUv);
                } else if (brightness > 0.3) {
                    // Medium-low - 'o' symbol
                    pattern = drawO(charUv);
                } else if (brightness > 0.15) {
                    // Low - '+' symbol
                    pattern = drawPlus(charUv);
                } else if (brightness > 0.05) {
                    // Very low - '.' symbol
                    pattern = drawDot(charUv);
                } else if (brightness > 0.02) {
                    // Extremely low - ',' symbol
                    pattern = drawComma(charUv);
                } else {
                    // Almost black - '-' symbol (very sparse)
                    pattern = drawMinus(charUv) * 0.3;
                }
                
                return pattern;
            }
            
            vec3 applyAsciiEffect(vec2 uv, vec3 videoColor) {
                // Calculate ASCII grid position
                vec2 asciiUv = uv * uResolution / uAsciiSize;
                vec2 cellUv = floor(asciiUv);
                
                // Sample video color at cell center for consistent character selection
                vec2 cellCenter = (cellUv + 0.5) * uAsciiSize / uResolution;
                
                // Apply the same aspect ratio correction as the main video
                vec2 videoSampleUv = cellCenter;
                videoSampleUv.y = 1.0 - videoSampleUv.y;  // Flip Y
                videoSampleUv.x = 1.0 - videoSampleUv.x;  // Flip X (mirror)
                
                // CRITICAL FIX: Apply aspect ratio correction
                videoSampleUv = getAspectCorrectedUV(videoSampleUv);
                
                vec3 cellColor = vec3(0.1, 0.1, 0.2); // Default fallback color
                
                // Sample video with proper bounds checking
                if (videoSampleUv.y >= 0.0 && videoSampleUv.y <= 1.0) {
                    vec2 clampedUv = vec2(clamp(videoSampleUv.x, 0.0, 1.0), videoSampleUv.y);
                    cellColor = texture2D(uVideo, clampedUv).rgb;
                }
                
                // Calculate brightness
                float brightness = dot(cellColor, vec3(0.299, 0.587, 0.114));
                
                // Get ASCII pattern
                float asciiPattern = getAsciiChar(asciiUv, brightness);
                
                // Create base color based on intensity setting
                vec3 baseColor;
                if (uColorIntensity < 0.01) {
                    // Pure black and white
                    baseColor = vec3(asciiPattern);
                } else {
                    // Mix between grayscale and rainbow
                    vec3 grayscale = vec3(asciiPattern);
                    vec3 rainbow = getRainbowColor(uv, brightness, uTime);
                    
                    // Apply the pattern as a mask to the rainbow
                    rainbow *= asciiPattern;
                    
                    // Mix based on color intensity
                    baseColor = mix(grayscale, rainbow, uColorIntensity);
                }
                
                return baseColor;
            }
            
            void main() {
                vec2 uv = vUv;
                
                // Apply aspect ratio correction to video UV
                vec2 videoUv = vVideoUv;
                videoUv = getAspectCorrectedUV(videoUv);
                
                // Sample video with proper aspect ratio
                vec3 videoColor = vec3(0.1, 0.1, 0.2); // Default fallback
                if (videoUv.y >= 0.0 && videoUv.y <= 1.0) {
                    vec2 clampedUv = vec2(clamp(videoUv.x, 0.0, 1.0), videoUv.y);
                    videoColor = texture2D(uVideo, clampedUv).rgb;
                }
                
                vec3 trailColor = texture2D(uTrail, uv).rgb;
                
                // Start with video color
                vec3 finalColor = videoColor;
                
                // Apply ASCII effect around hands
                float totalInfluence = 0.0;
                vec3 asciiColor = vec3(0.0);
                
                for (int i = 0; i < 2; i++) {
                    if (i >= uHandCount) break;
                    
                    vec2 handPos = uHandPositions[i];
                    vec2 delta = uv - handPos;
                    float dist = length(delta * uResolution);
                    
                    // Add gentle pulsing to the radius
                    float pulsingRadius = uAsciiRadius * (1.0 + sin(uTime * 1.5) * 0.1);
                    
                    if (dist < pulsingRadius) {
                        // Sharp cutoff - no smoothing or edge effects
                        vec3 localAscii = applyAsciiEffect(uv, videoColor);
                        asciiColor = localAscii;
                        totalInfluence = 1.0;
                    }
                }
                
                // Mix ASCII effect with original video - sharp cutoff
                if (totalInfluence > 0.0) {
                    finalColor = asciiColor;
                }
                
                // Add subtle trail effect for magical persistence
                finalColor = mix(finalColor, trailColor * 0.95, 0.1);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
    }

    getUniforms() {
        return {
            ...this.commonUniforms,
            ...this.asciiUniforms
        };
    }

    getControls() {
        return [
            {
                id: 'ascii-radius',
                label: 'RADIUS',
                min: 50,
                max: 350,
                step: 10,
                value: 200
            },
            {
                id: 'ascii-size',
                label: 'ASCII SIZE',
                min: 2,
                max: 15,
                step: 1,
                value: 5,
            },
            {
                id: 'color-intensity',
                label: 'COLOR',
                min: 0.0,
                max: 1.0,
                step: 0.05,
                value: 0.0
            }
        ];
    }

    updateParameter(paramId, value, material) {
        switch (paramId) {
            case 'ascii-radius':
                material.uniforms.uAsciiRadius.value = value;
                break;
            case 'ascii-size':
                material.uniforms.uAsciiSize.value = value;
                break;
            case 'color-intensity':
                material.uniforms.uColorIntensity.value = value;
                break;
        }
    }
}