import { dictionary, runtime, appSettings, persist } from './state.js';
import { els } from './dom.js';
import { navigate, updatePageDisplay } from './reader_manager.js';
import { refreshViewerHighlights } from './word_manager.js';
import { pushModalState } from './ui_utils.js';
import * as tts from './tts.js';

export async function showTranslation(text) {
    pushModalState();
    els.translationModal.classList.remove('hidden');
    els.translationLoading.classList.remove('hidden');
    els.translationContainer.classList.add('hidden');
    // Hide original text and divider as per requirement to show only translated text
    els.originalSentence.classList.add('hidden');
    const divider = els.translationModal.querySelector('.translation-divider');
    if (divider) divider.classList.add('hidden');

    els.translatedSentence.innerText = '';

    try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`);
        const data = await response.json();
        
        if (data.responseData && data.responseData.translatedText) {
            // Clean output: remove quotes, collapse all whitespace/newlines to a single space, and trim
            const cleanedText = data.responseData.translatedText
                .replace(/["“”]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            els.translatedSentence.innerText = cleanedText;
        } else {
            throw new Error("Translation failed");
        }
        
        els.translationLoading.classList.add('hidden');
        els.translationContainer.classList.remove('hidden');
    } catch (err) {
        console.error("Translation error:", err);
        els.translatedSentence.innerText = "Error during translation. Please try again.";
        els.translationLoading.classList.add('hidden');
        els.translationContainer.classList.remove('hidden');
    }
}

export function setupKeyboardShortcuts(onToggleTTS, onRestartTTS, onSkipTTS) {
    window.addEventListener('keydown', async (e) => {
        if (!e.key) return;
        const key = e.key.toLowerCase();

        if (key === 'escape') {
            els.settingsModal.classList.add('hidden');
            els.translationModal.classList.add('hidden');
            els.wordModal.classList.add('hidden');
            els.wordListModal.classList.add('hidden');
            if (!els.syncToolModal.classList.contains('hidden')) {
                els.syncToolModal.classList.add('hidden');
                tts.setPlaybackRate(appSettings.playbackRate);
            }
            els.tooltip.classList.add('hidden');
            els.selectionPopup.classList.add('hidden');
            els.wordTagsSuggestions.classList.add('hidden');
            els.wordLinkSuggestions.classList.add('hidden');
            return;
        }
        
        // Global Action Shortcuts
        if (key === ' ') {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) return;
            e.preventDefault();
            onToggleTTS();
            return;
        }
        if (key === 'e') {
            const current = tts.ttsState.playbackRate;
            const nextVal = Math.min(4, current + 0.1);
            const rounded = Math.round(nextVal * 10) / 10;
            tts.setPlaybackRate(rounded);
            appSettings.playbackRate = rounded;
            els.speedDisplay.innerText = `${rounded.toFixed(1)}x`;
            return;
        }
        if (key === 'q') {
            const current = tts.ttsState.playbackRate;
            const nextVal = Math.max(0.1, current - 0.1);
            const rounded = Math.round(nextVal * 10) / 10;
            tts.setPlaybackRate(rounded);
            appSettings.playbackRate = rounded;
            els.speedDisplay.innerText = `${rounded.toFixed(1)}x`;
            return;
        }
        if (key === 'd') { onSkipTTS(50); return; } // Rough approximation of 5s skip
        if (key === 'a') { onSkipTTS(-50); return; }
        if (key === 'arrowright') { navigate(1, true); return; }
        if (key === 'arrowleft') { navigate(-1, false); return; }
        if (key === 'r') {
            if (runtime.hoveredElement) {
                tts.seekToElement(runtime.hoveredElement);
            }
            return;
        }

        if (key === 'c') {
            if (runtime.hoveredElement) {
                const sentence = tts.getSentenceAtElement(runtime.hoveredElement);
                if (sentence) {
                    const cleanedText = sentence.text
                        .replace(/["“”]/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    navigator.clipboard.writeText(cleanedText);
                    
                    // Visual feedback: flash effect
                    sentence.elements.forEach(el => el.classList.add('sentence-copy-flash'));
                    setTimeout(() => {
                        sentence.elements.forEach(el => el.classList.remove('sentence-copy-flash'));
                    }, 400);
                }
            }
            return;
        }

        if (key === 't') {
            if (runtime.hoveredElement) {
                const sentence = tts.getSentenceAtElement(runtime.hoveredElement);
                if (sentence) {
                    showTranslation(sentence.text.trim());
                }
            }
            return;
        }

        if (key === 'p') {
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
                const text = sel.toString().trim();
                if (text.length >= 2) {
                    const { openWordEditor } = await import('./editor_manager.js');
                    openWordEditor(text.toLowerCase(), text);
                }
            }
            return;
        }

        if (!runtime.hoveredElement) return;
        const word = runtime.hoveredElement.dataset.word;
        
        // Find the target to update (either the word or its root if sharing color)
        let targetWord = word;
        let data = dictionary[word] || { status: 'new', colorIdx: 0, meaning: '', tags: [], linked: '', shareColor: true };
        
        if (data.linked && data.shareColor && dictionary[data.linked]) {
            targetWord = data.linked;
            data = dictionary[targetWord];
        }

        const now = Date.now();
        const createdAt = data.created_at || now;

        let updated = false;
        if (key === 'x') { dictionary[targetWord] = { ...data, status: 'neutral', updated_at: now, created_at: createdAt }; updated = true; }
        else if (key === 'y') { 
            // Toggle ignored status or set it
            if (data.status === 'ignored') {
                dictionary[targetWord] = { ...data, status: 'new', updated_at: now, created_at: createdAt };
            } else {
                dictionary[targetWord] = { ...data, status: 'ignored', updated_at: now, created_at: createdAt }; 
            }
            updated = true; 
        }
        else if (key === 'z') { dictionary[targetWord] = { ...data, status: 'new', updated_at: now, created_at: createdAt }; updated = true; }
        else if (['1', '2', '3', '4', '5'].includes(key)) {
            dictionary[targetWord] = { ...data, status: 'custom', colorIdx: parseInt(key) - 1, updated_at: now, created_at: createdAt };
            updated = true;
        } else if (key === 'w') {
            dictionary[targetWord] = { ...data, status: 'custom', colorIdx: data.status === 'custom' ? (data.colorIdx + 1) % 5 : 0, updated_at: now, created_at: createdAt };
            updated = true;
        } else if (key === 's') {
            dictionary[targetWord] = { ...data, status: 'custom', colorIdx: data.status === 'custom' ? (data.colorIdx - 1 + 5) % 5 : 4, updated_at: now, created_at: createdAt };
            updated = true;
        }

        if (updated) {
            refreshViewerHighlights();
            persist();
        }
    });
}