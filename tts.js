import { createIcons } from 'lucide';

let audio = new Audio();
let sentences = [];
let currentSentenceIndex = -1;
let isAudioLoaded = false;
let currentPlaybackRate = 1.0;
let onUpdateCallback = null;

// Initialize global audio events once
audio.ontimeupdate = () => {
    updateSyncHighlight();
    if (onUpdateCallback) onUpdateCallback(audio.currentTime);
};

export const ttsState = {
    get isSpeaking() { return !audio.paused && !audio.ended; },
    get isPaused() { return audio.paused && audio.currentTime > 0 && !audio.ended; },
    get currentTime() { return audio.currentTime; },
    get duration() { return audio.duration; },
    get isLoaded() { return isAudioLoaded && audio.src; },
    get playbackRate() { return currentPlaybackRate; }
};

export function setAudioSource(file) {
    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.load();
    isAudioLoaded = true;
    currentSentenceIndex = -1; // Reset highlight state
}

export function resetAudio() {
    audio.pause();
    audio.src = "";
    audio.load();
    isAudioLoaded = false;
    sentences = [];
    currentSentenceIndex = -1;
}

function updateSyncHighlight() {
    if (!sentences.length) return;
    const time = audio.currentTime;
    const newIdx = sentences.findIndex(s => time >= s.startTime && time < s.endTime);
    
    if (newIdx !== currentSentenceIndex) {
        // Remove previous highlight
        if (currentSentenceIndex !== -1 && sentences[currentSentenceIndex]) {
            sentences[currentSentenceIndex].elements.forEach(el => el.classList.remove('tts-highlight'));
        }
        
        // Apply new highlight
        if (newIdx !== -1 && sentences[newIdx]) {
            sentences[newIdx].elements.forEach(el => el.classList.add('tts-highlight'));
            
            // Auto-scroll (only if actually playing or specifically requested via manual seek)
            if (sentences[newIdx].elements[0]) {
                sentences[newIdx].elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        currentSentenceIndex = newIdx;
    }
}

export function stopTTS(playBtn, PlayIcon) {
    audio.pause();
    audio.currentTime = 0;
    clearTtsHighlights();
    if (playBtn) {
        playBtn.innerHTML = '<i data-lucide="play"></i>';
        createIcons({ icons: { Play: PlayIcon } });
    }
}

export function clearTtsHighlights() {
    sentences.forEach(s => s.elements.forEach(el => el.classList.remove('tts-highlight')));
    currentSentenceIndex = -1;
}

export function prepareSync(container, pageStartIndex = 0, totalGlobalLength = 0) {
    if (!container) return;
    
    // Slight delay to ensure layout is final
    setTimeout(() => {
        const wordElements = Array.from(container.querySelectorAll('.reader-word'));
        if (wordElements.length === 0) return;

        // Clear any lingering highlights and reset state
        sentences.forEach(s => s.elements.forEach(el => el.classList.remove('tts-highlight')));
        sentences = [];
        currentSentenceIndex = -1;

        let currentSentence = { elements: [], text: "", localOffset: 0 };

        wordElements.forEach((el, idx) => {
            const text = el.innerText;
            // Capture any text/punctuation between this word and the next
            let separator = "";
            let next = el.nextSibling;
            while (next && (!next.classList || !next.classList.contains('reader-word'))) {
                separator += next.textContent || "";
                next = next.nextSibling;
            }

            currentSentence.elements.push(el);
            currentSentence.text += text + separator;

            // Check for sentence end markers in the separator or the word itself
            const isEndOfSentence = /[.!?]/.test(text) || /[.!?]/.test(separator);

            if (isEndOfSentence || idx === wordElements.length - 1) {
                if (currentSentence.elements.length > 0) {
                    sentences.push(currentSentence);
                    const nextOffset = currentSentence.localOffset + currentSentence.text.length;
                    currentSentence = { elements: [], text: "", localOffset: nextOffset };
                }
            }
        });

        const triggerCalc = () => {
            if (audio.duration && !isNaN(audio.duration)) {
                calculateTimings(pageStartIndex, totalGlobalLength);
            } else {
                audio.addEventListener('loadedmetadata', () => calculateTimings(pageStartIndex, totalGlobalLength), { once: true });
            }
        };

        triggerCalc();
    }, 100);
}

function calculateTimings(pageStartIndex, totalGlobalLength) {
    if (!audio.duration || sentences.length === 0) return;
    
    // If totalGlobalLength is 0, we fallback to page-only sync (old behavior)
    const effectiveTotal = totalGlobalLength || sentences.reduce((sum, s) => sum + s.text.length, 0);
    const effectiveStart = totalGlobalLength ? pageStartIndex : 0;

    sentences.forEach(s => {
        const startChar = effectiveStart + s.localOffset;
        const endChar = startChar + s.text.length;
        
        s.startTime = (startChar / effectiveTotal) * audio.duration;
        s.endTime = (endChar / effectiveTotal) * audio.duration;
    });

    // Manually trigger highlight update after timings are ready
    updateSyncHighlight();
}

export function startPlayback(options) {
    const { speed, onUpdate, onEnd, playBtn, PauseIcon } = options;
    
    if (!isAudioLoaded) return;
    
    if (speed) currentPlaybackRate = speed;
    audio.playbackRate = currentPlaybackRate;
    onUpdateCallback = onUpdate;

    audio.onended = () => {
        clearTtsHighlights();
        if (onEnd) onEnd();
    };

    audio.play();

    if (playBtn) {
        playBtn.innerHTML = '<i data-lucide="pause"></i>';
        createIcons({ icons: { Pause: PauseIcon } });
    }
}

export function togglePauseResume(playBtn, PlayIcon, PauseIcon) {
    if (audio.paused) {
        audio.playbackRate = currentPlaybackRate;
        audio.play();
        playBtn.innerHTML = '<i data-lucide="pause"></i>';
        createIcons({ icons: { Pause: PauseIcon } });
    } else {
        audio.pause();
        playBtn.innerHTML = '<i data-lucide="play"></i>';
        createIcons({ icons: { Play: PlayIcon } });
    }
}

export function setPlaybackRate(rate) {
    currentPlaybackRate = rate;
    audio.playbackRate = rate;
}

export function skip(seconds) {
    if (!isAudioLoaded || !isFinite(audio.duration)) return;
    const target = audio.currentTime + seconds;
    if (isFinite(target)) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, target));
    }
}

export function seekToTime(time) {
    if (!isAudioLoaded) return;
    if (!isFinite(audio.duration)) {
        audio.addEventListener('loadedmetadata', () => {
            audio.currentTime = Math.max(0, Math.min(audio.duration, time));
            updateSyncHighlight();
        }, { once: true });
        return;
    }
    audio.currentTime = Math.max(0, Math.min(audio.duration, time));
    updateSyncHighlight();
}

export function getSentenceAtElement(el) {
    if (!el || !sentences.length) return null;
    // Ensure we are looking at the word element itself
    const targetWord = (el.classList && el.classList.contains('reader-word')) ? el : el.closest('.reader-word');
    if (!targetWord) return null;
    return sentences.find(s => s.elements.includes(targetWord));
}

export function seekToElement(el) {
    if (!el || !sentences.length) return;
    
    const sentence = getSentenceAtElement(el);
    if (sentence && isFinite(audio.duration) && isFinite(sentence.startTime)) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, sentence.startTime));
    }
}

export function speakText(text) {
    if (!window.speechSynthesis) return;
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}