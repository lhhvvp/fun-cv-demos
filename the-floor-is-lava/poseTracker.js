import { PoseLandmarker, FilesetResolver } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.14';

export class PoseTracker {
    constructor(videoElement, onPoseUpdateCallback) {
        this.videoElement = videoElement;
        this.onPoseUpdateCallback = onPoseUpdateCallback;
        this.poseLandmarker = null;
        this.lastVideoTime = -1;
        this.runningMode = "VIDEO";
        this.webcamRunning = false;
        this._predictWebcam = this._predictWebcam.bind(this);
    }

    async initialize() {
        console.log("Initializing PoseTracker...");
        
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );
            
            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                    delegate: "GPU" // Use GPU if available
                },
                runningMode: this.runningMode,
                numPoses: 1 // Only detect one person
            });
            
            console.log("PoseLandmarker created successfully.");
            await this.enableCam();
        } catch (error) {
            console.error("Failed to initialize PoseLandmarker:", error);
            throw new Error("Could not initialize pose detection. Check console for details.");
        }
    }

    async enableCam() {
        if (!this.poseLandmarker) {
            console.log("Wait! poseLandmarker not loaded yet.");
            return;
        }
        
        if (this.webcamRunning) {
            console.log("Webcam already running.");
            return;
        }
        
        console.log("Attempting to access webcam...");
        
        const constraints = {
            video: {
                width: 640,
                height: 480
            }
        };
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = stream;
            this.videoElement.addEventListener("loadeddata", this._predictWebcam);
            this.webcamRunning = true;
            console.log("Webcam access granted and stream started.");
        } catch (err) {
            console.error("getUserMedia error:", err);
            throw new Error("Webcam access denied or failed. Please allow camera access.");
        }
    }

    _predictWebcam() {
        if (!this.webcamRunning) return;
        
        const startTimeMs = performance.now();
        
        if (this.lastVideoTime !== this.videoElement.currentTime) {
            this.lastVideoTime = this.videoElement.currentTime;
            
            this.poseLandmarker.detectForVideo(this.videoElement, startTimeMs, (result) => {
                if (result.landmarks && result.landmarks.length > 0) {
                    const landmarks = result.landmarks[0];
                    
                    // Hip landmarks for horizontal movement
                    const leftHip = landmarks[23];
                    const rightHip = landmarks[24];
                    
                    // Shoulder landmarks for vertical movement (potential jump)
                    const leftShoulder = landmarks[11];
                    const rightShoulder = landmarks[12];
                    
                    let midHipX = 0.5; // Default to center
                    let midShoulderY = 0.5; // Default to center
                    
                    if (leftHip && rightHip) {
                        midHipX = (leftHip.x + rightHip.x) / 2;
                    }
                    
                    if (leftShoulder && rightShoulder) {
                        // Normalized Y: 0 is top, 1 is bottom of frame
                        midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
                    }
                    
                    // Pass both horizontal and vertical metrics
                    this.onPoseUpdateCallback(midHipX, midShoulderY);
                }
            });
        }
        
        // Call this function again to keep predicting when the browser is ready
        window.requestAnimationFrame(this._predictWebcam);
    }

    stop() {
        if (this.webcamRunning) {
            console.log("Stopping webcam stream.");
            this.webcamRunning = false;
            
            const stream = this.videoElement.srcObject;
            if (stream) {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
                this.videoElement.srcObject = null;
            }
            
            this.videoElement.removeEventListener("loadeddata", this._predictWebcam);
        }
        
        if (this.poseLandmarker) {
            console.log("PoseLandmarker resources will be garbage collected.");
            this.poseLandmarker = null;
        }
    }
}