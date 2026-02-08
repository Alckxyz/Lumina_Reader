export const modalTemplates = {
    syncTool: `
        <div id="sync-tool-modal" class="modal hidden">
            <div class="modal-content sync-tool-content">
                <div class="modal-header">
                    <h3>Manual Sync Tool</h3>
                    <button id="close-sync-tool-modal" class="close-modal-btn">&times;</button>
                </div>
                <div class="sync-tool-body">
                    <p class="setting-hint">Play the audio and click "Mark Next" (or press Space) when you hear the next line start.</p>
                    <div class="sync-controls-top">
                        <div class="sync-playback-controls">
                            <button id="sync-play-pause" class="play-btn"><i data-lucide="play"></i></button>
                            <div class="speed-control">
                                <button id="sync-speed-down" class="icon-btn mini" title="Slower"><i data-lucide="minus"></i></button>
                                <span id="sync-speed-display">2.5x</span>
                                <button id="sync-speed-up" class="icon-btn mini" title="Faster"><i data-lucide="plus"></i></button>
                            </div>
                            <span id="sync-time-display">00:00</span>
                        </div>
                    </div>
                    <div id="sync-segments-container" class="sync-segments-list"></div>
                    <div class="sync-controls-bottom">
                        <div style="display: flex; gap: 10px; flex-direction: column;">
                            <div style="display: flex; gap: 10px;">
                                <button id="sync-undo-btn" class="secondary-btn" style="flex: 0 0 60px; display: flex; align-items: center; justify-content: center;" title="Undo Last Mark">
                                    <i data-lucide="undo-2"></i>
                                </button>
                                <button id="sync-mark-btn" class="primary-btn sync-big-btn" style="flex: 1;">
                                    <i data-lucide="timer" style="margin-right: 8px;"></i>
                                    MARK NEXT
                                </button>
                            </div>
                            <button id="sync-auto-btn" class="secondary-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; font-weight: 600;">
                                <i data-lucide="sparkles"></i>
                                Auto-Sync with Browser Voice
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="sync-reset-btn" class="secondary-btn">Reset Timings</button>
                    <button id="sync-export-srt-btn" class="primary-btn">Download .SRT</button>
                </div>
            </div>
        </div>
    `,
    settings: `
        <div id="settings-modal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Settings</h3>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div class="setting-item">
                    <label>Font Size</label>
                    <input type="range" id="font-size-slider" min="12" max="32" value="18">
                </div>
                <div class="setting-item">
                    <label>Paragraphs per Page (TXT/PDF)</label>
                    <input type="range" id="paragraphs-per-page-slider" min="1" max="50" value="6">
                    <span id="paragraphs-val" style="font-size: 0.8rem; color: var(--text-muted);">6</span>
                </div>
                <div class="setting-section">
                    <h4>Learning Colors (5 Custom)</h4>
                    <div id="custom-colors-grid" class="colors-grid"></div>
                </div>
                <div class="setting-section">
                    <h4>Data Management (Session Only)</h4>
                    <p class="setting-hint">Data is NOT saved automatically to browser. Export to save permanently.</p>
                    <div class="data-actions">
                        <button id="export-data" class="secondary-btn">Export All Data</button>
                        <button id="import-data-btn" class="secondary-btn">Import All Data</button>
                        <input type="file" id="import-data-input" accept=".json" hidden>
                    </div>
                </div>
                <div class="setting-section">
                    <h4>AI Assistance</h4>
                    <p class="setting-hint">Copy the specialized prompt for your AI assistant.</p>
                    <button id="copy-ai-prompt-btn" class="secondary-btn" style="width: 100%;">
                        <i data-lucide="copy" style="width:14px;height:14px;margin-right:8px;display:inline-block;vertical-align:middle;"></i>
                        Copy AI Dictionary Prompt
                    </button>
                </div>
                <button id="close-settings" class="primary-btn">Save & Close</button>
            </div>
        </div>
    `,
    translation: `
        <div id="translation-modal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Translation</h3>
                    <button id="close-translation-modal" class="close-modal-btn">&times;</button>
                </div>
                <div id="translation-loading" class="loading-spinner hidden">Translating...</div>
                <div id="translation-container">
                    <p id="original-sentence" class="original-text"></p>
                    <div class="translation-divider"></div>
                    <p id="translated-sentence" class="translated-text"></p>
                </div>
                <div class="modal-actions">
                    <button id="copy-translation-btn" class="secondary-btn">Copy Translation</button>
                    <button id="close-translation-btn" class="primary-btn">Close</button>
                </div>
            </div>
        </div>
    `,
    wordList: `
        <div id="word-list-modal" class="modal hidden">
            <div class="modal-content word-list-modal-content">
                <div class="modal-header">
                    <h3>Saved Words</h3>
                    <button id="close-word-list-modal" class="close-modal-btn">&times;</button>
                </div>
                <div class="word-list-controls">
                    <div class="word-list-search-row">
                        <input type="text" id="word-list-search" placeholder="Search words or meanings...">
                        <button id="add-word-manual-btn" class="icon-btn small highlight-btn" title="Add Word Manually">
                            <i data-lucide="plus"></i>
                        </button>
                    </div>
                    <div class="word-list-sort-row">
                        <span>Sort by:</span>
                        <select id="word-list-sort">
                            <option value="alpha">Name (A-Z)</option>
                            <option value="newest">Latest Created</option>
                            <option value="updated">Recently Modified</option>
                        </select>
                    </div>
                </div>
                <div id="word-list-container" class="word-list-container"></div>
                <div class="modal-actions">
                    <button id="close-word-list-btn" class="primary-btn">Close</button>
                </div>
            </div>
        </div>
    `,
    wordInfo: `
        <div id="word-modal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                        <h3 id="modal-word-title" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;" title="Click to copy">Word</h3>
                        <button id="translate-word-btn" class="icon-btn small" title="Translate word to Spanish" style="padding: 4px; color: var(--secondary-color);">
                            <i data-lucide="languages" style="width: 18px; height: 18px;"></i>
                        </button>
                    </div>
                    <button id="close-word-modal" class="close-modal-btn">&times;</button>
                </div>
                <div class="word-form">
                    <div class="form-item">
                        <label>Status Color</label>
                        <div id="word-color-selector" class="color-bubbles"></div>
                    </div>
                    <div class="form-item">
                        <label>Meaning</label>
                        <input type="text" id="word-meaning" placeholder="Translate or define...">
                    </div>
                    <div class="form-item">
                        <label>Image URL (Optional)</label>
                        <input type="text" id="word-image-url" placeholder="Paste image link...">
                    </div>
                    <div class="form-item" style="position: relative;">
                        <label>Tags (comma separated)</label>
                        <input type="text" id="word-tags" placeholder="e.g. verb, essential, difficult" autocomplete="off">
                        <div id="word-tags-suggestions" class="autocomplete-list hidden"></div>
                    </div>
                    <div class="form-item" style="position: relative;">
                        <label>Base form</label>
                        <div class="input-with-action">
                            <input type="text" id="word-link" placeholder="e.g. cats -> cat" autocomplete="off">
                            <button id="edit-linked-word" class="icon-btn small" title="Edit base form"><i data-lucide="pencil"></i></button>
                        </div>
                        <div id="word-link-suggestions" class="autocomplete-list hidden"></div>
                        <span id="linked-meaning-preview" style="font-size: 0.75rem; color: var(--secondary-color); margin-top: 2px; min-height: 1em;"></span>
                    </div>
                    <div class="form-item checkbox-item">
                        <input type="checkbox" id="word-share-color" checked>
                        <label for="word-share-color">Share color with linked word</label>
                    </div>
                    <div class="modal-actions">
                        <button id="save-word-data" class="primary-btn">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `
};

export function injectModals() {
    const container = document.createElement('div');
    container.id = 'modal-container';
    container.innerHTML = Object.values(modalTemplates).join('');
    document.body.appendChild(container);
}