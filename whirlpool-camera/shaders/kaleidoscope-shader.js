// shaders/kaleidoscope-shader.js
import { BaseShader } from './base-shader.js';

export class KaleidoscopeShader extends BaseShader {
    constructor() {
        super();
        
        this.parameters = {
            segments: 8.0,
            rotation: 0.5,
            zoom: 1.5
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
            uniform float uSegments;
            uniform float uRotation;
            uniform float uZoom;
            uniform float uVideoAspectRatio;
            uniform float uScreenAspectRatio;
            varying vec2 vUv;
            varying vec2 vVideoUv;

            ${this.getCommonShaderFunctions()}

            vec2 kaleidoscopeUV(vec2 uv, vec2 center, float segments, float rotation, float zoom) {
                vec2 pos = (uv - center) * zoom;
                
                // Convert to polar coordinates
                float angle = atan(pos.y, pos.x);
                float radius = length(pos);
                
                // Add rotation
                angle += rotation * uTime;
                
                // Create kaleidoscope segments
                float segmentAngle = 2.0 * 3.14159 / segments;
                angle = mod(angle, segmentAngle);
                
                // Mirror every other segment
                if (mod(floor(atan(pos.y, pos.x) / segmentAngle), 2.0) > 0.5) {
                    angle = segmentAngle - angle;
                }
                
                // Convert back to cartesian
                pos = vec2(cos(angle), sin(angle)) * radius;
                
                return pos + center;
            }

            void main() {
                vec2 videoUv = vVideoUv;
                videoUv = getAspectCorrectedUV(videoUv);
                
                // Apply kaleidoscope effect based on hand positions
                if (uHandCount > 0) {
                    vec2 handCenter = vec2(1.0 - uHandPositions[0].x, 1.0 - uHandPositions[0].y);
                    handCenter = getAspectCorrectedUV(handCenter);
                    
                    // Adjust segments based on second hand if available
                    float dynamicSegments = uSegments;
                    if (uHandCount > 1) {
                        float handDistance = distance(uHandPositions[0], uHandPositions[1]);
                        dynamicSegments = mix(4.0, 16.0, handDistance * 2.0);
                    }
                    
                    videoUv = kaleidoscopeUV(videoUv, handCenter, dynamicSegments, uRotation, uZoom);
                }
                
                vec4 videoColor = vec4(0.1, 0.1, 0.2, 1.0);
                
                if (videoUv.y >= 0.0 && videoUv.y <= 1.0) {
                    vec2 clampedUv = vec2(clamp(videoUv.x, 0.0, 1.0), videoUv.y);
                    videoColor = texture2D(uVideo, clampedUv);
                }
                
                if (videoColor.a < 0.1) {
                    videoColor = vec4(0.1, 0.1, 0.2, 1.0);
                }
                
                vec4 trailColor = texture2D(uTrail, vUv) * 0.9;
                
                // Add kaleidoscope color enhancement
                float enhancement = 0.0;
                for (int i = 0; i < 2; i++) {
                    if (i < uHandCount) {
                        float influence = getHandInfluence(vUv, uHandPositions[i], 200.0);
                        enhancement += influence * 0.5;
                    }
                }
                
                // Enhance colors with prismatic effect
                vec3 prismColor = vec3(
                    sin(uTime + videoUv.x * 10.0) * 0.5 + 0.5,
                    sin(uTime + videoUv.y * 10.0 + 2.0) * 0.5 + 0.5,
                    sin(uTime + (videoUv.x + videoUv.y) * 5.0 + 4.0) * 0.5 + 0.5
                ) * 0.3;
                
                vec3 finalColor = mix(videoColor.rgb, videoColor.rgb + prismColor, enhancement);
                finalColor = max(finalColor, trailColor.rgb);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
    }

    getUniforms() {
        return {
            ...super.getUniforms(),
            uSegments: { value: this.parameters.segments },
            uRotation: { value: this.parameters.rotation },
            uZoom: { value: this.parameters.zoom }
        };
    }

    getControls() {
        return [
            {
                id: 'segments',
                label: 'SEGMENTS',
                min: 3.0,
                max: 16.0,
                step: 1.0,
                value: this.parameters.segments
            },
            {
                id: 'rotation',
                label: 'ROTATION',
                min: 0.0,
                max: 2.0,
                step: 0.1,
                value: this.parameters.rotation
            },
            {
                id: 'zoom',
                label: 'ZOOM',
                min: 0.5,
                max: 3.0,
                step: 0.1,
                value: this.parameters.zoom
            }
        ];
    }

    updateParameter(paramId, value, material) {
        this.parameters[paramId] = value;
        
        switch (paramId) {
            case 'segments':
                material.uniforms.uSegments.value = value;
                break;
            case 'rotation':
                material.uniforms.uRotation.value = value;
                break;
            case 'zoom':
                material.uniforms.uZoom.value = value;
                break;
        }
    }
}