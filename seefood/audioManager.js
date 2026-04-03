// Basic Web Audio API Sound Manager
export class AudioManager {
    constructor() {
        // Use '||' for broader browser compatibility, though 'webkit' is largely legacy
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = null;
        this.isInitialized = false;
        
        if (AudioContext) {
            try {
                this.audioCtx = new AudioContext();
                this.isInitialized = true;
                console.log("AudioContext created successfully.");
            } catch (e) {
                console.error("Error creating AudioContext:", e);
            }
        } else {
            console.warn("Web Audio API is not supported in this browser.");
        }
    }
}