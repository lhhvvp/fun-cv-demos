export class SpeechManager {
    constructor(onTranscript) {
        this.onTranscript = onTranscript;
        this.recognition = null;
        this.isRecognizing = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true; // Keep listening even after a pause
            this.recognition.interimResults = true; // Get results while speaking
            
            this.recognition.onstart = () => {
                this.isRecognizing = true;
                console.log('Speech recognition started.');
            };
            
            this.recognition.onresult = (event) => {
                this.interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        // Append to finalTranscript and then clear it for the next utterance
                        // This way, `finalTranscript` holds the *current complete* utterance.
                        this.finalTranscript += event.results[i][0].transcript;
                        if (this.onTranscript) {
                            this.onTranscript(this.finalTranscript, ''); // Send final, clear interim
                        }
                        this.finalTranscript = ''; // Reset for the next full utterance
                    } else {
                        this.interimTranscript += event.results[i][0].transcript;
                    }
                    this.onTranscript(null, this.interimTranscript); // Send only interim
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecognizing = false;
                this.finalTranscript = ''; // Clear transcript on error
                this.interimTranscript = '';
                if (this.onTranscript) this.onTranscript('', ''); // Clear display
                
                // Automatically restart if it's an 'aborted' or 'no-speech' error
                if (event.error === 'aborted' || event.error === 'no-speech') {
                    console.log('Restarting speech recognition due to inactivity or abort.');
                    // Don't call startRecognition directly, let onend handle it if continuous
                }
            };
            
            this.recognition.onend = () => {
                this.isRecognizing = false;
                console.log('Speech recognition ended.');
                this.finalTranscript = ''; // Clear transcript on end
                this.interimTranscript = '';
                if (this.onTranscript) this.onTranscript('', ''); // Clear display
                
                // If it ended and continuous is true, restart it.
                // This handles cases where the browser might stop it.
                if (this.recognition.continuous) {
                    console.log('Continuous mode: Restarting speech recognition.');
                    this.startRecognition(); // startRecognition already resets transcripts
                }
            };
        } else {
            console.warn('Web Speech API is not supported in this browser.');
        }
    }
    
    startRecognition() {
        if (this.recognition && !this.isRecognizing) {
            try {
                this.finalTranscript = ''; // Reset transcript
                this.interimTranscript = '';
                this.recognition.start();
            } catch (e) {
                console.error("Error starting speech recognition:", e);
                // This can happen if it's already started or due to permissions
                if (e.name === 'InvalidStateError' && this.isRecognizing) {
                    // Already started, do nothing
                } else {
                    // Attempt to restart if it fails for other reasons (e.g. after an error)
                    setTimeout(() => this.startRecognition(), 500);
                }
            }
        }
    }
    
    stopRecognition() {
        if (this.recognition && this.isRecognizing) {
            this.recognition.stop();
        }
    }
    
    // Call this on user interaction to request microphone permission
    async requestPermissionAndStart() {
        if (!this.recognition) {
            console.log("Speech recognition not supported.");
            return;
        }
        
        try {
            // Attempt to get microphone access (this might prompt the user)
            await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("Microphone permission granted.");
            this.startRecognition();
        } catch (err) {
            console.error("Microphone permission denied or error:", err);
            if (this.onTranscript) {
                this.onTranscript("Microphone access denied. Please allow microphone access in your browser settings.", "");
            }
        }
    }
}