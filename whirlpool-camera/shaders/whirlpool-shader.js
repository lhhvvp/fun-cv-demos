// shaders/whirlpool-shader.js
import { BaseShader } from './base-shader.js';

export class WhirlpoolShader extends BaseShader {
    constructor() {
        super();
        
        this.parameters = {
            distortion: 6.0,
            decay: 0.5,
            radius: 250.0
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
            uniform float uDistortionStrength;
            uniform float uTrailDecay;
            uniform float uEffectRadius;
            uniform float uVideoAspectRatio;
            uniform float uScreenAspectRatio;
            varying vec2 vUv;
            varying vec2 vVideoUv;

            ${this.getCommonShaderFunctions()}

            vec2 distortUV(vec2 uv, vec2 handPos, float strength) {
                vec2 delta = uv - handPos;
                float dist = length(delta * uResolution);
                
                if (dist < uEffectRadius) {
                    float factor = 1.0 - (dist / uEffectRadius);
                    factor = factor * factor * factor; // Cubic falloff
                    
                    // Create swirl distortion
                    float angle = atan(delta.y, delta.x);
                    float swirl = sin(dist * 0.02 + uTime * 2.0) * strength * factor;
                    
                    vec2 offset = vec2(cos(angle + swirl), sin(angle + swirl)) * factor * strength * 0.05;
                    return uv + offset;
                }
                
                return uv;
            }

            void main() {
                vec2 videoUv = vVideoUv;
                videoUv = getAspectCorrectedUV(videoUv);
                
                // Apply distortion from each hand to video UV
                for (int i = 0; i < 2; i++) {
                    if (i < uHandCount) {
                        vec2 handPosVideo = vec2(1.0 - uHandPositions[i].x, 1.0 - uHandPositions[i].y);
                        handPosVideo = getAspectCorrectedUV(handPosVideo);
                        videoUv = distortUV(videoUv, handPosVideo, uDistortionStrength);
                    }
                }
                
                vec4 videoColor = vec4(0.1, 0.1, 0.2, 1.0);
                
                if (videoUv.y >= 0.0 && videoUv.y <= 1.0) {
                    vec2 clampedUv = vec2(clamp(videoUv.x, 0.0, 1.0), videoUv.y);
                    videoColor = texture2D(uVideo, clampedUv);
                }
                
                if (videoColor.a < 0.1) {
                    videoColor = vec4(0.1, 0.1, 0.2, 1.0);
                }
                
                vec4 trailColor = texture2D(uTrail, vUv) * uTrailDecay;
                
                // Add hand glow effects
                float glow = 0.0;
                for (int i = 0; i < 2; i++) {
                    if (i < uHandCount) {
                        vec2 delta = vUv - uHandPositions[i];
                        float dist = length(delta * uResolution);
                        if (dist < uEffectRadius * 0.5) {
                            float factor = 1.0 - (dist / (uEffectRadius * 0.5));
                            glow += factor * 0.3;
                        }
                    }
                }
                
                vec3 finalColor = mix(videoColor.rgb, videoColor.rgb + vec3(0.2, 0.5, 1.0), glow);
                finalColor = max(finalColor, trailColor.rgb);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
    }

    getUniforms() {
        return {
            ...super.getUniforms(),
            uDistortionStrength: { value: this.parameters.distortion },
            uTrailDecay: { value: this.parameters.decay },
            uEffectRadius: { value: this.parameters.radius }
        };
    }

    getControls() {
        return [
            {
                id: 'distortion',
                label: 'DISTORT',
                min: 0,
                max: 10,
                step: 0.1,
                value: this.parameters.distortion
            },
            {
                id: 'decay',
                label: 'DECAY',
                min: 0.0,
                max: 1,
                step: 0.01,
                value: this.parameters.decay
            },
            {
                id: 'radius',
                label: 'RADIUS',
                min: 50,
                max: 500,
                step: 10,
                value: this.parameters.radius
            }
        ];
    }

    updateParameter(paramId, value, material) {
        this.parameters[paramId] = value;
        
        switch (paramId) {
            case 'distortion':
                material.uniforms.uDistortionStrength.value = value;
                break;
            case 'decay':
                material.uniforms.uTrailDecay.value = value;
                break;
            case 'radius':
                material.uniforms.uEffectRadius.value = value;
                break;
        }
    }
}