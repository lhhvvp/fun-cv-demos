// shaders/base-shader.js
import * as THREE from 'three';

export class BaseShader {
    constructor() {
        this.vertexShader = `
            varying vec2 vUv;
            varying vec2 vVideoUv;
            void main() {
                vUv = uv;
                
                // Separate UV coordinates for video (flipped) and trail (normal)
                vVideoUv = uv;
                vVideoUv.y = 1.0 - vVideoUv.y;  // Flip Y for video
                vVideoUv.x = 1.0 - vVideoUv.x;  // Mirror X for video
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        this.commonUniforms = {
            uVideo: { value: null },
            uTrail: { value: null },
            uResolution: { value: new THREE.Vector2() },
            uHandPositions: { value: [new THREE.Vector2(0.5, 0.5), new THREE.Vector2(0.5, 0.5)] },
            uHandCount: { value: 0 },
            uTime: { value: 0 },
            uVideoAspectRatio: { value: 1.0 },
            uScreenAspectRatio: { value: 1.0 }
        };
    }

    // Common shader functions that all effects can use
    getCommonShaderFunctions() {
        return `
            vec2 getAspectCorrectedUV(vec2 uv) {
                vec2 correctedUv = uv;
                correctedUv -= 0.5;
                correctedUv.x *= uScreenAspectRatio / uVideoAspectRatio;
                correctedUv += 0.5;
                return correctedUv;
            }
            
            float getHandInfluence(vec2 uv, vec2 handPos, float radius) {
                vec2 delta = uv - handPos;
                float dist = length(delta * uResolution);
                
                if (dist < radius) {
                    float factor = 1.0 - (dist / radius);
                    return factor * factor * factor; // Cubic falloff
                }
                return 0.0;
            }
        `;
    }

    // To be implemented by subclasses
    getFragmentShader() {
        throw new Error('getFragmentShader must be implemented by subclass');
    }

    getUniforms() {
        return { ...this.commonUniforms };
    }

    getControls() {
        throw new Error('getControls must be implemented by subclass');
    }

    updateParameter(paramId, value, material) {
        throw new Error('updateParameter must be implemented by subclass');
    }

    createMaterial() {
        return new THREE.ShaderMaterial({
            vertexShader: this.vertexShader,
            fragmentShader: this.getFragmentShader(),
            uniforms: this.getUniforms()
        });
    }
}