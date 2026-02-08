import ePub from 'epubjs';
import { runtime, appSettings, persist } from './state.js';
import { els } from './dom.js';
import { wrapWords, processNodes } from './utils.js';
import { createIcons, BookOpen } from 'lucide';
import { handleWordClick } from './word_manager.js';
import { handleWordHover, handleWordOut, updateHeaderVisibility } from './ui_utils.js';
import { neutralizeVisibleBlueWords, handleSelection, initTouchSelection } from './selection_manager.js';
import * as reader from './reader.js';
import * as tts from './tts.js';

export { updateHeaderVisibility };

export function updatePageDisplay() {
    if (runtime.currentFileType === 'epub' && runtime.rendition) {
        const loc = runtime.rendition.currentLocation();
        if (loc && loc.start) {
            els.pageDisplay.innerText = `Pos: ${loc.start.displayed.page}`;
            if (runtime.currentBook.locations && runtime.currentBook.locations.length() > 0) {
                const progress = runtime.currentBook.locations.percentageFromCfi(loc.start.cfi);
                els.progressSlider.value = Math.round(progress * 100);
            }
        }
    } else if (runtime.currentFileType !== 'epub' && runtime.currentFileType !== null) {
        els.pageDisplay.innerText = `Page ${runtime.currentPage + 1} / ${runtime.pagedContent.length}`;
        els.progressSlider.max = Math.max(0, runtime.pagedContent.length - 1);
        els.progressSlider.value = runtime.currentPage;
    }
}

export function navigate(dir, shouldNeutralize = false) {
    handleWordOut();
    if (dir === 1 && shouldNeutralize) {
        neutralizeVisibleBlueWords();
    }

    if (runtime.currentFileType === 'epub' && runtime.rendition) {
        if (dir === 1) runtime.rendition.next(); else runtime.rendition.prev();
    } else if (runtime.pagedContent.length > 0) {
        const next = runtime.currentPage + dir;
        if (next >= 0 && next < runtime.pagedContent.length) {
            runtime.currentPage = next;
            import('./paged_manager.js').then(m => m.renderPage());
        }
    }
    persist();
}

export function handleSliderChange(e) {
    const val = parseInt(e.target.value);
    if (runtime.currentFileType === 'epub' && runtime.rendition && runtime.currentBook.locations) {
        const cfi = runtime.currentBook.locations.cfiFromPercentage(val / 100);
        runtime.rendition.display(cfi);
    } else if (runtime.pagedContent.length > 0) {
        if (val >= 0 && val < runtime.pagedContent.length) {
            runtime.currentPage = val;
            import('./paged_manager.js').then(m => m.renderPage());
        }
    }
}

export async function loadFile(file) {
    if (!file) return;
    
    const fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    runtime.currentFileName = fileName;
    
    if (!appSettings.progress[runtime.currentFileName]) {
        appSettings.progress[runtime.currentFileName] = {};
    }

    els.bookTitle.textContent = file.name;
    const ext = file.name.split('.').pop().toLowerCase();
    runtime.currentFileType = ext;
    els.viewer.innerHTML = '<div class="loading">Loading...</div>';
    els.ttsBar.classList.remove('hidden');
    tts.stopTTS();

    if (ext === 'epub') {
        runtime.srtTimings = null;
        const { loadEpub } = await import('./epub_manager.js');
        await loadEpub(file);
    }
    else {
        if (ext === 'pdf') {
            runtime.rawTextSource = await reader.loadPdf(file);
        } else if (ext === 'txt') {
            runtime.rawTextSource = await reader.loadTxt(file);
        } else if (ext === 'srt') {
            const { text, timings } = await reader.loadSrt(file);
            runtime.rawTextSource = text;
            runtime.srtTimings = timings;
        }
        const { repaginateManualContent } = await import('./paged_manager.js');
        repaginateManualContent();
    }
}

export async function handleFileSelect(e) {
    await loadFile(e.target.files[0]);
}

export function setupSwipeGestures(element, isForwardNeutralizing = false) {
    let touchStartX = 0;
    let touchStartY = 0;
    
    element.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    element.addEventListener('touchend', e => {
        const deltaX = e.changedTouches[0].screenX - touchStartX;
        const deltaY = e.changedTouches[0].screenY - touchStartY;
        const threshold = 70;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
            if (deltaX < 0) navigate(1, isForwardNeutralizing);
            else navigate(-1, false);
        }
    }, { passive: true });
}

// removed function loadEpub() {} (moved to epub_manager.js)

export async function repaginateManualContent() {
    const { repaginateManualContent } = await import('./paged_manager.js');
    repaginateManualContent();
}

export async function renderPage() {
    const { renderPage } = await import('./paged_manager.js');
    renderPage();
}

export async function finishReading() {
    if (runtime.currentFileName) delete appSettings.progress[runtime.currentFileName];

    tts.stopTTS();
    tts.resetAudio();
    els.audioFilename.textContent = "No audio loaded";
    els.audioUpload.value = "";
    els.audioUploadLabel.classList.remove('hidden');

    runtime.currentBook = null;
    if (runtime.rendition) {
        runtime.rendition.destroy();
        runtime.rendition = null;
    }
    runtime.currentFileType = null;
    runtime.currentFileName = null;
    runtime.rawTextSource = "";
    runtime.pagedContent = [];
    runtime.currentPage = 0;
    runtime.totalContentLength = 0;
    runtime.pageOffsets = [];

    els.bookTitle.textContent = "No book loaded";
    els.viewer.innerHTML = `
        <div id="welcome-screen">
            <i data-lucide="book-open" class="welcome-icon"></i>
            <h1>Lumina Reader</h1>
            <p>Upload a file. Words are blue by default (New).</p>
            <p>Press 'X' to remove color, 'Z' to make blue again.</p>
        </div>
    `;
    createIcons({ icons: { BookOpen } });
    els.ttsBar.classList.add('hidden');
    els.pageDisplay.innerText = "";
    els.progressSlider.value = 0;
    els.progressSlider.max = 0;

    await persist();
    window.location.reload();
}

export function applyTextStyles() {
    const style = `font-size: ${appSettings.fontSize}px;`;
    const target = document.getElementById('paged-content');
    if (target) target.setAttribute('style', style);
    if (runtime.rendition) runtime.rendition.themes.fontSize(`${appSettings.fontSize}px`);
}