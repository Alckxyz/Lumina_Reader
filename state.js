export const DEFAULT_SETTINGS = {
    fontSize: 18,
    paragraphsPerPage: (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) ? 5 : 6,
    colors: ['#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#2ecc71'],
    playbackRate: 1.0,
    progress: {} // Keyed by filename
};

const STORE_KEY = 'lumina_reader_state';

function loadStoredState() {
    // Data is no longer loaded from localStorage as per user request.
    // Use the "Import" button to load your saved progress.
    return { dictionary: {}, settings: { ...DEFAULT_SETTINGS } };
}

const initial = loadStoredState();
export let dictionary = initial.dictionary;
export let appSettings = initial.settings;

let isSyncing = false;

export function persist() {
    if (isSyncing) return Promise.resolve(); // Prevent loop during incoming sync
    if (window.saveToFirebase) {
        return window.saveToFirebase({
            dictionary,
            appSettings
        });
    }
    return Promise.resolve();
}

export function startFirebaseSync(onUpdate) {
    if (window.listenFromFirebase) {
        // We wrap the Firebase listener. This will be called whenever Auth state changes
        // and we specifically call startFirebaseSync in app.js after auth is confirmed.
        window.listenFromFirebase((data) => {
            if (!data) return;
            isSyncing = true;
            if (data.dictionary) {
                // Clear and replace to maintain references
                for (const key in dictionary) delete dictionary[key];
                Object.assign(dictionary, data.dictionary);
            }
            if (data.appSettings) {
                // Merge settings to preserve any local-only runtime state if needed
                Object.assign(appSettings, data.appSettings);
            }
            if (onUpdate) onUpdate();
            isSyncing = false;
        });
    }
}

// Runtime State (Not persisted/exported)
export const runtime = {
    currentBook: null,
    rendition: null,
    currentFileType: null,
    currentFileName: null,
    rawTextSource: "",
    pagedContent: [], 
    currentPage: 0,
    currentWord: null,
    hoveredElement: null,
    phraseStartWord: null, // Track the word that started a multi-word selection
    isLongPress: false, // Flag to indicate if the current interaction was a long press
    colorChangedInEditor: false, // Flag to track if the user manually clicked a color bubble
    totalContentLength: 0,
    pageOffsets: [] // Starting character index for each page/section
};

export function setDictionary(newDict) { dictionary = newDict; }
export function setSettings(newSettings) { appSettings = newSettings; }

export function exportData() {
    // 1. Sort dictionary alphabetically and filter ignored words
    const sortedDict = {};
    const keys = Object.keys(dictionary)
        .filter(word => dictionary[word].status !== 'ignored')
        .sort();
        
    for (const key of keys) {
        sortedDict[key] = dictionary[key];
    }

    // 2. Separate sync data (progress) from general settings for a cleaner structure
    const { progress, ...prefs } = appSettings;

    const exportObj = {
        dictionary: sortedDict,
        audio_text_sync: progress || {},
        app_preferences: prefs
    };

    // Use null, 2 for readable indentation (one word/property per row)
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

export function importData(jsonString) {
    try {
        const imported = JSON.parse(jsonString);
        
        // Handle Dictionary
        if (imported.dictionary) {
            Object.assign(dictionary, imported.dictionary);
        }
        
        // Handle Settings & Sync (Support both old and new "ordered" formats)
        const settingsToLoad = imported.app_preferences || imported.settings;
        if (settingsToLoad) {
            Object.assign(appSettings, { ...DEFAULT_SETTINGS, ...settingsToLoad });
        }
        
        // Load sync data from dedicated field or legacy progress field
        const syncToLoad = imported.audio_text_sync || (imported.settings ? imported.settings.progress : null);
        if (syncToLoad) {
            appSettings.progress = { ...appSettings.progress, ...syncToLoad };
        }

        // Clean up legacy global progress if it exists in very old files
        if (!appSettings.progress) appSettings.progress = {};
        delete appSettings.lastAudioPosition;
        delete appSettings.lastPage;
        delete appSettings.lastCfi;
        
        return true;
    } catch (err) {
        console.error("Import error:", err);
        return false;
    }
}