import { dictionary, runtime } from './state.js';
import { els } from './dom.js';
import { refreshViewerHighlights } from './word_manager.js';
import { openWordEditor } from './editor_manager.js';
import { showTranslation } from './shortcuts.js';
import { pushModalState } from './ui_utils.js';
import * as tts from './tts.js';

let longPressTimer = null;

export function initTouchSelection(container, ownerDocument = document) {
    if (container._touchSelectionInitialized) return;
    container._touchSelectionInitialized = true;

    const getWordAtPoint = (clientX, clientY) => {
        // clientX/Y from a touch event inside an iframe are already relative to that iframe's viewport.
        const el = ownerDocument.elementFromPoint(clientX, clientY);
        return el ? el.closest('.reader-word') : null;
    };

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        
        // If we're mid-phrase selection, we don't start a new long press timer,
        // but we ensure the longPress flag is cleared so the next tap is treated as a normal click.
        if (runtime.phraseStartWord) {
            runtime.isLongPress = false;
            return;
        }

        // Reset long press state and hide existing popups on new interaction
        runtime.isLongPress = false;
        if (!els.actionPopup.classList.contains('hidden')) {
            els.actionPopup.classList.add('hidden');
        }

        const touch = e.touches[0];
        const word = getWordAtPoint(touch.clientX, touch.clientY);
        
        if (word) {
            const startX = touch.clientX;
            const startY = touch.clientY;

            longPressTimer = setTimeout(() => {
                runtime.isLongPress = true;
                if (window.navigator.vibrate) window.navigator.vibrate(40);
                
                // Clear any previous selection markers
                document.querySelectorAll('.phrase-selecting').forEach(el => el.classList.remove('phrase-selecting'));
                if (runtime.rendition) {
                    try {
                        const body = runtime.rendition.getContents()[0].document.body;
                        body.querySelectorAll('.phrase-selecting').forEach(el => el.classList.remove('phrase-selecting'));
                    } catch(e){}
                }

                runtime.phraseStartWord = word;
                word.classList.add('phrase-selecting');
                
                // Show Action Popup (Translate/Copy Sentence)
                const sentence = tts.getSentenceAtElement(word);
                if (sentence) {
                    const rect = word.getBoundingClientRect();
                    let top = rect.top - 75;
                    let left = rect.left + (rect.width / 2);

                    if (ownerDocument !== document) {
                        const iframe = document.querySelector('iframe');
                        if (iframe) {
                            const iRect = iframe.getBoundingClientRect();
                            top += iRect.top;
                            left += iRect.left;
                        }
                    }

                    // Keep within screen bounds
                    top = Math.max(10, top);
                    
                    els.actionPopup.style.top = `${top}px`;
                    els.actionPopup.style.left = `${left}px`;
                    pushModalState();
                    els.actionPopup.classList.remove('hidden');
                    els.selectionPopup.classList.add('hidden'); // Hide Create Phrase if it was visible

                    // Setup buttons
                    els.actionTranslateBtn.onclick = (ev) => {
                        ev.stopPropagation();
                        showTranslation(sentence.text.trim());
                        els.actionPopup.classList.add('hidden');
                    };
                    els.actionCopyBtn.onclick = (ev) => {
                        ev.stopPropagation();
                        const cleanedText = sentence.text
                            .replace(/["“”]/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                        navigator.clipboard.writeText(cleanedText);
                        els.actionPopup.classList.add('hidden');
                        sentence.elements.forEach(el => el.classList.add('sentence-copy-flash'));
                        setTimeout(() => {
                            sentence.elements.forEach(el => el.classList.remove('sentence-copy-flash'));
                        }, 400);
                    };
                }

                longPressTimer = null;
            }, 850); // Increased delay to ensure it's a deliberate long press
            
            // Cancel long-press on significant movement
            const moveHandler = (me) => {
                const mt = me.touches[0];
                if (Math.abs(mt.clientX - startX) > 15 || Math.abs(mt.clientY - startY) > 15) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                    container.removeEventListener('touchmove', moveHandler);
                }
            };
            
            const cleanup = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                container.removeEventListener('touchmove', moveHandler);
                container.removeEventListener('touchend', cleanup);
                container.removeEventListener('touchcancel', cleanup);
            };

            container.addEventListener('touchmove', moveHandler, { passive: true });
            container.addEventListener('touchend', cleanup, { passive: true });
            container.addEventListener('touchcancel', cleanup, { passive: true });
        }
    }, { passive: true });
}

export function neutralizeVisibleBlueWords() {
    const protectedWords = new Set();
    
    const checkSelection = (win) => {
        try {
            const sel = win.getSelection();
            if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const parent = container.nodeType === 1 ? container : container.parentNode;
                const allWords = Array.from(parent.querySelectorAll('.reader-word'));
                const selectedInContext = allWords.filter(w => sel.containsNode(w, true));
                if (selectedInContext.length > 1) {
                    selectedInContext.forEach(w => protectedWords.add(w));
                }
            }
        } catch (err) {}
    };

    checkSelection(window);
    if (runtime.rendition) {
        try {
            const contents = runtime.rendition.getContents()[0];
            if (contents && contents.window) checkSelection(contents.window);
        } catch(e){}
    }

    const wordsInViewer = Array.from(els.viewer.querySelectorAll('.reader-word.word-new'));
    let wordsInEpub = [];
    if (runtime.rendition) {
        try {
            const body = runtime.rendition.getContents()[0].document.body;
            wordsInEpub = Array.from(body.querySelectorAll('.reader-word.word-new'));
        } catch(e){}
    }
    
    [...wordsInViewer, ...wordsInEpub].forEach(el => {
        if (protectedWords.has(el)) return;
        const wordText = el.dataset.word;
        if (!dictionary[wordText] || dictionary[wordText].status === 'new') {
            dictionary[wordText] = { ...dictionary[wordText], status: 'neutral' };
        }
    });
    refreshViewerHighlights();
}

export function handleSelection(e, ownerDocument = document) {
    const selection = ownerDocument.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        els.selectionPopup.classList.add('hidden');
        return;
    }

    // Auto-expand selection to full words if boundaries are partial (Desktop & Mobile)
    let range = selection.getRangeAt(0);
    const getWordContainer = (node) => {
        if (!node) return null;
        const el = node.nodeType === 3 ? node.parentElement : node;
        return el.closest ? el.closest('.reader-word') : null;
    };

    let startWord = getWordContainer(range.startContainer);
    let endWord = getWordContainer(range.endContainer);

    if (startWord || endWord) {
        const newRange = ownerDocument.createRange();
        if (startWord) newRange.setStartBefore(startWord);
        else newRange.setStart(range.startContainer, range.startOffset);
        
        if (endWord) newRange.setEndAfter(endWord);
        else newRange.setEnd(range.endContainer, range.endOffset);
        
        // Compare to current range to avoid infinite update loops
        if (newRange.startContainer !== range.startContainer || 
            newRange.startOffset !== range.startOffset || 
            newRange.endContainer !== range.endContainer || 
            newRange.endOffset !== range.endOffset) {
            selection.removeAllRanges();
            selection.addRange(newRange);
            range = newRange; // Update reference for logic below
        }
    }

    const container = range.commonAncestorContainer;
    const parent = container.nodeType === 1 ? container : container.parentNode;
    
    // Robust search for words inside selection
    const allWords = Array.from(parent.querySelectorAll('.reader-word'));
    const selectedWords = allWords.filter(w => selection.containsNode(w, true));

    if (selectedWords.length > 1) {
        const text = selection.toString().trim();
        if (text.length >= 2) {
            const rects = range.getClientRects();
            if (rects.length > 0) {
                const isMobile = window.matchMedia('(max-width: 768px)').matches;
                const firstRect = rects[0];
                const lastRect = rects[rects.length - 1];
                
                let top, left;
                if (isMobile) {
                    // Moved above as per user request (was below to avoid native toolbars)
                    top = firstRect.top - 50;
                    left = lastRect.left + (lastRect.width / 2);
                } else {
                    // Position above on desktop
                    top = firstRect.top - 45;
                    left = firstRect.left + (firstRect.width / 2);
                }

                if (ownerDocument !== document) {
                    const iframe = els.viewer.querySelector('iframe');
                    if (iframe) {
                        const iframeRect = iframe.getBoundingClientRect();
                        top += iframeRect.top;
                        left += iframeRect.left;
                    }
                }

                els.selectionPopup.style.top = `${top}px`;
                els.selectionPopup.style.left = `${left}px`;
                pushModalState();
                els.selectionPopup.classList.remove('hidden');
                els.actionPopup.classList.add('hidden'); // User instruction: hide translate/copy if phrase selection appears
                
                els.selectionPopup.onclick = (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    els.actionPopup.classList.add('hidden');
                    openWordEditor(text.toLowerCase(), text);
                    els.selectionPopup.classList.add('hidden');
                    selection.removeAllRanges();
                };
                return;
            }
        }
    }
    
    els.selectionPopup.classList.add('hidden');
}