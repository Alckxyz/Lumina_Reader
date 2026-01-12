import { runtime } from './state.js';
import { els } from './dom.js';
import { dictionary } from './state.js';

export function pushModalState() {
    // Only push a new state if we are on mobile and don't already have a modal state active
    // This allows the hardware back button to be intercepted
    if (window.matchMedia('(max-width: 768px)').matches) {
        history.pushState({ isModal: true }, "");
    }
}

export function closeAllOverlays() {
    const overlays = [
        els.settingsModal, 
        els.wordModal, 
        els.wordListModal, 
        els.translationModal,
        els.actionPopup,
        els.selectionPopup,
        els.tooltip,
        els.wordTagsSuggestions,
        els.wordLinkSuggestions
    ];
    let closed = false;
    overlays.forEach(el => {
        if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
            closed = true;
        }
    });
    if (runtime.phraseStartWord) {
        runtime.phraseStartWord.classList.remove('phrase-selecting');
        runtime.phraseStartWord = null;
        closed = true;
    }
    return closed;
}

export function updateHeaderVisibility(scrollTop) {
    const header = document.querySelector('.controls-header');
    if (!header) return;
    if (scrollTop > 10) {
        header.classList.add('hidden-scroll');
    } else {
        header.classList.remove('hidden-scroll');
    }
}

export function handleWordHover(e) {
    const target = (e.target && e.target.closest) ? e.target.closest('.reader-word') : null;
    if (!target) return;

    runtime.hoveredElement = target;
    const word = target.dataset.word;
    const data = dictionary[word];
    
    if (data && (data.meaning || (data.tags && data.tags.length > 0) || data.linked)) {
        let linkedInfo = '';
        if (data.linked) {
            const linkedWord = data.linked;
            const linkedData = dictionary[linkedWord];
            const meaningSuffix = (linkedData && linkedData.meaning) ? `: ${linkedData.meaning}` : '';
            
            linkedInfo = `<span class="tt-meaning" style="border-top: 1px solid #444; margin-top: 4px; padding-top: 4px; color: var(--secondary-color); font-size: 0.9em;">${linkedWord}${meaningSuffix}</span>`;
        }

        els.tooltip.innerHTML = `
            <span class="tt-word">${word}</span>
            ${data.meaning ? `<span class="tt-meaning">${data.meaning}</span>` : ''}
            ${data.tags && data.tags.length > 0 ? `<span class="tt-tags">${data.tags.join(', ')}</span>` : ''}
            ${linkedInfo}
        `;
        els.tooltip.classList.remove('hidden');
        
        const rect = target.getBoundingClientRect();
        let left = rect.left;
        let top = rect.bottom + 5;

        // Adjust coordinates if inside an iframe (EPUB)
        if (target.ownerDocument !== document) {
            const iframe = els.viewer.querySelector('iframe');
            if (iframe) {
                const iRect = iframe.getBoundingClientRect();
                left += iRect.left;
                top += iRect.top;
            }
        }

        els.tooltip.style.left = `${left}px`;
        els.tooltip.style.top = `${top}px`;
    }
}

export function handleWordOut() {
    runtime.hoveredElement = null;
    els.tooltip.classList.add('hidden');
}