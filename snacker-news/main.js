class SnackerNews {
    constructor() {
        this.articles = [];
        this.currentIndex = 0;
        this.faceLandmarker = null;
        this.recognition = null;
        this.isScrolling = false;
        this.mouthOpenThreshold = 0.1;
        this.lastMouthState = false;
        this.detectionEnabled = false;
        this.smoothingBuffer = [];
        this.isDetecting = false;
        this.lastVideoTime = -1;
        this.currentArticleUrl = null;
        this.articleCache = new Map(); // Cache for pre-fetched articles
        this.prefetchQueue = [];
        this.isPrefetching = false;
        this.isArticleOpen = false; // Track if article viewer is open
        this.isSpeaking = false; // Track if user is currently speaking
        
        this.init();
    }
    
    async init() {
        await this.setupCamera();
        await this.setupFaceDetection();
        this.setupSpeechRecognition();
        await this.loadArticles();
        this.updateInstructionHighlights();
    }
    
    // Update instruction highlights based on current view
    updateInstructionHighlights() {
        const viewer = document.getElementById('articleViewer');
        this.isArticleOpen = viewer.classList.contains('active');
        
        // Remove all highlights first
        document.querySelectorAll('.instruction-item').forEach(el => {
            el.classList.remove('highlight');
        });
        
        if (this.isArticleOpen) {
            // In article view - highlight Back and Open mouth
            document.getElementById('backCmd').classList.add('highlight');
            document.getElementById('mouthCmd').classList.add('highlight');
        } else {
            // In main feed - highlight Open, Next, 1-20
            document.getElementById('openCmd').classList.add('highlight');
            document.getElementById('nextCmd').classList.add('highlight');
            document.getElementById('numbersCmd').classList.add('highlight');
        }
    }
    
    // Update visual feedback for webcam border
    updateWebcamBorder() {
        const borderContainer = document.getElementById('videoBorderContainer');
        if (borderContainer) {
            // Remove all border states first
            borderContainer.classList.remove('mouth-open', 'speech-active');
            
            // Apply appropriate state
            if (this.isSpeaking) {
                borderContainer.classList.add('speech-active');
            } else if (this.lastMouthState) {
                borderContainer.classList.add('mouth-open');
            }
        }
    }
    
    // Camera Setup
    async setupCamera() {
        const video = document.getElementById('videoElement');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: 'user' }
            });
            video.srcObject = stream;
            return new Promise(resolve => video.onloadedmetadata = resolve);
        } catch (error) {
            this.handleCameraError();
        }
    }
    
    handleCameraError() {
        document.querySelector('.webcam-section').innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">🥨</div>
                <h3 style="color: #ff6600;">Welcome to Snacker News</h3>
                <p style="color: #ddd; margin: 20px 0;">This is a hands-free HN browser which uses speech and face detection.</p>
                <p style="color: #ddd; margin: 20px 0;">Camera and microphone access is required. Please allow access.</p>
                <p style="color: #ddd; margin: 20px 0;">Everything is processed client-side, no images or data or stored</p>
                <button onclick="location.reload()" style="background: #ff6600; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Refresh</button>
            </div>
        `;
    }
    
    // Face Detection Setup
    async setupFaceDetection() {
        if (!window.MediaPipeModules) return this.setupFallback();
        
        try {
            const { FaceLandmarker, FilesetResolver } = window.MediaPipeModules;
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            
            this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });
            
            this.detectionEnabled = true;
            this.startFaceDetection();
        } catch (error) {
            console.warn('MediaPipe failed:', error);
            this.setupFallback();
        }
    }
    
    startFaceDetection() {
        const video = document.getElementById('videoElement');
        
        const processFrame = () => {
            if (video.videoWidth > 0 && this.detectionEnabled && !this.isDetecting) {
                const currentTime = performance.now();
                if (currentTime !== this.lastVideoTime) {
                    this.isDetecting = true;
                    this.lastVideoTime = currentTime;
                    
                    try {
                        const results = this.faceLandmarker.detectForVideo(video, currentTime);
                        this.processFaceResults(results);
                    } catch (error) {
                        this.updateMouthStatus(false, 'Detection error');
                    }
                    this.isDetecting = false;
                }
            }
            requestAnimationFrame(processFrame);
        };
        
        setTimeout(() => {
            if (video.videoWidth > 0) {
                processFrame();
            }
        }, 1000);
    }
    
    processFaceResults(results) {
        if (results.faceLandmarks?.[0]) {
            const landmarks = results.faceLandmarks[0];
            this.analyzeMouthOpening(landmarks);
        } else {
            this.updateMouthStatus(false, 'No face detected');
        }
    }
    
    analyzeMouthOpening(landmarks) {
        if (landmarks.length < 468) return;
        
        const [upperLip, lowerLip, leftCorner, rightCorner] = [landmarks[13], landmarks[14], landmarks[61], landmarks[291]];
        
        const mouthHeight = Math.abs(lowerLip.y - upperLip.y);
        const mouthWidth = Math.abs(rightCorner.x - leftCorner.x);
        const mouthAspectRatio = mouthHeight / mouthWidth;
        
        // Smooth values with larger buffer for stability
        this.smoothingBuffer.push(mouthAspectRatio);
        if (this.smoothingBuffer.length > 5) this.smoothingBuffer.shift();
        
        const smoothedMAR = this.smoothingBuffer.reduce((a, b) => a + b, 0) / this.smoothingBuffer.length;
        const isMouthOpen = smoothedMAR > this.mouthOpenThreshold;
        
        this.updateMouthStatus(isMouthOpen, `MAR: ${smoothedMAR.toFixed(3)}`);
        
        // Only scroll if mouth is open AND article is currently open
        if (isMouthOpen && this.isArticleOpen) {
            this.scrollDown();
        }
        this.lastMouthState = isMouthOpen;
    }
    
    setupFallback() {
        let spacePressed = false;
        const handleKey = (e, pressed) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (pressed !== spacePressed) {
                    spacePressed = pressed;
                    this.updateMouthStatus(pressed, pressed ? 'SPACE pressed' : 'SPACE released');
                    // Only scroll if article is open
                    if (pressed && this.isArticleOpen) this.scrollDown();
                }
            }
        };
        
        document.addEventListener('keydown', e => handleKey(e, true));
        document.addEventListener('keyup', e => handleKey(e, false));
        
        // Click video to scroll (only when article is open)
        document.querySelector('.webcam-container')?.addEventListener('click', () => {
            this.updateMouthStatus(true, 'Mouse clicked');
            if (this.isArticleOpen) this.scrollDown();
            setTimeout(() => this.updateMouthStatus(false, 'Click released'), 500);
        });
        
        this.updateMouthStatus(false, 'SPACE key or Click video to scroll');
    }
    
    updateMouthStatus(isOpen, info) {
        this.lastMouthState = isOpen;
        this.updateWebcamBorder();
    }
    
    // Speech Recognition
    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            document.getElementById('speechStatus').textContent = 'Speech not supported';
            return;
        }
        
        this.recognition = new SpeechRecognition();
        Object.assign(this.recognition, {
            continuous: true,
            interimResults: true,
            lang: 'en-US'
        });
        
        this.recognition.onresult = event => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            // Update speaking state based on whether we have interim results (user is actively speaking)
            const wasSpeaking = this.isSpeaking;
            this.isSpeaking = interimTranscript.length > 0;
            
            // Update border if speaking state changed
            if (wasSpeaking !== this.isSpeaking) {
                this.updateWebcamBorder();
            }
            
            if (finalTranscript) {
                this.processVoiceCommand(finalTranscript.toLowerCase().trim());
                // Set speaking to false after processing final transcript
                this.isSpeaking = false;
                this.updateWebcamBorder();
            }
        };
        
        this.recognition.onstart = () => {
            // Reset speaking state when recognition starts
            this.isSpeaking = false;
            this.updateWebcamBorder();
        };
        
        this.recognition.onend = () => {
            // Ensure speaking state is false when recognition ends
            this.isSpeaking = false;
            this.updateWebcamBorder();
            
            setTimeout(() => {
                try { this.recognition.start(); } catch (e) {}
            }, 100);
        };
        
        this.recognition.onerror = event => {
            if (event.error === 'not-allowed') {
                document.getElementById('speechStatus').textContent = 'Microphone access denied';
            }
            // Reset speaking state on error
            this.isSpeaking = false;
            this.updateWebcamBorder();
        };
        
        try {
            this.recognition.start();
            document.getElementById('speechStatus').textContent = 'Listening... Say "Next", or "Open"';
        } catch (error) {
            document.addEventListener('click', () => {
                try { this.recognition.start(); } catch (e) {}
            }, { once: true });
        }
    }
    
    processVoiceCommand(command) {
        const viewer = document.getElementById('articleViewer');
        const isViewerActive = viewer.classList.contains('active');
        
        if (command.includes('back') && isViewerActive) {
            this.closeArticle();
        } else if (command.includes('next')) {
            this.nextArticle();
        } else if (command.includes('up')) {
            this.scrollUp();
        } else if (command.includes('open')) {
            this.readCurrentArticle();
        } else {
            // Check for number commands (1-20)
            const numbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
                            'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
            
            // Check for spoken numbers
            for (let i = 0; i < numbers.length; i++) {
                if (command.includes(numbers[i])) {
                    this.openArticleByNumber(i + 1);
                    return;
                }
            }
            
            // Check for digit numbers
            const digitMatch = command.match(/\b(\d{1,2})\b/);
            if (digitMatch) {
                const number = parseInt(digitMatch[1]);
                if (number >= 1 && number <= 20) {
                    this.openArticleByNumber(number);
                    return;
                }
            }
            
            return; // No recognized command
        }
    }
    
    scrollUp() {
        if (this.isScrolling) return;
        this.isScrolling = true;
        
        const viewer = document.getElementById('articleViewer');
        const isViewerActive = viewer.classList.contains('active');
        
        if (isViewerActive) {
            // Scroll up in the article content
            const content = document.getElementById('articleViewerContent');
            content.scrollBy({
                top: -content.clientHeight * 0.8,
                behavior: 'smooth'
            });
        } else {
            // Scroll up in the news section
            document.getElementById('newsSection').scrollBy({
                top: -document.getElementById('newsSection').clientHeight * 0.8,
                behavior: 'smooth'
            });
        }
        
        setTimeout(() => this.isScrolling = false, 1000);
    }
    
    openArticleByNumber(number) {
        if (number >= 1 && number <= this.articles.length) {
            // Set current index to the requested article
            this.currentIndex = number - 1;
            this.updateCurrentArticle();
            // Open the article immediately
            this.readCurrentArticle();
        }
    }
    
    // Article Management
    async loadArticles() {
        try {
            const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
            const storyIds = await response.json();
            
            const storyPromises = storyIds.slice(0, 20).map(id => 
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.json())
            );
            
            this.articles = await Promise.all(storyPromises);
            this.renderArticles();
            
            // Start pre-fetching articles after rendering
            this.startPrefetching();
        } catch (error) {
            this.showError('Failed to load articles. Please refresh the page.');
        }
    }
    
    startPrefetching() {
        // Add articles with URLs to prefetch queue (prioritize top articles)
        this.prefetchQueue = this.articles
            .map((article, index) => ({ article, index }))
            .filter(item => item.article.url)
            .slice(0, 10); // Prefetch top 10 articles
        
        // Start prefetching in background
        this.prefetchNextArticle();
    }
    
    async prefetchNextArticle() {
        if (this.isPrefetching || this.prefetchQueue.length === 0) return;
        
        this.isPrefetching = true;
        const { article } = this.prefetchQueue.shift();
        
        try {
            console.log(`Pre-fetching: ${article.title}`);
            const content = await this.fetchArticleContentSilent(article.url);
            if (content) {
                this.articleCache.set(article.url, content);
                console.log(`✓ Cached: ${article.title}`);
            }
        } catch (error) {
            console.log(`✗ Failed to cache: ${article.title}`);
        }
        
        this.isPrefetching = false;
        
        // Continue prefetching next article after a short delay
        setTimeout(() => this.prefetchNextArticle(), 1000);
    }
    
    async fetchArticleContentSilent(url) {
        try {
            // Use the same proxy services but silently
            const proxyUrls = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
                `https://corsproxy.io/?${encodeURIComponent(url)}`
            ];
            
            for (const proxyUrl of proxyUrls) {
                try {
                    const response = await fetch(proxyUrl);
                    if (response.ok) {
                        const data = await response.text();
                        let articleContent;
                        
                        if (proxyUrl.includes('allorigins')) {
                            const jsonData = JSON.parse(data);
                            articleContent = jsonData.contents;
                        } else {
                            articleContent = data;
                        }
                        
                        return this.extractReadableContent(articleContent);
                    }
                } catch (e) {
                    continue;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }
    
    renderArticles() {
        document.getElementById('loading').style.display = 'none';
        const container = document.getElementById('articles');
        container.innerHTML = '';
        
        this.articles.forEach((article, index) => {
            const div = document.createElement('div');
            div.className = `article ${index === this.currentIndex ? 'current' : ''}`;
            
            const domain = article.url ? new URL(article.url).hostname.replace('www.', '') : '';
            
            div.innerHTML = `
                <div class="article-header">
                    <div class="article-rank">${index + 1}.</div>
                    <div class="article-vote"></div>
                    <a href="#" class="article-title" onclick="snackerNews.openArticle(${index}); return false;">
                        ${article.title}
                    </a>
                    ${domain ? `<span class="article-url">(${domain})</span>` : ''}
                </div>
                <div class="article-meta">
                    ${article.score} points by ${article.by} ${this.getTimeAgo(article.time)} | 
                    <a href="#" onclick="window.open('https://news.ycombinator.com/item?id=${article.id}', '_blank'); return false;">
                        ${article.descendants || 0} comments
                    </a>
                </div>
            `;
            container.appendChild(div);
        });
    }
    
    getTimeAgo(timestamp) {
        const diff = Math.floor(Date.now() / 1000) - timestamp;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }
    
    nextArticle() {
        if (this.currentIndex < this.articles.length - 1) {
            this.currentIndex++;
            this.updateCurrentArticle();
        }
    }
    
    updateCurrentArticle() {
        document.querySelectorAll('.article').forEach((el, index) => {
            el.classList.toggle('current', index === this.currentIndex);
        });
        
        document.querySelector('.article.current')?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
    
    readCurrentArticle() {
        this.openArticle(this.currentIndex);
    }
    
    openArticle(index) {
        const article = this.articles[index];
        if (!article?.url) return;
        
        this.currentArticleUrl = article.url;
        const viewer = document.getElementById('articleViewer');
        const content = document.getElementById('articleViewerContent');
        const title = document.getElementById('articleViewerTitle');
        const error = document.getElementById('articleViewerError');
        
        title.textContent = article.title;
        error.style.display = 'none';
        viewer.classList.add('active');
        
        // Update article open state and instruction highlights
        this.isArticleOpen = true;
        this.updateInstructionHighlights();
        
        // Force scroll to top of content area
        content.scrollTop = 0;
        
        // Check if article is already cached
        if (this.articleCache.has(article.url)) {
            console.log(`✓ Loading from cache: ${article.title}`);
            content.innerHTML = this.articleCache.get(article.url);
            // Ensure scroll to top after content is set
            setTimeout(() => content.scrollTop = 0, 50);
        } else {
            content.innerHTML = '<div class="article-reader-loading">Loading article...</div>';
            // Fetch article content
            this.fetchArticleContent(article.url);
        }
    }
    
    async fetchArticleContent(url) {
        const content = document.getElementById('articleViewerContent');
        const error = document.getElementById('articleViewerError');
        
        try {
            // Try multiple proxy services that can help bypass CORS
            const proxyUrls = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
                `https://corsproxy.io/?${encodeURIComponent(url)}`,
                `https://proxy.cors.sh/${url}`,
                `https://cors-anywhere.herokuapp.com/${url}`
            ];
            
            let articleContent = null;
            
            for (const proxyUrl of proxyUrls) {
                try {
                    const response = await fetch(proxyUrl);
                    if (response.ok) {
                        const data = await response.text();
                        // Extract content from allorigins format if needed
                        if (proxyUrl.includes('allorigins')) {
                            const jsonData = JSON.parse(data);
                            articleContent = jsonData.contents;
                        } else {
                            articleContent = data;
                        }
                        break;
                    }
                } catch (e) {
                    continue; // Try next proxy
                }
            }
            
            if (articleContent) {
                // Parse and clean the HTML content
                const cleanContent = this.extractReadableContent(articleContent);
                content.innerHTML = cleanContent;
                // Force scroll to top after content loads
                setTimeout(() => content.scrollTop = 0, 100);
            } else {
                throw new Error('All proxy methods failed');
            }
            
        } catch (fetchError) {
            // Fallback: show a simplified iframe or error
            content.innerHTML = `
                <iframe src="${this.currentArticleUrl}" 
                        style="width: 100%; height: 100%; border: none;"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms">
                </iframe>
            `;
            
            // If iframe also fails, show error after a delay
            setTimeout(() => {
                const iframe = content.querySelector('iframe');
                if (iframe) {
                    iframe.onerror = () => this.showArticleError();
                    // Check if iframe loaded successfully
                    try {
                        iframe.onload = () => {
                            try {
                                // Test if we can access iframe content
                                iframe.contentDocument;
                            } catch (e) {
                                // Cross-origin, but might be loaded - keep it
                            }
                        };
                    } catch (e) {
                        this.showArticleError();
                    }
                }
            }, 2000);
        }
    }
    
    extractReadableContent(html) {
        try {
            // Create a temporary DOM to parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Remove unwanted elements
            const unwantedSelectors = [
                'script', 'style', 'nav', 'header', 'footer', 
                '.advertisement', '.ads', '.sidebar', '.comments',
                '[class*="ad"]', '[id*="ad"]', 'iframe', 'embed',
                '.social', '.share', '.newsletter', '.popup',
                '[style*="display: none"]', '[style*="visibility: hidden"]'
            ];
            
            unwantedSelectors.forEach(selector => {
                doc.querySelectorAll(selector).forEach(el => el.remove());
            });
            
            // Try to find main content area
            const contentSelectors = [
                'article', 'main', '.content', '.post', '.entry',
                '[role="main"]', '.article-content', '.post-content',
                '.story-body', '.article-body'
            ];
            
            let mainContent = null;
            for (const selector of contentSelectors) {
                const element = doc.querySelector(selector);
                if (element && element.textContent.trim().length > 200) {
                    mainContent = element;
                    break;
                }
            }
            
            // Fallback to body if no main content found
            if (!mainContent) {
                mainContent = doc.body;
            }
            
            // Clean up and return readable content
            if (mainContent) {
                // Remove empty elements and excessive whitespace
                const cleanHTML = mainContent.innerHTML
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                    .replace(/<div[^>]*>\s*<\/div>/gi, '') // Remove empty divs
                    .replace(/<p[^>]*>\s*<\/p>/gi, '') // Remove empty paragraphs
                    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br>') // Collapse multiple breaks
                    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
                    .replace(/(<\/p>)\s*(<p>)/gi, '$1$2') // Remove space between paragraphs
                    .replace(/(<\/div>)\s*(<div>)/gi, '$1$2') // Remove space between divs
                    .replace(/(<\/h[1-6]>)\s*(<p>)/gi, '$1$2') // Remove space after headings
                    .trim();
                
                return cleanHTML || '<p>Unable to extract readable content from this article.</p>';
            }
            
            return '<p>Unable to parse article content.</p>';
            
        } catch (parseError) {
            return '<p>Error parsing article content.</p>';
        }
    }
    
    showArticleError() {
        const content = document.getElementById('articleViewerContent');
        const error = document.getElementById('articleViewerError');
        content.style.display = 'none';
        error.style.display = 'flex';
    }
    
    closeArticle() {
        const viewer = document.getElementById('articleViewer');
        const content = document.getElementById('articleViewerContent');
        viewer.classList.remove('active');
        content.innerHTML = '<div class="article-reader-loading">Loading article...</div>';
        content.style.display = 'block';
        document.getElementById('articleViewerError').style.display = 'none';
        this.currentArticleUrl = null;
        
        // Update article open state and instruction highlights
        this.isArticleOpen = false;
        this.updateInstructionHighlights();
    }
    
    openInNewTab() {
        if (this.currentArticleUrl) {
            window.open(this.currentArticleUrl, '_blank');
        }
    }
    
    scrollDown() {
        console.log('scrollDown called, isScrolling:', this.isScrolling);
        
        if (this.isScrolling) return;
        this.isScrolling = true;
        
        const viewer = document.getElementById('articleViewer');
        const isViewerActive = viewer.classList.contains('active');
        
        console.log('Article viewer active:', isViewerActive);
        
        if (isViewerActive) {
            // Scroll the article content div
            const content = document.getElementById('articleViewerContent');
            console.log('Scrolling article content, current scrollTop:', content.scrollTop);
            
            content.scrollBy({
                top: content.clientHeight * 0.8,
                behavior: 'smooth'
            });
        } else {
            // Scroll the news section
            const newsSection = document.getElementById('newsSection');
            console.log('Scrolling news section, current scrollTop:', newsSection.scrollTop);
            
            newsSection.scrollBy({
                top: newsSection.clientHeight * 0.8,
                behavior: 'smooth'
            });
        }
        
        setTimeout(() => {
            this.isScrolling = false;
            console.log('Scroll cooldown ended');
        }, 1000);
    }
    
    showError(message) {
        document.getElementById('newsSection').innerHTML = `
            <div class="header">
                <div class="header-content">
                    <div class="logo">Y</div>
                    <h1>Hacker News</h1>
                    <span class="tagline">hands-free browsing</span>
                </div>
            </div>
            <div class="articles-container">
                <div class="error">${message}</div>
            </div>
        `;
    }
}

// Initialize app
let snackerNews;
window.addEventListener('load', () => {
    setTimeout(() => {
        snackerNews = new SnackerNews();
        window.snackerNews = snackerNews; // Make it globally accessible
    }, 500);
});