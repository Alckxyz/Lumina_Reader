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
    
    if (data) {
        const linkedWord = data.linked;
        const linkedData = linkedWord ? dictionary[linkedWord] : null;
        
        // Tooltip activation condition: word or its linked base form has any meaningful content
        const hasOwnContent = data.meaning || (data.tags && data.tags.length > 0) || data.imageUrl;
        const hasLinkedContent = linkedWord || (linkedData && (linkedData.meaning || (linkedData.tags && linkedData.tags.length > 0) || linkedData.imageUrl));

        if (hasOwnContent || hasLinkedContent) {
            let tooltipHtml = `<div class="tt-section">`;
            
            // 1. Current Word Section
            tooltipHtml += `<div class="tt-word">` +
                `<span class="tt-word-main">${word}</span>` +
                `${data.meaning ? `<span class="tt-meaning-inline">: ${data.meaning}</span>` : ''}` +
                `</div>`;
            
            if (data.tags && data.tags.length > 0) {
                tooltipHtml += `<span class="tt-tags">${data.tags.join(', ')}</span>`;
            }

            if (data.imageUrl) {
                tooltipHtml += `<img src="${data.imageUrl}" class="tt-image" onerror="this.style.display='none'">`;
            }
            
            tooltipHtml += `</div>`;

            // 2. Base Form Section (if exists)
            if (linkedWord) {
                tooltipHtml += `
                    <div class="tt-section" style="margin-top: 10px; border-top: 1px solid #444; padding-top: 10px;">
                        <div class="tt-word">
                            <span class="tt-word-linked">${linkedWord}</span>
                            ${(linkedData && linkedData.meaning) ? `<span class="tt-meaning-inline">: ${linkedData.meaning}</span>` : ''}
                        </div>
                `;

                if (linkedData && linkedData.tags && linkedData.tags.length > 0) {
                    tooltipHtml += `<span class="tt-tags">${linkedData.tags.join(', ')}</span>`;
                }
                
                if (linkedData && linkedData.imageUrl) {
                    tooltipHtml += `<img src="${linkedData.imageUrl}" class="tt-image" onerror="this.style.display='none'">`;
                }
                
                tooltipHtml += `</div>`;
            }

            els.tooltip.innerHTML = tooltipHtml;
            els.tooltip.classList.remove('hidden');
            
            const rect = target.getBoundingClientRect();
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            
            let left = rect.left;
            let top = isMobile ? (rect.top - 10) : (rect.bottom + 5);

            if (isMobile) {
                els.tooltip.classList.add('tt-mobile');
            } else {
                els.tooltip.classList.remove('tt-mobile');
            }

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
}

export function handleWordOut() {
    runtime.hoveredElement = null;
    els.tooltip.classList.add('hidden');
}