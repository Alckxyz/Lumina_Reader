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

// removed function updateHeaderVisibility() {} (moved to ui_utils.js)

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
    if (dir === 1 && shouldNeutralize) {
        neutralizeVisibleBlueWords();
    }

    if (runtime.currentFileType === 'epub' && runtime.rendition) {
        if (dir === 1) runtime.rendition.next(); else runtime.rendition.prev();
    } else if (runtime.pagedContent.length > 0) {
        const next = runtime.currentPage + dir;
        if (next >= 0 && next < runtime.pagedContent.length) {
            runtime.currentPage = next;
            renderPage();
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
            renderPage();
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

    if (ext === 'epub') await loadEpub(file);
    else if (ext === 'pdf') {
        runtime.rawTextSource = await reader.loadPdf(file);
        repaginateManualContent();
    }
    else if (ext === 'txt') {
        runtime.rawTextSource = await reader.loadTxt(file);
        repaginateManualContent();
    }
}

export async function handleFileSelect(e) {
    await loadFile(e.target.files[0]);
}

export function setupSwipeGestures(element, isForwardNeutralizing = false) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    element.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    element.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const threshold = 70; // Increased threshold for better intent detection
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Ensure it's primarily a horizontal gesture to prevent triggers while scrolling vertically
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
            if (deltaX < 0) {
                // Swipe Left -> Next Page
                navigate(1, isForwardNeutralizing);
            } else {
                // Swipe Right -> Prev Page
                navigate(-1, false);
            }
        }
    }
}

export async function loadEpub(file) {
    const fileReader = new FileReader();
    fileReader.onload = async (e) => {
        runtime.currentBook = ePub(e.target.result);
        runtime.rendition = runtime.currentBook.renderTo("viewer", { width: "100%", height: "100%", flow: "scrolled" });

        // Fix for mobile: Notify rendition of size changes when header hides/shows
        const resizeObserver = new ResizeObserver(() => {
            if (runtime.rendition) {
                try { runtime.rendition.resize(); } catch(e) {}
            }
        });
        resizeObserver.observe(els.viewer);

        runtime.currentBook.ready.then(() => {
            runtime.totalContentLength = 1000000; // Virtual length for percentage-based sync
            els.progressSlider.max = 100;
            return runtime.currentBook.locations.generate(1024);
        }).then(updatePageDisplay);
        runtime.rendition.on('relocated', () => {
            updatePageDisplay();
            updateHeaderVisibility(0);

            // Save progress per file
            const loc = runtime.rendition.currentLocation();

            // Check if we are at the end to inject "Terminado" button for EPUB
            // EPUB percentage is often slightly less than 1.0 at the end
            if (loc && loc.atEnd) {
                const body = runtime.rendition.getContents()[0].document.body;
                if (!body.querySelector('#finish-reading-btn')) {
                    const container = body.ownerDocument.createElement('div');
                    container.className = 'finish-reading-container';
                    container.style.marginTop = '40px';
                    container.style.padding = '20px 0';
                    container.style.textAlign = 'center';
                    
                    const btn = body.ownerDocument.createElement('button');
                    btn.id = 'finish-reading-btn';
                    btn.innerText = 'Finished';
                    btn.style.cssText = `
                        background: #bb86fc;
                        color: #000;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: sans-serif;
                    `;
                    btn.onclick = finishReading;
                    container.appendChild(btn);
                    body.appendChild(container);
                }
            }
            if (runtime.currentFileName && loc && loc.start) {
                if (!appSettings.progress[runtime.currentFileName]) appSettings.progress[runtime.currentFileName] = {};
                appSettings.progress[runtime.currentFileName].lastCfi = loc.start.cfi;
                persist();
            }

            // Re-sync sentences on page change if playing
            const body = runtime.rendition.getContents()[0].document.body;
            const offset = (loc && loc.start) ? Math.floor(loc.start.percentage * runtime.totalContentLength) : 0;
            tts.prepareSync(body, offset, runtime.totalContentLength);
        });
        
        runtime.rendition.hooks.content.register((contents) => {
            const body = contents.document.body;
            processNodes(body, wrapWords);
            contents.document.addEventListener('click', handleWordClick);
            contents.document.addEventListener('mouseover', handleWordHover);
            contents.document.addEventListener('mouseout', handleWordOut);
            contents.document.addEventListener('selectionchange', () => {
                handleSelection(null, contents.document);
            });

            if (window.matchMedia('(max-width: 768px)').matches) {
                initTouchSelection(body, contents.document);
            }

            contents.window.addEventListener('scroll', () => {
                updateHeaderVisibility(contents.window.scrollY || contents.document.documentElement.scrollTop);
            });

            // Setup swipe for mobile inside epub iframe
            if (window.matchMedia('(max-width: 768px)').matches) {
                setupSwipeGestures(contents.document, true);
            }

            const style = contents.document.createElement('style');
            style.textContent = `
                body { color: #e8e8e8 !important; }
                .reader-word { cursor: pointer; border-radius: 2px; padding: 0 1px; color: inherit; }
                .reader-word:hover { background: rgba(255,255,255,0.1); }
                .word-new { color: #4a90e2 !important; }
                ${appSettings.colors.map((c, i) => `.word-custom-${i} { color: ${c} !important; }`).join('\n')}
            `;
            contents.document.head.appendChild(style);
        });

        const storedProgress = appSettings.progress[runtime.currentFileName];
        const initialPos = storedProgress ? storedProgress.lastCfi : undefined;

        await runtime.rendition.display(initialPos);
        updatePageDisplay();
        applyTextStyles();
    };
    fileReader.readAsArrayBuffer(file);
}

export function repaginateManualContent() {
    if (!runtime.rawTextSource) return;
    runtime.pagedContent = reader.paginateContent(runtime.rawTextSource, appSettings.paragraphsPerPage);
    runtime.totalContentLength = runtime.rawTextSource.length;
    
    // Calculate page offsets for syncing
    runtime.pageOffsets = [];
    let currentOffset = 0;
    runtime.pagedContent.forEach(page => {
        runtime.pageOffsets.push(currentOffset);
        currentOffset += page.length + 2; // +2 for the \n\n split joining
    });
    
    // Restore page progress
    const storedProgress = appSettings.progress[runtime.currentFileName];
    if (storedProgress && storedProgress.lastPage !== undefined && storedProgress.lastPage < runtime.pagedContent.length) {
        runtime.currentPage = storedProgress.lastPage;
    } else {
        runtime.currentPage = 0;
    }
    
    renderPage();
}

export function renderPage() {
    if (!runtime.pagedContent[runtime.currentPage]) return;
    
    // Save progress per file for TXT/PDF
    if (runtime.currentFileName) {
        if (!appSettings.progress[runtime.currentFileName]) appSettings.progress[runtime.currentFileName] = {};
        appSettings.progress[runtime.currentFileName].lastPage = runtime.currentPage;
        persist();
    }

    const content = runtime.pagedContent[runtime.currentPage];
    let html = `<div class="txt-content" id="paged-content">${wrapWords(content)}</div>`;
    
    // Add "Terminado" button on the last page
    if (runtime.currentPage === runtime.pagedContent.length - 1) {
        html += `
            <div class="finish-reading-container">
                <button id="finish-reading-btn" class="primary-btn finish-btn">
                    Finished
                </button>
            </div>
        `;
    }

    els.viewer.innerHTML = html;
    
    const finishBtn = document.getElementById('finish-reading-btn');
    if (finishBtn) {
        finishBtn.addEventListener('click', finishReading);
    }

    if (window.matchMedia('(max-width: 768px)').matches) {
        initTouchSelection(els.viewer, document);
    }
    
    // Ensure scroll is reset after DOM update and layout
    setTimeout(() => {
        els.viewer.scrollTop = 0;
    }, 0);
    
    updateHeaderVisibility(0);
    updatePageDisplay();
    applyTextStyles();
    
    // Always prepare sync to enable "T" and "C" sentence features even without audio
    tts.prepareSync(els.viewer, runtime.pageOffsets[runtime.currentPage] || 0, runtime.totalContentLength);
}

export async function finishReading() {
    if (runtime.currentFileName) {
        // 1. Remove synchronization and progress data for this file
        delete appSettings.progress[runtime.currentFileName];
    }

    // 2. Stop and fully reset audio
    tts.stopTTS();
    tts.resetAudio();
    els.audioFilename.textContent = "No audio loaded";
    els.audioUpload.value = ""; // Clear file input
    els.audioUploadLabel.classList.remove('hidden');

    // 3. Reset Runtime state
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

    // 4. Update UI to Welcome Screen
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
    
    // 5. Reset progress display
    els.pageDisplay.innerText = "";
    els.progressSlider.value = 0;
    els.progressSlider.max = 0;

    // 6. Persist changes to Firebase
    await persist();
    
    // 7. Reload the page automatically to start fresh
    window.location.reload();
}

export function applyTextStyles() {
    const style = `font-size: ${appSettings.fontSize}px;`;
    const target = document.getElementById('paged-content');
    if (target) target.setAttribute('style', style);
    if (runtime.rendition) runtime.rendition.themes.fontSize(`${appSettings.fontSize}px`);
}