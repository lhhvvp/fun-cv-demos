import * as THREE from 'three';
import { GAME_AREA_LENGTH, LANE_WIDTH } from './constants.js'; // Ensure LANE_WIDTH is imported here

export class SceneSetup {
    constructor(renderDiv) {
        this.renderDiv = renderDiv;
        
        // Scene
        this.scene = new THREE.Scene();
        // Scene background is now transparent by default (no color set)
        // Fog is removed
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, this.renderDiv.clientWidth / this.renderDiv.clientHeight, 0.1, 100);
        this.resetCamera();
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        this.renderer.setSize(this.renderDiv.clientWidth, this.renderDiv.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0); // Set clear color to black with 0 alpha (transparent)
        this.renderDiv.appendChild(this.renderer.domElement);
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0);
        this.scene.add(ambientLight);
        
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 3.0); // Increased intensity from 3.0
        this.directionalLight.position.set(0, 6, -7); // Keep initial position for now
        this.scene.add(this.directionalLight);
        
        // Add the light's target object to the scene so it can be updated
        this.scene.add(this.directionalLight.target);
        
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(8, GAME_AREA_LENGTH * 1.5, 32, 32); // Size it relative to game area
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1C1B47,
            roughness: 0.5,
            metalness: 0.5,
            transparent: true,
            opacity: 0.90
        });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2; // Rotate to be flat
        this.floor.position.y = 0; // Position it below the player/lava level
        this.floor.position.z = -(GAME_AREA_LENGTH * 1.5) / 2 + 10; // Center it along the Z axis, adjust offset as needed
        this.scene.add(this.floor);
        
        // Lane Markers
        this._createLaneMarkers();
    }

    _createLaneMarkers() {
        const markerHeight = 0.05; // Slightly above water
        const markerWidth = 0.1;
        const markerLength = GAME_AREA_LENGTH * 1.5; // Match water floor length
        
        const markerGeometry = new THREE.BoxGeometry(markerWidth, markerHeight, markerLength);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x111111,
            emissive: 0x111111,
            emissiveIntensity: 0.3 // Slightly reduce intensity for white
        });
        
        const laneBoundaries = [
            -LANE_WIDTH * 1.5,
            -LANE_WIDTH * 0.5,
            LANE_WIDTH * 0.5,
            LANE_WIDTH * 1.5 // Right edge of right lane
        ];
        
        laneBoundaries.forEach(xPos => {
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(
                xPos,
                this.floor.position.y + markerHeight / 2 + 0.01,
                this.floor.position.z // Align with water floor center Z
            );
            this.scene.add(marker);
            // We don't store these markers explicitly as they are static scene elements
        });
    }

    resetCamera() {
        // Increased Y position significantly and moved Z back slightly
        this.camera.position.set(0, 6.5, 10); // Higher Y, slightly further back Z
        this.camera.lookAt(0, 6.5, 0); // Look slightly further down the path
    }

    setGameOverBackground() {
        // No scene background or fog to change anymore
    }

    resetAppearance() {
        // No scene background or fog to reset anymore
    }

    updateSize() {
        this.camera.aspect = this.renderDiv.clientWidth / this.renderDiv.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.renderDiv.clientWidth, this.renderDiv.clientHeight);
    }
}