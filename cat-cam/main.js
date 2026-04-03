class AudioManager {
    constructor() {
        this.isEnabled = true;
        this.isInitialized = false;
        this.beepSynth = null;
        this.shutterAudio = null;
        this.shutterBuffer = null;
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Create countdown beep synth - crisp, satisfying beep
            this.beepSynth = new Tone.Synth({
                oscillator: { type: "sine" },
                envelope: {
                    attack: 0.01,
                    decay: 0.1,
                    sustain: 0.3,
                    release: 0.2
                }
            }).toDestination();

            // Load shutter sound file
            await this.loadShutterSound();

            this.isInitialized = true;
        } catch (error) {
            console.warn('Audio initialization failed:', error);
        }
    }

    async loadShutterSound() {
        try {
            // Create Tone.js Player for the MP3 file
            this.shutterAudio = new Tone.Player({
                url: "assets/shutter.mp3",
                volume: 0, // 0dB = normal volume, adjust as needed
                fadeIn: 0,
                fadeOut: 0.1
            }).toDestination();

            // Wait for the audio to load
            await Tone.loaded();
            
            console.log('Shutter sound loaded successfully');
        } catch (error) {
            console.warn('Failed to load shutter sound:', error);
            
            // Fallback: create a simple audio element
            this.shutterAudio = new Audio('assets/shutter.mp3');
            this.shutterAudio.preload = 'auto';
            this.shutterAudio.volume = 0.8;
            
            // Wait for the audio to be ready
            return new Promise((resolve, reject) => {
                this.shutterAudio.addEventListener('canplaythrough', resolve);
                this.shutterAudio.addEventListener('error', reject);
            });
        }
    }

    async enable() {
        if (!this.isInitialized) {
            await this.init();
        }
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    async playCountdownBeep() {
        if (!this.isEnabled || !this.isInitialized) return;
        
        try {
            await this.enable();
            // Nice satisfying beep at 800Hz
            this.beepSynth.triggerAttackRelease("800", "0.15");
        } catch (error) {
            console.warn('Countdown beep failed:', error);
        }
    }

    async playCameraShutter() {
        if (!this.isEnabled || !this.isInitialized) return;
        
        try {
            await this.enable();
            
            if (this.shutterAudio) {
                // Check if it's a Tone.js Player or HTML Audio element
                if (this.shutterAudio.start) {
                    // Tone.js Player
                    this.shutterAudio.start();
                } else {
                    // HTML Audio element
                    this.shutterAudio.currentTime = 0; // Reset to beginning
                    const playPromise = this.shutterAudio.play();
                    
                    // Handle play promise for better browser compatibility
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            console.warn('Audio play failed:', error);
                        });
                    }
                }
            }
            
        } catch (error) {
            console.warn('Camera shutter sound failed:', error);
        }
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }
}

class CatPhotobooth {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        this.countdown = document.getElementById('countdown');
        this.photoCountBadge = document.getElementById('photoCountBadge');
        this.photoPhase = document.getElementById('photoPhase');
        this.carouselPhase = document.getElementById('carouselPhase');
        this.currentImage = document.getElementById('currentImage');
        this.photoCounter = document.getElementById('photoCounter');
        this.carouselControls = document.getElementById('carouselControls');
        this.noPhotos = document.getElementById('noPhotos');
        this.thumbnailStrip = document.getElementById('thumbnailStrip');
        this.audioControl = document.getElementById('audioControl');
        this.hatOverlay = document.getElementById('hatOverlay');
        this.hatToggle = document.getElementById('hatToggle');
        this.cameraToggle = document.getElementById('cameraToggle');
        this.catRequiredText = 'CAT REQUIRED ₍^..^₎⟆';
        this.model = null;
        this.isDetecting = false;
        this.countdownTimer = null;
        this.photos = [];
        this.currentPhotoIndex = 0;
        this.isCountdownActive = false;
        this.hatEnabled = true;
        this.hatImage = new Image();
        this.hatLoaded = false;
        this.detectionAnimationFrame = null;
        this.currentFacingMode = 'user'; // Track current camera mode
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);

        // Improved tracking variables from banana detection
        this.trackedObjects = {};
        this.objectMemory = 10; // How many frames to keep an object in memory after it disappears
        this.minConfidence = 0.35; // Minimum confidence threshold
        this.smoothingFactor = 0.3; // How quickly to adapt to new positions (0.1 = slow, 0.9 = fast)
        this.frameCount = 0;
        
        // Initialize audio manager
        this.audioManager = new AudioManager();
        
        this.init();
        this.setupEvents();
        this.loadHatImage();
    }

    loadHatImage() {
        this.hatImage.onload = () => {
            this.hatLoaded = true;
            console.log('Hat image loaded successfully');
        };
        this.hatImage.onerror = () => {
            console.warn('Failed to load hat image');
            this.hatLoaded = false;
        };
        this.hatImage.src = 'assets/hat2.png';
    }

    updateVideoMirroring() {
        // Only mirror when using front-facing camera (user mode)
        if (this.currentFacingMode === 'user') {
            this.video.classList.add('mirrored');
        } else {
            this.video.classList.remove('mirrored');
        }
    }

    setupEvents() {
        this.photoCountBadge.onclick = () => this.showCarousel();
        document.getElementById('backToPhotoBtn').onclick = () => this.showPhotoMode();
        document.getElementById('prevBtn').onclick = () => this.showPhoto(this.currentPhotoIndex - 1);
        document.getElementById('nextBtn').onclick = () => this.showPhoto(this.currentPhotoIndex + 1);
        document.getElementById('downloadBtn').onclick = () => this.downloadPhoto();
        
        // Audio control toggle
        this.audioControl.onclick = async () => {
            const isEnabled = this.audioManager.toggle();
            this.audioControl.textContent = isEnabled ? 'SOUND ON' : 'SOUND OFF';
            
            // Play a test beep when enabling
            if (isEnabled) {
                await this.audioManager.playCountdownBeep();
            }
        };

        // Hat toggle
        this.hatToggle.onclick = () => {
            this.hatEnabled = !this.hatEnabled;
            this.hatToggle.textContent = this.hatEnabled ? 'HAT ON' : 'HAT OFF';
            this.hatToggle.classList.toggle('active', this.hatEnabled);
            if (!this.hatEnabled) {
                this.hatOverlay.style.display = 'none';
            }
        };

        // Camera toggle (mobile only)
        this.cameraToggle.onclick = async () => {
            await this.switchCamera();
        };
    }

    async init() {
        try {
            this.status.textContent = 'CAT DETECTION RADAR INCOMING...';
            this.model = await cocoSsd.load();
            this.status.textContent = this.catRequiredText;
            await this.setupCamera();
            
            // Initialize audio on first user interaction
            await this.audioManager.init();
            
            document.getElementById('loading').style.display = 'none';
            this.showPhotoMode();
            this.startDetection();
        } catch (error) {
            console.error('Init failed:', error);
            this.status.textContent = 'FAILED TO INITIALIZE';
        }
    }

    async setupCamera(facingMode = 'user') {
        // Stop any existing stream
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: facingMode }
        });
        this.video.srcObject = stream;
        this.updateVideoMirroring();
        return new Promise(resolve => this.video.onloadedmetadata = resolve);
    }

    async switchCamera() {
        try {
            // Toggle between 'user' (front) and 'environment' (back) camera
            this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
            
            // Update button text to reflect current state
            const cameraType = this.currentFacingMode === 'user' ? 'FRONT' : 'BACK';
            
            // Temporarily stop detection during camera switch
            const wasDetecting = this.isDetecting;
            this.isDetecting = false;
            
            // Clear any ongoing countdown
            this.resetCountdown();
            
            // Setup new camera
            await this.setupCamera(this.currentFacingMode);
            this.updateVideoMirroring();

            // Resume detection
            if (wasDetecting) {
                this.isDetecting = true;
                this.startDetection();
            }
            
        } catch (error) {
            console.error('Camera switch failed:', error);
            // Revert to previous setting if switch fails
            this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
            const cameraType = this.currentFacingMode === 'user' ? 'FRONT' : 'BACK';
        }
    }

    showPhotoMode() {
        this.photoPhase.style.display = 'block';
        this.carouselPhase.classList.remove('active');
        this.updatePhotoCountBadge();
        
        // Show photo mode buttons, hide carousel mode buttons
        document.querySelectorAll('.photo-mode-only').forEach(btn => btn.style.display = 'block');
        document.querySelectorAll('.carousel-mode-only').forEach(btn => btn.style.display = 'none');
    }

    showCarousel() {
        this.photoPhase.style.display = 'none';
        this.carouselPhase.classList.add('active');
        this.updateCarousel();
        
        // Hide photo mode buttons, show carousel mode buttons
        document.querySelectorAll('.photo-mode-only').forEach(btn => btn.style.display = 'none');
        document.querySelectorAll('.carousel-mode-only').forEach(btn => btn.style.display = 'block');            
    }

    updatePhotoCountBadge() {
        this.photoCountBadge.textContent = `VIEW PHOTOS (${this.photos.length})`;
        this.photoCountBadge.classList.toggle('visible', this.photos.length > 0);
    }

    updateCarousel() {
        const hasPhotos = this.photos.length > 0;
        this.noPhotos.style.display = hasPhotos ? 'none' : 'block';
        this.currentImage.style.display = hasPhotos ? 'block' : 'none';
        this.thumbnailStrip.style.display = hasPhotos ? 'flex' : 'none';
        this.carouselControls.style.display = 'flex';
        document.getElementById('downloadBtn').style.display = 'block';

        // Show/hide download button based on photos availability
        if(this.isMobile || !hasPhotos){
            this.carouselControls.style.display = 'none';
        }
        
        if (hasPhotos) {
            this.currentPhotoIndex = Math.min(this.currentPhotoIndex, this.photos.length - 1);
            this.showPhoto(this.currentPhotoIndex);
            this.updateThumbnails();
        }
    }

    showPhoto(index) {
        if (index < 0 || index >= this.photos.length) return;
        this.currentPhotoIndex = index;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const photo = this.photos[index];
        canvas.width = photo.width;
        canvas.height = photo.height;
        ctx.putImageData(photo, 0, 0);

        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.className = 'carousel-image active';

        const viewer = document.querySelector('.photo-viewer .media-container');
        viewer.innerHTML = ''; // clear old content
        viewer.appendChild(img);

        this.photoCounter.textContent = `${index + 1} / ${this.photos.length}`;
        this.updateNavigation();
    }

    updateNavigation() {
        document.getElementById('prevBtn').disabled = this.currentPhotoIndex === 0;
        document.getElementById('nextBtn').disabled = this.currentPhotoIndex === this.photos.length - 1;
        document.querySelectorAll('.thumbnail').forEach((thumb, i) => 
            thumb.classList.toggle('active', i === this.currentPhotoIndex)
        );
    }

    updateThumbnails() {
        this.thumbnailStrip.innerHTML = '';
        this.photos.forEach((photo, index) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 120; canvas.height = 90; canvas.className = 'thumbnail';
            
            const aspectRatio = photo.width / photo.height;
            const thumbAspect = 120 / 90;
            let drawWidth, drawHeight, drawX, drawY;
            
            if (aspectRatio > thumbAspect) {
                drawHeight = 90; drawWidth = drawHeight * aspectRatio;
                drawX = (120 - drawWidth) / 2; drawY = 0;
            } else {
                drawWidth = 120; drawHeight = drawWidth / aspectRatio;
                drawX = 0; drawY = (90 - drawHeight) / 2;
            }
            
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = photo.width; tempCanvas.height = photo.height;
            tempCtx.putImageData(photo, 0, 0);
            
            ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 120, 90);
            ctx.drawImage(tempCanvas, drawX, drawY, drawWidth, drawHeight);
            
            canvas.onclick = () => this.showPhoto(index);
            if (index === this.currentPhotoIndex) canvas.classList.add('active');
            this.thumbnailStrip.appendChild(canvas);
        });
    }

    downloadPhoto() {
        if (!this.photos.length) return;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const photo = this.photos[this.currentPhotoIndex];
        canvas.width = photo.width; canvas.height = photo.height;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.putImageData(photo, 0, 0);
        
        const link = document.createElement('a');
        link.download = `cat-photo-${this.currentPhotoIndex + 1}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    }

    async detectObjects() {
        if (!this.model || !this.video.videoWidth || !this.video.videoHeight) 
            return [];
        
        try {
            const predictions = await this.model.detect(this.video);
            return predictions.filter(p => p.score > this.minConfidence)
                .map(p => ({ class: p.class, score: p.score, bbox: p.bbox }));
        } catch (error) {
            console.error('Detection error:', error);
            return [];
        }
    }

    updateTrackedObjects(predictions) {
        this.frameCount++;
        
        // Mark all currently tracked objects as not detected in this frame
        Object.values(this.trackedObjects).forEach(obj => {
            obj.framesSinceDetected++;
        });
        
        // Process new predictions
        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const label = prediction.class;
            
            // Calculate center of new detection
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            
            // Check if this object matches an existing tracked object
            let matched = false;
            
            for (const id in this.trackedObjects) {
                const trackedObj = this.trackedObjects[id];
                
                // Only try to match with same class
                if (trackedObj.class !== label) continue;
                
                // Calculate the center of the tracked object
                const trackedCenterX = trackedObj.x + trackedObj.width / 2;
                const trackedCenterY = trackedObj.y + trackedObj.height / 2;
                
                // Calculate distance between centers
                const distance = Math.sqrt(
                    Math.pow(centerX - trackedCenterX, 2) + 
                    Math.pow(centerY - trackedCenterY, 2)
                );
                
                // If the distance is small enough, consider it the same object
                const maxSize = Math.max(width, height, trackedObj.width, trackedObj.height);
                if (distance < maxSize * 0.5) {
                    // This is the same object, update it
                    this.updateTrackedObject(trackedObj, prediction);
                    matched = true;
                    break;
                }
            }
            
            // If no match was found, create a new tracked object
            if (!matched) {
                const newId = label + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                this.trackedObjects[newId] = {
                    id: newId,
                    class: label,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    score: prediction.score,
                    framesSinceDetected: 0,
                    isVisible: true,
                    // Initialize smoothed values to the current values
                    smoothX: x,
                    smoothY: y,
                    smoothWidth: width,
                    smoothHeight: height
                };
            }
        });
        
        // Clean up objects that haven't been detected for a while
        Object.keys(this.trackedObjects).forEach(id => {
            const obj = this.trackedObjects[id];
            
            // Mark objects as invisible after not being detected for a few frames
            if (obj.framesSinceDetected > 3) {
                obj.isVisible = false;
            }
            
            // Remove objects that haven't been detected for too long
            if (obj.framesSinceDetected > this.objectMemory) {
                delete this.trackedObjects[id];
            }
        });
    }

    // Function to update a tracked object with new detection data
    updateTrackedObject(trackedObj, prediction) {
        const [x, y, width, height] = prediction.bbox;
        
        // Reset the counter since we've detected it again
        trackedObj.framesSinceDetected = 0;
        trackedObj.isVisible = true;
        
        // Update score to the latest
        trackedObj.score = prediction.score;
        
        // Update the raw position
        trackedObj.x = x;
        trackedObj.y = y;
        trackedObj.width = width;
        trackedObj.height = height;
        
        // Apply smoothing to the position and size
        trackedObj.smoothX = trackedObj.smoothX * (1 - this.smoothingFactor) + x * this.smoothingFactor;
        trackedObj.smoothY = trackedObj.smoothY * (1 - this.smoothingFactor) + y * this.smoothingFactor;
        trackedObj.smoothWidth = trackedObj.smoothWidth * (1 - this.smoothingFactor) + width * this.smoothingFactor;
        trackedObj.smoothHeight = trackedObj.smoothHeight * (1 - this.smoothingFactor) + height * this.smoothingFactor;
    }

    getVisibleCats() {
        return Object.values(this.trackedObjects).filter(obj => 
            obj.class === 'cat' || obj.class === 'dog' && 
            obj.isVisible
        );
    }

    updateHatPosition(catDetections) {
        if (!this.hatEnabled || !this.hatLoaded || catDetections.length === 0) {
            this.hatOverlay.style.display = 'none';
            return;
        }

        // Use the first (most confident) cat detection - use smoothed values
        const cat = catDetections[0];
        const x = cat.smoothX;
        const y = cat.smoothY;
        const width = cat.smoothWidth;
        const height = cat.smoothHeight;

        // Calculate scale factors for overlay positioning
        const scaleX = this.video.offsetWidth / this.video.videoWidth;
        const scaleY = this.video.offsetHeight / this.video.videoHeight;

        // Mirror X coordinate for front-facing camera
        const mirroredX = this.currentFacingMode === 'user' ? 
            (this.video.videoWidth - x - width) * scaleX : 
            x * scaleX;

        // Estimate head position (top 30% of the cat detection box)
        const headCenterX = mirroredX + (width * scaleX) / 2;
        const headTop = y * scaleY;

        // Hat sizing based on cat width
        let hatWidth;
        if(this.isMobile){
            hatWidth = Math.min(50, width * scaleX * 0.5);
        } else {
            hatWidth = Math.min(200, width * scaleX * 0.5);
        }
        const hatHeight = hatWidth * 1;

        // Position hat above the head
        const hatX = headCenterX - hatWidth / 2;
        const hatY = headTop - hatHeight * 0.3; // Position hat above head

        // Update hat overlay
        this.hatOverlay.style.display = 'block';
        this.hatOverlay.style.left = `${hatX}px`;
        this.hatOverlay.style.top = `${hatY}px`;
        this.hatOverlay.style.width = `${hatWidth}px`;
        this.hatOverlay.style.height = `${hatHeight}px`;
    }

    drawDetections(trackedObjects) {
        document.querySelectorAll('.detection-box').forEach(box => box.remove());
        const overlay = document.querySelector('.overlay');
        if (!overlay) return;

        // Display only visible objects using smoothed values
        Object.values(trackedObjects).forEach(obj => {
            if (!obj.isVisible) return;
            
            // Use the smoothed values for rendering
            const x = obj.smoothX;
            const y = obj.smoothY;
            const width = obj.smoothWidth;
            const height = obj.smoothHeight;
            
            const scaleX = this.video.offsetWidth / this.video.videoWidth;
            const scaleY = this.video.offsetHeight / this.video.videoHeight;
            const mirroredX = this.currentFacingMode === 'user' ? 
                (this.video.videoWidth - x - width) * scaleX : 
                x * scaleX;

            const box = document.createElement('div');
            const label = document.createElement('div');

            if(obj.class === 'cat' || obj.class === 'dog'){
                box.className = `detection-box cat`;
                label.className = `detection-label cat`;
            } else {
                box.className = `detection-box`;
                label.className = `detection-label`;
            }
            box.style.cssText = `left:${mirroredX}px;top:${y*scaleY}px;width:${width*scaleX}px;height:${height*scaleY}px`;
            label.textContent = `${obj.class.toUpperCase()} ${Math.round(obj.score * 100)}%`;
            
            box.appendChild(label);
            overlay.appendChild(box);
        });
    }

    startCountdown() {
        // Prevent multiple countdowns from starting
        if (this.isCountdownActive) return;
        
        this.isCountdownActive = true;
        let countdownValue = 3;
        this.countdown.textContent = countdownValue;
        this.countdown.classList.add('active');
        this.status.textContent = 'CAT DETECTED ᓚᘏᗢ';

        // Play initial beep for countdown start
        this.audioManager.playCountdownBeep();

        this.countdownTimer = setInterval(() => {
            countdownValue--;
            if (countdownValue > 0) {
                this.countdown.textContent = countdownValue;
                // Play beep for each countdown number
                this.audioManager.playCountdownBeep();
            } else {
                // Add fade out animation before taking photo
                this.countdown.classList.add('fade-out');
                setTimeout(() => {
                    this.takePhoto();
                    this.resetCountdown();
                }, 300); // Wait for fade out to complete
            }
        }, 1000);

    }

    resetCountdown() {
        if (this.countdownTimer) { 
            clearInterval(this.countdownTimer); 
            this.countdownTimer = null; 
        }
        this.isCountdownActive = false;
        this.countdown.classList.remove('active', 'fade-out');
        this.countdown.textContent = '';
        this.status.textContent = this.catRequiredText;
    }

    takePhoto() {
        // Play camera shutter sound from MP3 file
        this.audioManager.playCameraShutter();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.video.videoWidth; 
        canvas.height = this.video.videoHeight;
        ctx.imageSmoothingEnabled = true; 
        ctx.imageSmoothingQuality = 'high';
        
        // Draw video (mirror only if front-facing camera)
        if (this.currentFacingMode === 'user') {
            ctx.scale(-1, 1);
            ctx.drawImage(this.video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.scale(-1, 1);
        } else {
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        }
                        
        // Draw hat if enabled and visible
        if (this.hatEnabled && this.hatLoaded && this.hatOverlay.style.display !== 'none') {
            const hatStyle = this.hatOverlay.style;
            
            // Calculate hat position and size relative to video dimensions
            const scaleX = canvas.width / this.video.offsetWidth;
            const scaleY = canvas.height / this.video.offsetHeight;
            
            const hatX = parseFloat(hatStyle.left) * scaleX;
            const hatY = parseFloat(hatStyle.top) * scaleY;
            const hatWidth = parseFloat(hatStyle.width) * scaleX;
            const hatHeight = parseFloat(hatStyle.height) * scaleY;
            
            // Draw hat on canvas (no need to mirror since video is already mirrored)
            ctx.drawImage(this.hatImage, hatX, hatY, hatWidth, hatHeight);
        }
        
        // Add timestamp
        const fontSize = Math.max(24, Math.floor(canvas.width / 50));
        ctx.font = `bold ${fontSize}px Courier New`;
        ctx.fillStyle = 'white'; 
        ctx.strokeStyle = 'black'; 
        ctx.lineWidth = Math.max(3, Math.floor(fontSize / 8));
        const timestamp = new Date().toLocaleString();
        const textX = Math.floor(canvas.width * 0.03);
        const textY = canvas.height - Math.floor(canvas.height * 0.03);
        ctx.strokeText(timestamp, textX, textY);
        ctx.fillText(timestamp, textX, textY);
        
        this.photos.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        this.updatePhotoCountBadge();
        
        this.video.style.filter = 'brightness(4)';
        setTimeout(() => this.video.style.filter = 'none', 200);
        
        this.status.textContent = `PHOTO TAKEN! (${this.photos.length} total)`;
        setTimeout(() => this.status.textContent = this.catRequiredText, 1500);
    }

    async startDetection() {
        this.isDetecting = true;
        const detect = async () => {
            if (!this.isDetecting) return;
            
            try {
                // Check if video element exists and is ready
                if (!this.video || this.video.readyState < 2) {
                    // Video not ready yet, wait and try again
                    this.detectionAnimationFrame = requestAnimationFrame(detect);
                    return;
                }
                
                // Verify we have a valid video source with dimensions
                if (!this.video.srcObject || this.video.videoWidth === 0) {
                    this.detectionAnimationFrame = requestAnimationFrame(detect);
                    return;
                }
                
                // Detect objects in the current video frame
                const predictions = await this.detectObjects();
                
                // Update tracked objects with new predictions
                this.updateTrackedObjects(predictions);
                
                // Get visible cats using the improved tracking
                const visibleCats = this.getVisibleCats();
                
                // Draw all tracked objects
                this.drawDetections(this.trackedObjects);
                
                // Update hat position using smoothed cat detections
                this.updateHatPosition(visibleCats);
                
                // Simplified logic: only start countdown if cat is detected and countdown is not already active
                if (visibleCats.length > 0 && !this.isCountdownActive) {
                    this.startCountdown();
                }
                
            } catch (error) {
                console.error('Detection loop error:', error);
            }
            
            // Use a shorter timeout for smoother detection
            setTimeout(() => {
                if (this.isDetecting) {
                    this.detectionAnimationFrame = requestAnimationFrame(detect);
                }
            }, 33); // ~30 FPS
        };
        detect();
    }
}

window.addEventListener('load', () => new CatPhotobooth());