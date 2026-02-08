import { runtime, appSettings, persist } from './state.js';
import { els } from './dom.js';
import { wrapWords } from './utils.js';
import { updatePageDisplay, updateHeaderVisibility, applyTextStyles, finishReading } from './reader_manager.js';
import { initTouchSelection } from './selection_manager.js';
import * as reader from './reader.js';
import * as tts from './tts.js';

export function repaginateManualContent() {
    if (!runtime.rawTextSource) return;
    const isSrt = runtime.currentFileType === 'srt';
    runtime.pagedContent = reader.paginateContent(runtime.rawTextSource, appSettings.paragraphsPerPage, isSrt);
    
    runtime.pageOffsets = [];
    let cumulativeOffset = 0;
    
    runtime.pagedContent.forEach(pageText => {
        runtime.pageOffsets.push(cumulativeOffset);
        cumulativeOffset += pageText.length + 2; 
    });

    runtime.totalContentLength = cumulativeOffset > 0 ? cumulativeOffset - 2 : 0;
    
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
    
    if (runtime.currentFileName) {
        if (!appSettings.progress[runtime.currentFileName]) appSettings.progress[runtime.currentFileName] = {};
        appSettings.progress[runtime.currentFileName].lastPage = runtime.currentPage;
        persist();
    }

    const content = runtime.pagedContent[runtime.currentPage];
    let html = `<div class="txt-content" id="paged-content">${wrapWords(content)}</div>`;
    
    if (runtime.currentPage === runtime.pagedContent.length - 1) {
        html += `<div class="finish-reading-container"><button id="finish-reading-btn" class="primary-btn finish-btn">Finished</button></div>`;
    }

    els.viewer.innerHTML = html;
    
    const finishBtn = document.getElementById('finish-reading-btn');
    if (finishBtn) finishBtn.addEventListener('click', finishReading);

    if (window.matchMedia('(max-width: 768px)').matches) {
        initTouchSelection(els.viewer, document);
    }
    
    setTimeout(() => { els.viewer.scrollTop = 0; }, 0);
    
    updateHeaderVisibility(0);
    updatePageDisplay();
    applyTextStyles();
    
    tts.prepareSync(els.viewer, runtime.pageOffsets[runtime.currentPage] || 0, runtime.totalContentLength);
}