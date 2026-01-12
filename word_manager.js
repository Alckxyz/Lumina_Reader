import { dictionary, runtime } from './state.js';
import { els } from './dom.js';
import { getWordEffectiveData, processNodes, wrapWords } from './utils.js';
import { handleWordHover, handleWordOut } from './ui_utils.js';
import { openWordEditor } from './editor_manager.js';
import * as tts from './tts.js';

// removed function neutralizeVisibleBlueWords() {} (moved to selection_manager.js)

export async function refreshViewerHighlights(forceReWrap = false) {
    // Re-wrapping the whole page is only necessary if the tokenization changes
    // (e.g., a new multi-word phrase is added or one is removed).
    // For simple color/status changes, we update the classes of existing elements to avoid flicker.
    
    const updateEl = (el) => {
        const wordText = el.dataset.word;
        const effective = getWordEffectiveData(wordText);
        
        // Remove existing state classes but keep others like 'reader-word' or 'tts-highlight'
        const stateClasses = ['word-new', 'word-ignored', 'word-custom-0', 'word-custom-1', 'word-custom-2', 'word-custom-3', 'word-custom-4'];
        el.classList.remove(...stateClasses);
        
        if (effective.status === 'new') el.classList.add('word-new');
        else if (effective.status === 'ignored') el.classList.add('word-ignored');
        else if (effective.status === 'custom') el.classList.add(`word-custom-${effective.colorIdx}`);
    };

    if (forceReWrap) {
        if (runtime.currentFileType === 'epub' && runtime.rendition) {
            try {
                const contents = runtime.rendition.getContents()[0];
                const body = contents.document.body;
                // Safely unwrap existing highlights before re-processing
                body.querySelectorAll('.reader-word').forEach(el => {
                    const text = el.innerText;
                    el.replaceWith(contents.document.createTextNode(text));
                });
                processNodes(body, wrapWords);

                // Re-sync sentences for EPUB after structural change
                const loc = runtime.rendition.currentLocation();
                const offset = (loc && loc.start) ? Math.floor(loc.start.percentage * runtime.totalContentLength) : 0;
                tts.prepareSync(body, offset, runtime.totalContentLength);
            } catch(e){}
        } else if (runtime.pagedContent.length > 0) {
            const content = runtime.pagedContent[runtime.currentPage];
            // innerHTML causes visible flicker, so we only use it if forceReWrap is true
            els.viewer.innerHTML = `<div class="txt-content" id="paged-content">${wrapWords(content)}</div>`;
            
            // Re-apply styles immediately to avoid size jumping
            const { applyTextStyles } = await import('./reader_manager.js');
            applyTextStyles();

            const offset = runtime.pageOffsets[runtime.currentPage] || 0;
            tts.prepareSync(els.viewer, offset, runtime.totalContentLength);
        }
    } else {
        // Surgical class updates (Flicker-free)
        els.viewer.querySelectorAll('.reader-word').forEach(updateEl);
        if (runtime.rendition) {
            try {
                const body = runtime.rendition.getContents()[0].document.body;
                body.querySelectorAll('.reader-word').forEach(updateEl);
            } catch(e){}
        }
    }
}

// removed function handleWordHover() {} (moved to ui_utils.js)
// removed function handleWordOut() {} (moved to ui_utils.js)
// removed function handleSelection() {} (moved to selection_manager.js)
// removed function updateTagSuggestions() {} (moved to editor_manager.js)
// removed function updateLinkPreview() {} (moved to editor_manager.js)

let lastClickTime = 0;
let lastClickedWord = null;
let tapCount = 0;
let tapTimer = null;

export function handleWordClick(e) {
    const wordEl = (e.target && e.target.closest) ? e.target.closest('.reader-word') : null;

    // If this click is the result of a long press that already showed the action popup,
    // we ignore it to prevent it from interfering with tap/double-tap logic.
    // We only consume it if it's the SAME word that was long-pressed, or if no phrase is being selected.
    if (runtime.isLongPress) {
        runtime.isLongPress = false;
        if (!runtime.phraseStartWord || runtime.phraseStartWord === wordEl) {
            return;
        }
    }

    const target = wordEl || e.target;
    if (!target) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    if (isMobile) {
        // Phrase Selection Logic: Check if we are completing a phrase
        if (runtime.phraseStartWord && wordEl) {
            els.actionPopup.classList.add('hidden');
            els.actionPopup.classList.add('hidden');
            const startWord = runtime.phraseStartWord;
            const endWord = wordEl;
            
            // Logic to find words between start and end within the same document
            const doc = startWord.ownerDocument;
            const allWords = Array.from(doc.querySelectorAll('.reader-word'));
            const startIdx = allWords.indexOf(startWord);
            const endIdx = allWords.indexOf(endWord);

            if (startIdx !== -1 && endIdx !== -1) {
                const low = Math.min(startIdx, endIdx);
                const high = Math.max(startIdx, endIdx);
                const selection = allWords.slice(low, high + 1);
                const phraseText = selection.map(w => w.innerText).join(' ').replace(/\s+/g, ' ').trim();
                
                // Cleanup state before opening editor to prevent interaction conflicts
                startWord.classList.remove('phrase-selecting');
                runtime.phraseStartWord = null;

                if (phraseText.length > 0) {
                    openWordEditor(phraseText.toLowerCase(), phraseText);
                }
            } else {
                startWord.classList.remove('phrase-selecting');
                runtime.phraseStartWord = null;
            }
            return;
        }

        const now = Date.now();
        
        if (lastClickedWord === target && (now - lastClickTime) < 450) {
            tapCount++;
        } else {
            tapCount = 1;
        }
        
        lastClickTime = now;
        lastClickedWord = target;

        if (tapCount === 1) {
            if (wordEl) handleWordHover(e);
            
            // If user taps outside words while a phrase selection is pending, cancel it
            if (!wordEl && runtime.phraseStartWord) {
                runtime.phraseStartWord.classList.remove('phrase-selecting');
                runtime.phraseStartWord = null;
            }
        } else if (tapCount === 2) {
            // Double tap: Prepare to edit, but wait to see if it's a triple tap
            if (tapTimer) clearTimeout(tapTimer);
            tapTimer = setTimeout(() => {
                if (wordEl) {
                    handleWordOut();
                    openWordEditor(wordEl.dataset.word, wordEl.innerText);
                }
                tapCount = 0;
            }, 250);
        } else if (tapCount === 3) {
            // Triple tap: Seek audio
            if (tapTimer) clearTimeout(tapTimer);
            tapCount = 0;

            const viewerRect = els.viewer.getBoundingClientRect();
            let clickX = e.clientX;
            
            if (e.target.ownerDocument !== document) {
                const iframe = els.viewer.querySelector('iframe');
                if (iframe) {
                    const iRect = iframe.getBoundingClientRect();
                    clickX += iRect.left;
                }
            }

            const relativeX = clickX - viewerRect.left;
            const isLeftSide = relativeX < (viewerRect.width * 0.45); // Slightly wider target for triple tap

            if (isLeftSide) {
                const tapY = e.clientY;
                const ownerDoc = e.target.ownerDocument;
                const allWords = Array.from(ownerDoc.querySelectorAll('.reader-word'));
                
                let closestWord = null;
                let minDistance = Infinity;

                allWords.forEach(w => {
                    const rect = w.getBoundingClientRect();
                    const centerY = (rect.top + rect.bottom) / 2;
                    const distance = Math.abs(tapY - centerY);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestWord = w;
                    }
                });

                const targetToSeek = closestWord || wordEl || target;
                tts.seekToElement(targetToSeek);
                handleWordOut();
            }
        }
    } else if (wordEl) {
        // Desktop behavior: single click opens editor only if we aren't performing a multi-word selection
        const doc = e.target.ownerDocument || document;
        const sel = doc.getSelection();
        if (!sel || sel.isCollapsed) {
            openWordEditor(wordEl.dataset.word, wordEl.innerText);
        }
    }
}

// removed function openWordEditor() {} (moved to editor_manager.js)
// removed function renderColorSelection() {} (moved to editor_manager.js)
// removed function saveWordData() {} (moved to editor_manager.js)