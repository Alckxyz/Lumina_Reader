import { 
    createIcons, 
    FolderOpen, 
    FileText, 
    PackagePlus, 
    ChevronLeft, 
    ChevronRight, 
    Settings, 
    BookOpen, 
    Play, 
    Pause, 
    Square, 
    Pencil, 
    Plus, 
    Minus, 
    List,
    Languages,
    Copy,
    RotateCcw,
    RotateCw,
    Upload,
    Trash2,
    UploadCloud,
    RefreshCw,
    Check
} from 'lucide';
import { dictionary, appSettings, runtime, exportData, startFirebaseSync, persist } from './state.js';
import { els } from './dom.js';
import * as tts from './tts.js';
import * as wordManager from './word_manager.js';
import * as readerManager from './reader_manager.js';
import * as shortcuts from './shortcuts.js';
import * as uiUtils from './ui_utils.js';
import * as editorManager from './editor_manager.js';
import * as selectionManager from './selection_manager.js';
import * as wordListManager from './word_list_manager.js';
import * as settingsManager from './settings_manager.js';
import * as dataManager from './data_manager.js';
import * as ttsManager from './tts_manager.js';

// Initialize Lucide icons
const allIcons = { 
    UploadCloud,
    RefreshCw,
    FolderOpen, 
    FileText, 
    PackagePlus, 
    ChevronLeft, 
    ChevronRight, 
    Settings, 
    BookOpen, 
    Play, 
    Pause, 
    Square, 
    Pencil, 
    Plus, 
    Minus, 
    List,
    Languages,
    Copy,
    RotateCcw,
    RotateCw,
    Upload,
    Trash2,
    Check
};
createIcons({ icons: allIcons });

// Suppress known non-critical ResizeObserver loop error
window.addEventListener('error', (e) => {
    if (e.message && e.message.includes('ResizeObserver loop')) {
        e.stopImmediatePropagation();
        e.preventDefault();
    }
});

function init() {
    setupEventListeners();
    settingsManager.initSettingsUI();

    // Initialize Firebase Auth & Sync
    if (window.onAuthChange) {
        window.onAuthChange((user) => {
            els.authStatusContainer.innerHTML = '';
            if (user) {
                console.log("Logged in as:", user.displayName);
                
                // Show user avatar with logout option
                const userBtn = document.createElement('button');
                userBtn.className = 'user-profile-btn';
                userBtn.title = `Logged in as ${user.displayName}. Click to logout.`;
                userBtn.innerHTML = `<img src="${user.photoURL || `https://images.websim.com/avatar/${user.displayName}`}" alt="Profile">`;
                userBtn.onclick = () => {
                    if (confirm("Do you want to sign out?")) {
                        window.logoutFirebase();
                        window.location.reload(); // Refresh to clear state
                    }
                };
                els.authStatusContainer.appendChild(userBtn);

                // Start syncing data for this specific user
                startFirebaseSync(() => {
                    wordManager.refreshViewerHighlights();
                    settingsManager.renderColorSettings();
                    settingsManager.applyGlobalColors();
                    if (runtime.rendition) readerManager.applyTextStyles();
                    
                    // Sync Local UI elements to new remote settings
                    els.fontSizeSlider.value = appSettings.fontSize;
                    els.paragraphsSlider.value = appSettings.paragraphsPerPage;
                    els.paragraphsVal.innerText = appSettings.paragraphsPerPage;
                    const speed = appSettings.playbackRate || 1.0;
                    tts.setPlaybackRate(speed);
                    els.speedDisplay.innerText = `${speed.toFixed(1)}x`;
                });
            } else {
                // Show Login Button
                const loginBtn = document.createElement('button');
                loginBtn.className = 'google-login-compact';
                loginBtn.innerText = 'Login with Google';
                loginBtn.onclick = () => window.loginWithGoogle();
                els.authStatusContainer.appendChild(loginBtn);
            }
        });
    }

    // Handle mobile back button
    window.addEventListener('popstate', () => {
        uiUtils.closeAllOverlays();
    });
    
    // Initial UI Sync
    els.fontSizeSlider.value = appSettings.fontSize;
    els.paragraphsSlider.value = appSettings.paragraphsPerPage;
    els.paragraphsVal.innerText = appSettings.paragraphsPerPage;
    
    const speed = appSettings.playbackRate || 1.0;
    tts.setPlaybackRate(speed);
    els.speedDisplay.innerText = `${speed.toFixed(1)}x`;
    
    shortcuts.setupKeyboardShortcuts(
        ttsManager.toggleTTS, 
        () => tts.setPlaybackRate(appSettings.playbackRate), 
        (amt) => tts.skip(amt > 0 ? 5 : -5)
    );

    document.addEventListener('contextmenu', (e) => {
        if (window.matchMedia('(max-width: 768px)').matches) {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
            if (!isInput) e.preventDefault();
        }
    });
}

function setupEventListeners() {
    els.fileInput.addEventListener('change', readerManager.handleFileSelect);
    els.batchImportInput.addEventListener('change', dataManager.handleBatchImport);
    els.wordListBtn.addEventListener('click', wordListManager.openWordList);
    els.prevBtn.addEventListener('click', () => readerManager.navigate(-1, false));
    els.nextBtn.addEventListener('click', () => readerManager.navigate(1, true));
    els.settingsBtn.addEventListener('click', () => {
        uiUtils.pushModalState();
        els.settingsModal.classList.remove('hidden');
    });
    els.progressSlider.addEventListener('input', readerManager.handleSliderChange);
    
    document.querySelectorAll('.close-modal-btn, #close-settings, #close-word-list-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            els.settingsModal.classList.add('hidden');
            els.wordModal.classList.add('hidden');
            els.wordListModal.classList.add('hidden');
            settingsManager.applyGlobalColors();
            if (runtime.rendition) readerManager.applyTextStyles();
        });
    });

    els.speedUpBtn.addEventListener('click', () => ttsManager.updateSpeed(0.1));
    els.speedDownBtn.addEventListener('click', () => ttsManager.updateSpeed(-0.1));

    els.audioUpload.addEventListener('change', ttsManager.handleAudioFileUpload);

    els.wordLinkInput.addEventListener('input', editorManager.updateLinkPreview);
    els.wordTagsInput.addEventListener('input', editorManager.updateTagSuggestions);
    els.editLinkedWordBtn.addEventListener('click', () => {
        const linked = els.wordLinkInput.value.trim().toLowerCase();
        if (linked) {
            editorManager.saveWordData(false);
            editorManager.openWordEditor(linked);
        }
    });

    els.saveWordBtn.addEventListener('click', editorManager.saveWordData);

    // Close modals when clicking on the backdrop
    [els.settingsModal, els.wordModal, els.wordListModal, els.translationModal].forEach(modal => {
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            // If the click is exactly on the modal backdrop (not its children)
            if (e.target === modal) {
                modal.classList.add('hidden');
                // Ensure settings are applied if the settings modal is closed this way
                if (modal === els.settingsModal) {
                    settingsManager.applyGlobalColors();
                    if (runtime.rendition) readerManager.applyTextStyles();
                }
            }
        });
    });

    els.modalWordTitle.addEventListener('click', () => {
        navigator.clipboard.writeText(els.modalWordTitle.innerText);
        const originalColor = els.modalWordTitle.style.color;
        els.modalWordTitle.style.color = 'var(--secondary-color)';
        setTimeout(() => { els.modalWordTitle.style.color = originalColor; }, 200);
    });

    els.wordListSearch.addEventListener('input', (e) => {
        wordListManager.renderWordList(e.target.value);
    });

    els.wordListSort.addEventListener('change', () => {
        wordListManager.renderWordList(els.wordListSearch.value);
    });

    els.addWordManualBtn.addEventListener('click', () => {
        const word = prompt("Enter the word or phrase to add:");
        if (word && word.trim()) {
            editorManager.openWordEditor(word.trim().toLowerCase(), word.trim());
        }
    });

    const closeTranslation = () => els.translationModal.classList.add('hidden');
    els.closeTranslationModal.addEventListener('click', closeTranslation);
    els.closeTranslationBtn.addEventListener('click', closeTranslation);
    els.copyTranslationBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(els.translatedSentence.innerText);
    });

    if (window.matchMedia('(max-width: 768px)').matches) {
        readerManager.setupSwipeGestures(els.viewer, true);
        selectionManager.initTouchSelection(els.viewer, document);
    }

    els.viewer.addEventListener('scroll', () => {
        uiUtils.handleWordOut();
        uiUtils.updateHeaderVisibility(els.viewer.scrollTop);
    });

    document.addEventListener('selectionchange', () => {
        if (runtime.currentFileType !== 'epub') selectionManager.handleSelection(null, document);
    });

    els.viewer.addEventListener('click', (e) => wordManager.handleWordClick(e));
    els.viewer.addEventListener('mouseover', (e) => uiUtils.handleWordHover(e));
    els.viewer.addEventListener('mouseout', () => uiUtils.handleWordOut());

    document.addEventListener('click', (e) => {
        if (!els.wordLinkSuggestions.contains(e.target) && e.target !== els.wordLinkInput) els.wordLinkSuggestions.classList.add('hidden');
        if (!els.wordTagsSuggestions.contains(e.target) && e.target !== els.wordTagsInput) els.wordTagsSuggestions.classList.add('hidden');
        if (e.target !== els.selectionPopup && !els.viewer.contains(e.target)) els.selectionPopup.classList.add('hidden');
        if (!els.actionPopup.contains(e.target) && !e.target.closest('.reader-word')) els.actionPopup.classList.add('hidden');
        if (window.matchMedia('(max-width: 768px)').matches && !e.target.closest('.reader-word') && !els.tooltip.contains(e.target)) uiUtils.handleWordOut();
    });

    els.ttsPlayPauseBtn.addEventListener('click', ttsManager.toggleTTS);
    els.ttsRewindBtn.addEventListener('click', () => tts.skip(-5));
    els.ttsForwardBtn.addEventListener('click', () => tts.skip(5));

    const syncAll = async () => {
        if (els.syncProgressBtn.classList.contains('syncing') || els.syncProgressBtn.classList.contains('sync-success')) return;

        if (runtime.currentFileName) {
            if (!appSettings.progress[runtime.currentFileName]) appSettings.progress[runtime.currentFileName] = {};
            if (tts.ttsState.isLoaded) {
                appSettings.progress[runtime.currentFileName].lastAudioPosition = tts.ttsState.currentTime;
            }
        }
        
        els.syncProgressBtn.classList.add('syncing');
        
        try {
            await persist();
            
            // Sync Success Animation
            els.syncProgressBtn.classList.remove('syncing');
            els.syncProgressBtn.classList.add('sync-success');
            els.syncProgressBtn.innerHTML = '<i data-lucide="check"></i>';
            createIcons({ icons: { Check } });

            setTimeout(() => {
                els.syncProgressBtn.classList.remove('sync-success');
                els.syncProgressBtn.innerHTML = '<i data-lucide="upload-cloud"></i>';
                createIcons({ icons: { UploadCloud } });
            }, 2000);
        } catch (err) {
            console.error("Sync error:", err);
            els.syncProgressBtn.classList.remove('syncing');
        }
    };

    els.syncProgressBtn.addEventListener('click', syncAll);

    // Auto-sync on pause
    els.ttsPlayPauseBtn.addEventListener('click', () => {
        if (!tts.ttsState.isSpeaking) {
            syncAll();
        }
    });

    const AI_PROMPT_TEXT = `When I send you a SINGLE word:

- If the word is misspelled:
  wrong_word ❌ → corrected_word ✅
- If it is correct, say NOTHING about spelling.

- Start the answer using this format:
  word — type (noun, verb, adjective, tense, etc.)

- Identify the base form (dictionary form).
  - If the base form is the same, do NOT mention it.
  - If it is different, write:
    Base form: base_form

- If the base form and the exact word have the SAME meaning:
  → give ONLY ONE meaning and stop.

- If the meanings are DIFFERENT:
  Base form:
  meaning

  Exact word:
  meaning

- Do NOT number sections.
- Do NOT add explanations or extra text.
- Do NOT introduce idioms or phrasal verbs at this stage.

---

IDIOMS

- If I send a FULL sentence using the word:
  - Check if the word is part of an idiomatic expression in THAT sentence.
  - ONLY THEN show:

  Idiomatic expression (base form):
  Meaning:

- If no idiom appears in the sentence, do NOT mention idioms.

---

SYNONYM / PHRASE REPLACEMENT (USING *) — STRICT

- If I send * word1:
  - Replace the FIRST occurrence of that word in the LAST meaning you gave
    with ONE natural synonym.
  - The synonym MUST NOT be:
    - the original headword being defined
    - the same word being replaced

- If I send * word1, word2, word3:
  - Replace EACH listed word independently.
  - Use ONE appropriate synonym per word.
  - Keep the rest of the meaning unchanged.

- If I send * a full phrase:
  - Replace ONLY that exact phrase with a synonymous phrase.
  - The replacement must preserve the original meaning.
  - Do NOT rewrite the rest of the sentence.

- General rules for all * replacements:
  - Replace ONLY the specified word(s) or phrase.
  - Do NOT repeat the original word(s) or phrase.
  - Do NOT change word order outside the replacement.
  - Do NOT add or remove other words.
  - If a replacement is not possible, say:
    Cannot apply replacement.

---

If I send "+" alone:
- Give another meaning.

If I send "#":
- Give the same meaning in a different form.

---

FORMAT RULE (MANDATORY)

Always use this structure:

word — type

Base form: (only if different)
meaning

Exact word: (only if meanings are different)
meaning

Do NOT repeat labels.
Do NOT add extra text.`;

    els.copyAiPromptBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(AI_PROMPT_TEXT).then(() => {
            const originalText = els.copyAiPromptBtn.innerHTML;
            els.copyAiPromptBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;margin-right:8px;display:inline-block;vertical-align:middle;"></i> Copied!';
            createIcons({ icons: { Check } });
            setTimeout(() => {
                els.copyAiPromptBtn.innerHTML = originalText;
                createIcons({ icons: { Copy } });
            }, 2000);
        });
    });

    els.exportDataBtn.addEventListener('click', async () => {
        await syncAll();
        exportData();
    });
    els.importDataBtn.addEventListener('click', () => els.importDataInput.click());
    els.importDataInput.addEventListener('change', (e) => dataManager.handleImport(e.target.files[0]));
}

init();

// removed function handleImport() {}
// removed function handleBatchImport() {}
// removed function renderColorSettings() {}
// removed function applyGlobalColors() {}
// removed function toggleTTS() {}
// removed function restartTTSAtCurrent() {}
// removed function skipTTS() {}