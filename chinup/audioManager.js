// Enhanced Web Audio API Sound Manager for Chin-Up Tracking
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _create_class(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
}
export var AudioManager = /*#__PURE__*/ function() {
    "use strict";
    function AudioManager() {
        _class_call_check(this, AudioManager);
        // Use '||' for broader browser compatibility, though 'webkit' is largely legacy
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = null;
        this.isInitialized = false;
        this.meowSounds = []; // Array to store loaded meow sounds
        this.meowFiles = ['assets/meow1.mp3', 'assets/meow2.mp3', 'assets/meow3.wav'];
        
        if (AudioContext) {
            try {
                this.audioCtx = new AudioContext();
                this.isInitialized = true;
                console.log("AudioContext created successfully.");
                this._loadMeowSounds();
            } catch (e) {
                console.error("Error creating AudioContext:", e);
            }
        } else {
            console.warn("Web Audio API is not supported in this browser.");
        }
    }
    _create_class(AudioManager, [
        {
            // Load meow sound files
            key: "_loadMeowSounds",
            value: async function _loadMeowSounds() {
                if (!this.audioCtx) return;
                
                try {
                    for (let i = 0; i < this.meowFiles.length; i++) {
                        const response = await fetch(this.meowFiles[i]);
                        const arrayBuffer = await response.arrayBuffer();
                        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
                        this.meowSounds.push(audioBuffer);
                        console.log(`Loaded meow sound ${i + 1}: ${this.meowFiles[i]}`);
                    }
                } catch (error) {
                    console.error("Error loading meow sounds:", error);
                    console.log("Falling back to synthetic beep sound");
                }
            }
        },
        {
            // Resume audio context after user interaction (required by many browsers)
            key: "resumeContext",
            value: function resumeContext() {
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().then(function() {
                        console.log("AudioContext resumed successfully.");
                    }).catch(function(e) {
                        return console.error("Error resuming AudioContext:", e);
                    });
                }
            }
        },
        {
            // Play a random meow sound for chin-up start
            key: "playStartBeep",
            value: function playStartBeep() {
                if (!this.audioCtx) return;
                
                // If meow sounds are loaded, play a random one
                if (this.meowSounds.length > 0) {
                    this._playRandomMeow();
                } else {
                    // Fallback to synthetic beep if meow sounds failed to load
                    this._playFallbackBeep();
                }
            }
        },
        {
            // Play a random meow sound
            key: "_playRandomMeow",
            value: function _playRandomMeow() {
                if (!this.audioCtx || this.meowSounds.length === 0) return;
                
                try {
                    // Select a random meow sound
                    const randomIndex = Math.floor(Math.random() * this.meowSounds.length);
                    const selectedMeow = this.meowSounds[randomIndex];
                    
                    // Create buffer source and gain node
                    const source = this.audioCtx.createBufferSource();
                    const gainNode = this.audioCtx.createGain();
                    
                    // Set up the audio graph
                    source.buffer = selectedMeow;
                    source.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);
                    
                    // Set volume (adjust as needed)
                    gainNode.gain.setValueAtTime(0.7, this.audioCtx.currentTime);
                    
                    // Play the sound
                    source.start(this.audioCtx.currentTime);
                    
                    console.log(`Playing meow sound ${randomIndex + 1}`);
                } catch (e) {
                    console.error("Error playing meow sound:", e);
                    // Fallback to synthetic beep
                    this._playFallbackBeep();
                }
            }
        },
        {
            // Fallback synthetic beep (original implementation)
            key: "_playFallbackBeep",
            value: function _playFallbackBeep() {
                if (!this.audioCtx) return;
                
                try {
                    const oscillator = this.audioCtx.createOscillator();
                    const gainNode = this.audioCtx.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);
                    
                    oscillator.frequency.setValueAtTime(400, this.audioCtx.currentTime);
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
                    
                    oscillator.start(this.audioCtx.currentTime);
                    oscillator.stop(this.audioCtx.currentTime + 0.3);
                } catch (e) {
                    console.error("Error playing fallback beep:", e);
                }
            }
        },
        {
            // Play a celebration sound for chin-up completion
            key: "playCelebrationSound",
            value: function playCelebrationSound() {
                if (!this.audioCtx) return;
                
                try {
                    const playTone = (frequency, startTime, duration) => {
                        const oscillator = this.audioCtx.createOscillator();
                        const gainNode = this.audioCtx.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(this.audioCtx.destination);
                        
                        oscillator.frequency.setValueAtTime(frequency, startTime);
                        oscillator.type = 'sine';
                        
                        gainNode.gain.setValueAtTime(0.2, startTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                        
                        oscillator.start(startTime);
                        oscillator.stop(startTime + duration);
                    };
                    
                    // Play a happy ascending melody
                    const currentTime = this.audioCtx.currentTime;
                    playTone(523, currentTime, 0.15);        // C5
                    playTone(659, currentTime + 0.1, 0.15);  // E5
                    playTone(784, currentTime + 0.2, 0.2);   // G5
                } catch (e) {
                    console.error("Error playing celebration sound:", e);
                }
            }
        },
        {
            // Play a countdown beep
            key: "playCountdownBeep",
            value: function playCountdownBeep() {
                if (!this.audioCtx) return;
                
                try {
                    const oscillator = this.audioCtx.createOscillator();
                    const gainNode = this.audioCtx.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);
                    
                    oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
                    oscillator.type = 'square';
                    
                    gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
                    
                    oscillator.start(this.audioCtx.currentTime);
                    oscillator.stop(this.audioCtx.currentTime + 0.1);
                } catch (e) {
                    console.error("Error playing countdown beep:", e);
                }
            }
        }
    ]);
    return AudioManager;
}();