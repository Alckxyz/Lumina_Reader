import { els } from './dom.js';
import { runtime, appSettings } from './state.js';
import * as tts from './tts.js';
import { createIcons, Play, Pause, Timer, Download, Trash2, Plus, Minus, Undo2, Sparkles, Square } from 'lucide';

let syncSegments = [];
let currentSyncIdx = 0;
let syncPlaybackRate = 2.5;
let previousAudioTime = 0;

export function openSyncTool() {
    if (!tts.ttsState.isLoaded) {
        alert("Please upload an audio file first.");
        return;
    }

    let textToSync = "";
    
    // Prioritize the full source text (available for TXT, PDF, SRT)
    if (runtime.rawTextSource) {
        textToSync = runtime.rawTextSource;
    } else if (runtime.currentFileType === 'epub' && runtime.rendition) {
        // For EPUB, use the content of the currently loaded section/chapter
        try {
            const currentContainer = runtime.rendition.getContents()[0].document.body;
            textToSync = currentContainer.innerText;
        } catch (e) {
            console.error("Could not extract EPUB text for sync tool", e);
        }
    }

    if (!textToSync) {
        alert("No text found to sync. Please open a book.");
        return;
    }

    prepareSegmentsFromText(textToSync);
    renderSegments();
    
    // Save current position and jump to start for sync tool
    previousAudioTime = tts.ttsState.currentTime;
    tts.stopTTS(); // Resets current position to 0 and clears highlights
    
    // Set sync tool specific playback rate
    tts.setPlaybackRate(syncPlaybackRate);
    els.syncSpeedDisplay.innerText = `${syncPlaybackRate.toFixed(1)}x`;

    els.syncToolModal.classList.remove('hidden');
    updateTimeDisplay();
}

export function closeSyncTool() {
    stopAutoSync();
    els.syncToolModal.classList.add('hidden');
    tts.setPlaybackRate(appSettings.playbackRate);
    tts.seekToTime(previousAudioTime);
}

function startAutoSync() {
    if (!window.speechSynthesis || syncSegments.length === 0) return;
    isAutoSyncing = true;
    els.syncAutoBtn.innerHTML = '<i data-lucide="square"></i> Stop Auto-Sync';
    createIcons({ icons: { Square } });
    
    currentSyncIdx = 0;
    renderSegments();
    
    // Pause human audio if playing
    if (tts.ttsState.isSpeaking) tts.togglePauseResume(els.syncPlayPauseBtn, Play, Pause);
    
    function processNext(idx) {
        if (!isAutoSyncing || idx >= syncSegments.length) {
            stopAutoSync();
            return;
        }
        
        const segment = syncSegments[idx];
        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.rate = syncPlaybackRate;
        utterance.lang = 'en-US';
        
        utterance.onstart = () => {
            if (!isAutoSyncing) return;
            const now = tts.ttsState.currentTime; // We use human audio's current time as the "stamp"
            segment.start = now;
            if (idx > 0) syncSegments[idx-1].end = now;
            currentSyncIdx = idx;
            renderSegments();
        };
        
        utterance.onend = () => {
            if (!isAutoSyncing) return;
            // Slight delay before next line for natural flow
            setTimeout(() => processNext(idx + 1), 100);
        };
        
        utterance.onerror = () => stopAutoSync();
        
        window.speechSynthesis.speak(utterance);
    }
    
    processNext(0);
}

function stopAutoSync() {
    isAutoSyncing = false;
    window.speechSynthesis.cancel();
    els.syncAutoBtn.innerHTML = '<i data-lucide="sparkles"></i> Auto-Sync with Browser Voice';
    createIcons({ icons: { Sparkles } });
}

function prepareSegmentsFromText(text) {
    syncSegments = [];
    
    // Split the full text into sentence-based segments for synchronization.
    // This regex splits on . ! or ? followed by whitespace or end of string.
    const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+(?:\s+|$)/g;
    const matches = text.match(sentenceRegex);
    
    if (matches) {
        matches.forEach(s => {
            const trimmed = s.trim();
            if (trimmed) {
                syncSegments.push({
                    text: trimmed,
                    start: null,
                    end: null
                });
            }
        });
    } else if (text.trim()) {
        syncSegments.push({ text: text.trim(), start: null, end: null });
    }
    
    currentSyncIdx = 0;
}

function renderSegments() {
    els.syncSegmentsContainer.innerHTML = '';
    let activeEl = null;

    syncSegments.forEach((seg, i) => {
        const div = document.createElement('div');
        div.className = `sync-segment ${i === currentSyncIdx ? 'active' : ''} ${seg.start !== null ? 'synced' : ''}`;
        
        const timeStr = seg.start !== null ? formatTime(seg.start) : '--:--';
        
        div.innerHTML = `
            <div class="sync-segment-text">${seg.text}</div>
            <div class="sync-segment-time">${timeStr}</div>
        `;
        
        div.onclick = () => {
            currentSyncIdx = i;
            renderSegments();
        };
        
        els.syncSegmentsContainer.appendChild(div);
        
        if (i === currentSyncIdx) {
            activeEl = div;
        }
    });

    if (activeEl) {
        // Scroll to the top of the container so the user always sees the upcoming text below the active line
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function updateTimeDisplay() {
    const time = tts.ttsState.currentTime;
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    els.syncTimeDisplay.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (!els.syncToolModal.classList.contains('hidden')) {
        requestAnimationFrame(updateTimeDisplay);
    }
}

export function handleMark() {
    if (currentSyncIdx >= syncSegments.length) return;
    
    const now = tts.ttsState.currentTime;
    
    // Set start of current
    syncSegments[currentSyncIdx].start = now;
    
    // Set end of previous
    if (currentSyncIdx > 0) {
        syncSegments[currentSyncIdx - 1].end = now;
    }
    
    currentSyncIdx++;
    renderSegments();
}

export function handleUndo() {
    if (currentSyncIdx <= 0) return;
    
    currentSyncIdx--;
    
    const targetTime = syncSegments[currentSyncIdx].start;
    
    // Clear the timings of the segment we are returning to
    syncSegments[currentSyncIdx].start = null;
    syncSegments[currentSyncIdx].end = null;
    
    // Clear the end of the previous segment if it exists
    if (currentSyncIdx > 0) {
        syncSegments[currentSyncIdx - 1].end = null;
    }
    
    // Seek audio back to the point where this segment previously started
    if (targetTime !== null) {
        tts.seekToTime(targetTime);
    }
    
    renderSegments();
}

let isAutoSyncing = false;

export function initSyncTool() {
    els.syncSpeedDisplay.innerText = `${syncPlaybackRate.toFixed(1)}x`;
    els.openSyncToolBtn.addEventListener('click', openSyncTool);
    els.closeSyncToolModal.addEventListener('click', closeSyncTool);
    
    els.syncPlayPauseBtn.addEventListener('click', () => {
        tts.togglePauseResume(els.syncPlayPauseBtn, Play, Pause);
    });
    
    els.syncSpeedUpBtn.addEventListener('click', () => {
        syncPlaybackRate = Math.min(4, syncPlaybackRate + 0.1);
        tts.setPlaybackRate(syncPlaybackRate);
        els.syncSpeedDisplay.innerText = `${syncPlaybackRate.toFixed(1)}x`;
    });
    
    els.syncSpeedDownBtn.addEventListener('click', () => {
        syncPlaybackRate = Math.max(0.1, syncPlaybackRate - 0.1);
        tts.setPlaybackRate(syncPlaybackRate);
        els.syncSpeedDisplay.innerText = `${syncPlaybackRate.toFixed(1)}x`;
    });
    
    els.syncMarkBtn.addEventListener('click', handleMark);
    els.syncUndoBtn.addEventListener('click', handleUndo);
    
    els.syncAutoBtn.addEventListener('click', () => {
        if (isAutoSyncing) {
            stopAutoSync();
        } else {
            startAutoSync();
        }
    });
    
    els.syncResetBtn.addEventListener('click', () => {
        if (confirm("Reset all manual timings?")) {
            syncSegments.forEach(s => { s.start = null; s.end = null; });
            currentSyncIdx = 0;
            renderSegments();
        }
    });
    
    els.syncExportSrtBtn.addEventListener('click', () => {
        exportSRT();
    });

    // Handle spacebar in sync tool
    window.addEventListener('keydown', (e) => {
        if (els.syncToolModal.classList.contains('hidden')) return;
        if (e.code === 'Space') {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) return;
            
            e.preventDefault();
            e.stopImmediatePropagation(); // Prevent global shortcut listener from firing
            
            // User requested: Space only pauses/resumes in sync tool, doesn't mark.
            tts.togglePauseResume(els.syncPlayPauseBtn, Play, Pause);
        }
    });
}

function exportSRT() {
    let srtContent = "";
    let count = 1;
    
    syncSegments.forEach((seg, i) => {
        if (seg.start === null) return;
        
        const startTime = formatTime(seg.start);
        // If it's the last one, we end it at audio duration or +2s
        const endTime = seg.end !== null ? formatTime(seg.end) : formatTime(Math.min(tts.ttsState.duration, seg.start + 3));
        
        srtContent += `${count}\n${startTime} --> ${endTime}\n${seg.text}\n\n`;
        count++;
    });
    
    if (!srtContent) {
        alert("No timings recorded yet.");
        return;
    }
    
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${runtime.currentFileName || 'sync'}.srt`;
    a.click();
}