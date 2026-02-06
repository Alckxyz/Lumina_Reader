import { Pause, Play, createIcons } from 'lucide';
import { appSettings, runtime, persist } from './state.js';
import { els } from './dom.js';
import * as tts from './tts.js';

export function updateSpeed(delta) {
    const current = tts.ttsState.playbackRate;
    const next = Math.max(0.1, Math.min(4.0, current + delta));
    const rounded = Math.round(next * 10) / 10;
    tts.setPlaybackRate(rounded);
    appSettings.playbackRate = rounded;
    els.speedDisplay.innerText = `${rounded.toFixed(1)}x`;
    persist();
}

export function updateVolume(val) {
    tts.setVolume(val);
    appSettings.volume = val;
    persist();
}

export function toggleTTS() {
    if (tts.ttsState.isSpeaking || tts.ttsState.isPaused) {
        tts.togglePauseResume(els.ttsPlayPauseBtn, Play, Pause);
    } else {
        let container = els.viewer;
        if (runtime.currentFileType === 'epub' && runtime.rendition) {
            try { container = runtime.rendition.getContents()[0].document.body; } catch(err){}
        }
        let offset = 0;
        if (runtime.currentFileType === 'epub' && runtime.rendition) {
            const loc = runtime.rendition.currentLocation();
            offset = (loc && loc.start) ? Math.floor(loc.start.percentage * runtime.totalContentLength) : 0;
        } else {
            offset = runtime.pageOffsets[runtime.currentPage] || 0;
        }
        tts.prepareSync(container, offset, runtime.totalContentLength);
        tts.startPlayback({
            speed: tts.ttsState.playbackRate,
            playBtn: els.ttsPlayPauseBtn,
            PauseIcon: Pause,
            onEnd: () => {
                els.ttsPlayPauseBtn.innerHTML = '<i data-lucide="play"></i>';
                createIcons({ icons: { Play } });
                
                if (runtime.currentFileName) {
                    delete appSettings.progress[runtime.currentFileName];
                }
            }
        });
    }
}

export function handleAudioFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        if (!runtime.currentFileName) runtime.currentFileName = fileName;

        els.audioFilename.textContent = file.name;
        els.audioUploadLabel.classList.add('hidden');
        tts.setAudioSource(file);
        
        const fileProgress = appSettings.progress[runtime.currentFileName];
        if (fileProgress && fileProgress.lastAudioPosition > 0) {
            tts.seekToTime(fileProgress.lastAudioPosition);
        }

        let container = els.viewer;
        let offset = 0;
        if (runtime.currentFileType === 'epub' && runtime.rendition) {
            try { 
                container = runtime.rendition.getContents()[0].document.body;
                const loc = runtime.rendition.currentLocation();
                offset = (loc && loc.start) ? Math.floor(loc.start.percentage * runtime.totalContentLength) : 0;
            } catch(err){}
        } else {
            offset = runtime.pageOffsets[runtime.currentPage] || 0;
        }
        tts.prepareSync(container, offset, runtime.totalContentLength);
    }
}