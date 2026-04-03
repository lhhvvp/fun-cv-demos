// shaders/ripple-shader.js
import { BaseShader } from './base-shader.js';

export class RippleShader extends BaseShader {
    constructor() {
        super();
        
        this.parameters = {
            amplitude: 0.2,
            frequency: 30.0,        // Reduced from 12.0 for wider ripples
            radius: 0.3,
            waveStrength: 0.08     // Increased from 0.05 for more pronounced effect
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
            uniform float uAmplitude;
            uniform float uFrequency;
            uniform float uRadius;
            uniform float uWaveStrength;
            uniform float uVideoAspectRatio;
            uniform float uScreenAspectRatio;
            varying vec2 vUv;
            varying vec2 vVideoUv;

            ${this.getCommonShaderFunctions()}

            // Calculate wave displacement for a given point
            vec2 calculateWaveDisplacement(vec2 uv, vec2 handPos, float time, int handIndex) {
                vec2 delta = uv - handPos;
                float distance = length(delta);
                
                // Create influence zone
                float influence = smoothstep(uRadius, 0.0, distance);
                
                if (influence > 0.01) {
                    // Calculate wave phase based on distance from hand - SLOWER WAVES
                    float phase = distance * uFrequency - time * 1.8; // Reduced from 3.0
                    
                    // Add hand-specific phase offset
                    float handOffset = float(handIndex) * 3.14159;
                    phase += handOffset;
                    
                    // Create multiple wave components for more complex ripples - SLOWER TIMING
                    float wave1 = sin(phase);
                    float wave2 = sin(phase * 0.7 + time * 1.2); // Reduced from 2.0
                    float wave3 = sin(phase * 1.3 - time * 0.9);  // Reduced from 1.5
                    
                    // Combine waves with MORE EMPHASIS on main wave
                    float combinedWave = wave1 * 0.7 + wave2 * 0.2 + wave3 * 0.1; // Increased main wave contribution
                    
                    // Calculate displacement direction (radial from hand)
                    vec2 direction = normalize(delta);
                    
                    // Apply wave-based displacement with INCREASED STRENGTH
                    float displacementMagnitude = combinedWave * uWaveStrength * influence * 1.5; // Added 1.5x multiplier
                    
                    // Add some tangential displacement for swirl effect - ALSO STRONGER
                    vec2 tangent = vec2(-direction.y, direction.x);
                    vec2 radialDisplacement = direction * displacementMagnitude;
                    vec2 tangentialDisplacement = tangent * displacementMagnitude * 0.4 * sin(phase * 1.5); // Increased from 0.3
                    
                    return radialDisplacement + tangentialDisplacement;
                }
                
                return vec2(0.0);
            }

            // Calculate interference displacement between two hands
            vec2 calculateInterferenceDisplacement(vec2 uv, vec2 hand1Pos, vec2 hand2Pos, float time) {
                vec2 delta1 = uv - hand1Pos;
                vec2 delta2 = uv - hand2Pos;
                
                float dist1 = length(delta1);
                float dist2 = length(delta2);
                float handDistance = length(hand1Pos - hand2Pos);
                
                // Only create interference when hands are close enough
                float maxInterferenceDistance = 0.6;
                float interferenceStrength = smoothstep(maxInterferenceDistance, 0.0, handDistance);
                
                if (interferenceStrength > 0.01) {
                    // Create interference patterns - SLOWER WAVES
                    float phase1 = dist1 * uFrequency * 1.5 - time * 3.5; // Reduced from 2.0 and 6.0
                    float phase2 = dist2 * uFrequency * 1.5 - time * 3.2; // Reduced from 2.0 and 5.5
                    
                    // Interference wave - STRONGER EFFECT
                    float interferenceWave = sin(phase1) * sin(phase2) * 2.5; // Increased from 2.0
                    
                    // Create complex interference pattern
                    float complexWave = sin(phase1 + phase2) * 0.6 + sin(phase1 - phase2) * 0.6; // Increased from 0.5
                    interferenceWave += complexWave;
                    
                    // Calculate displacement direction (average of both hand directions)
                    vec2 avgDirection = normalize(delta1 + delta2);
                    vec2 perpDirection = vec2(-avgDirection.y, avgDirection.x);
                    
                    // Apply interference displacement - STRONGER
                    float localInfluence = smoothstep(uRadius * 1.5, 0.0, min(dist1, dist2));
                    float displacementMag = interferenceWave * uWaveStrength * 1.0 * interferenceStrength * localInfluence; // Increased from 0.8
                    
                    return avgDirection * displacementMag + perpDirection * displacementMag * 0.6; // Increased from 0.5
                }
                
                return vec2(0.0);
            }

            void main() {
                vec2 videoUv = vVideoUv;
                videoUv = getAspectCorrectedUV(videoUv);
                
                // Calculate total displacement from all wave sources
                vec2 totalDisplacement = vec2(0.0);
                
                // Add displacement from each hand
                for (int i = 0; i < 2; i++) {
                    if (i < uHandCount) {
                        vec2 handPosVideo = vec2(1.0 - uHandPositions[i].x, 1.0 - uHandPositions[i].y);
                        handPosVideo = getAspectCorrectedUV(handPosVideo);
                        
                        vec2 handDisplacement = calculateWaveDisplacement(videoUv, handPosVideo, uTime, i);
                        totalDisplacement += handDisplacement;
                    }
                }
                
                // Add interference displacement when multiple hands are present
                if (uHandCount >= 2) {
                    vec2 hand1Pos = vec2(1.0 - uHandPositions[0].x, 1.0 - uHandPositions[0].y);
                    vec2 hand2Pos = vec2(1.0 - uHandPositions[1].x, 1.0 - uHandPositions[1].y);
                    hand1Pos = getAspectCorrectedUV(hand1Pos);
                    hand2Pos = getAspectCorrectedUV(hand2Pos);
                    
                    vec2 interferenceDisplacement = calculateInterferenceDisplacement(videoUv, hand1Pos, hand2Pos, uTime);
                    totalDisplacement += interferenceDisplacement;
                }
                
                // Apply displacement to video sampling coordinates
                vec2 distortedVideoUv = videoUv + totalDisplacement;
                
                // Sample the video with distorted coordinates
                vec3 finalColor = vec3(0.1, 0.1, 0.2); // Default background
                
                // Clamp UV coordinates to valid range
                if (distortedVideoUv.y >= 0.0 && distortedVideoUv.y <= 1.0) {
                    vec2 clampedUv = vec2(clamp(distortedVideoUv.x, 0.0, 1.0), distortedVideoUv.y);
                    vec4 videoColor = texture2D(uVideo, clampedUv);
                    finalColor = videoColor.rgb;
                }
                
                // Add subtle color effects based on wave intensity - MORE PRONOUNCED
                float waveIntensity = length(totalDisplacement) / uWaveStrength;
                if (waveIntensity > 0.01) {
                    // Add chromatic aberration effect - STRONGER
                    vec2 offsetR = totalDisplacement * 1.2; // Increased from 0.9
                    vec2 offsetB = -totalDisplacement * 1.2; // Increased from 0.9
                    
                    float r = texture2D(uVideo, clamp(videoUv + offsetR, 0.0, 1.0)).r;
                    float g = finalColor.g;
                    float b = texture2D(uVideo, clamp(videoUv + offsetB, 0.0, 1.0)).b;
                    
                    finalColor = mix(finalColor, vec3(r, g, b), waveIntensity * 0.7); // Increased from 0.5
                }
                
                // Add wave-based color modulation for each hand - SLOWER BUT MORE VISIBLE
                for (int i = 0; i < 2; i++) {
                    if (i < uHandCount) {
                        vec2 delta = vUv - uHandPositions[i];
                        float handDist = length(delta);
                        float influence = smoothstep(uRadius * 0.8, 0.0, handDist);
                        
                        if (influence > 0.01) {
                            // Create wave-based color modulation - SLOWER WAVES
                            float phase = handDist * uFrequency * 2.5 - uTime * 6.0; // Reduced from 3.0 and 10.0
                            float colorWave = sin(phase) * 0.3 + 0.3; // Increased from 0.2 + 0.2
                            
                            // Hand-specific colors
                            vec3 handColor = i == 0 ? vec3(1.0, 1.0, 1.0) : vec3(0.4, 0.3, 0.8);

                            // Apply color modulation - STRONGER
                            finalColor += handColor * colorWave * influence * 1.2; // Added 1.2x multiplier
                        }
                    }
                }
                
                // Mix with trail for persistence
                vec4 trailColor = texture2D(uTrail, vUv) * 0.85;
                finalColor = max(finalColor, trailColor.rgb);
                
                // Ensure we don't exceed color bounds
                finalColor = clamp(finalColor, 0.0, 1.0);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
    }

    getUniforms() {
        return {
            ...super.getUniforms(),
            uAmplitude: { value: this.parameters.amplitude },
            uFrequency: { value: this.parameters.frequency },
            uRadius: { value: this.parameters.radius },
            uWaveStrength: { value: this.parameters.waveStrength }
        };
    }

    getControls() {
        return [
            {
                id: 'waveStrength',
                label: 'DISTORT',
                min: 0.0,
                max: 0.25,  // Increased max from 0.2 to allow for stronger effects
                step: 0.01,
                value: this.parameters.waveStrength
            },
            {
                id: 'frequency',
                label: 'FREQUENCY',
                min: 0.0,
                max: 100.0,
                step: 0.5,
                value: this.parameters.frequency
            },
            {
                id: 'radius',
                label: 'RADIUS',
                min: 0.1,
                max: 1.0,
                step: 0.05,
                value: this.parameters.radius
            },
            {
                id: 'amplitude',
                label: 'COLOR FX',
                min: 0.0,
                max: 0.2,
                step: 0.005,
                value: this.parameters.amplitude
            }
        ];
    }

    updateParameter(paramId, value, material) {
        this.parameters[paramId] = value;
        
        switch (paramId) {
            case 'amplitude':
                material.uniforms.uAmplitude.value = value;
                break;
            case 'frequency':
                material.uniforms.uFrequency.value = value;
                break;
            case 'radius':
                material.uniforms.uRadius.value = value;
                break;
            case 'waveStrength':
                material.uniforms.uWaveStrength.value = value;
                break;
        }
    }
}