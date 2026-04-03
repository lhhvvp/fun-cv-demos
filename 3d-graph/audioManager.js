// Basic Web Audio API Sound Manager
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
    _create_class(AudioManager, [
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
            // Play a short, rising 'swoop' sound for picking up a ghost
            key: "playPickupSound",
            value: function playPickupSound() {
                if (!this.isInitialized || !this.audioCtx || this.audioCtx.state !== 'running') return;
                var oscillator = this.audioCtx.createOscillator();
                var gainNode = this.audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);
                oscillator.type = 'sine'; // A clean tone for pickup
                oscillator.frequency.setValueAtTime(200, this.audioCtx.currentTime); // Start low
                oscillator.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.1); // Swoop up quickly
                gainNode.gain.setValueAtTime(0.001, this.audioCtx.currentTime); // Start quiet
                gainNode.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 0.02); // Quick rise
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15); // Fade out
                oscillator.start(this.audioCtx.currentTime);
                oscillator.stop(this.audioCtx.currentTime + 0.15);
            }
        },
        {
            // Play a short 'poof' or 'pop' sound for destroying a ghost
            key: "playGhostPoofSound",
            value: function playGhostPoofSound() {
                if (!this.isInitialized || !this.audioCtx || this.audioCtx.state !== 'running') return;
                var oscillator = this.audioCtx.createOscillator();
                var gainNode = this.audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);
                oscillator.type = 'triangle'; // Softer, less harsh than square
                oscillator.frequency.setValueAtTime(600, this.audioCtx.currentTime); // Higher pitch for 'poof'
                oscillator.frequency.exponentialRampToValueAtTime(200, this.audioCtx.currentTime + 0.1); // Quick pitch drop
                gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime); // Start with decent volume
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15); // Quick fade
                oscillator.start(this.audioCtx.currentTime);
                oscillator.stop(this.audioCtx.currentTime + 0.15);
            }
        },
        {
            // Play a descending 'buzz' sound for game over
            key: "playGameOverSound",
            value: function playGameOverSound() {
                var _this = this;
                if (!this.isInitialized || !this.audioCtx || this.audioCtx.state !== 'running') return;
                var now = this.audioCtx.currentTime;
                var attackTime = 0.01; // Quick attack
                var decayTime = 0.15; // Short decay for each note
                var sustainLevel = 0.5; // Sustain level relative to peak
                var releaseTime = 0.3; // Longer release for final note
                var noteDuration = 0.2; // Time between note starts
                var finalNoteHold = 0.5; // How long the last note sustains before release
                // Frequencies for a sad descending minor chord/arpeggio (e.g., C minor: C4, G3, Eb3, C3)
                var frequencies = [
                    261.63,
                    196.00,
                    155.56,
                    130.81
                ]; // C4, G3, Eb3, C3
                frequencies.forEach(function(freq, index) {
                    var startTime = now + index * noteDuration;
                    var oscillator = _this.audioCtx.createOscillator();
                    var gainNode = _this.audioCtx.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(_this.audioCtx.destination);
                    oscillator.type = 'sine'; // Smoother, more melodic tone
                    oscillator.frequency.setValueAtTime(freq, startTime);
                    // Simple ADSR-like envelope for each note
                    var peakVolume = 0.9; // Increased peak volume further (from 0.7)
                    gainNode.gain.setValueAtTime(0, startTime); // Start silent
                    gainNode.gain.linearRampToValueAtTime(peakVolume, startTime + attackTime); // Attack to higher peak
                    gainNode.gain.linearRampToValueAtTime(peakVolume * sustainLevel, startTime + attackTime + decayTime); // Decay to sustain
                    // Release - longer for the last note
                    var stopTime;
                    if (index === frequencies.length - 1) {
                        gainNode.gain.setValueAtTime(peakVolume * sustainLevel, startTime + attackTime + decayTime + finalNoteHold); // Hold last note at adjusted sustain level
                        gainNode.gain.linearRampToValueAtTime(0, startTime + attackTime + decayTime + finalNoteHold + releaseTime); // Long release
                        stopTime = startTime + attackTime + decayTime + finalNoteHold + releaseTime;
                    } else {
                        gainNode.gain.linearRampToValueAtTime(0, startTime + noteDuration); // Faster release for intermediate notes
                        stopTime = startTime + noteDuration + 0.05; // Slightly overlap stop time
                    }
                    oscillator.start(startTime);
                    oscillator.stop(stopTime);
                });
            }
        }
    ]);
    return AudioManager;
}();
