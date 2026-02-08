import { appSettings, runtime, persist, DEFAULT_SETTINGS, dictionary } from './state.js';
import { els } from './dom.js';
import * as reader from './reader.js';
import * as tts from './tts.js';
import * as wordManager from './word_manager.js';
import * as readerManager from './reader_manager.js';
import { renderColorSettings, applyGlobalColors } from './settings_manager.js';

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
            // Clear current dictionary while keeping reference
            for (const key in dictionary) delete dictionary[key];
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

export async function handleImport(file, silent = false) {
    if (!file) return;
    const content = await reader.loadTxt(file);
    if (importData(content)) {
        els.fontSizeSlider.value = appSettings.fontSize;
        els.paragraphsSlider.value = appSettings.paragraphsPerPage || 10;
        els.paragraphsVal.innerText = els.paragraphsSlider.value;
        applyGlobalColors();
        
        const speed = appSettings.playbackRate || 1.0;
        tts.setPlaybackRate(speed);
        els.speedDisplay.innerText = `${speed.toFixed(1)}x`;

        wordManager.refreshViewerHighlights();
        renderColorSettings();
        els.ttsBar.classList.remove('hidden');

        const fileProgress = runtime.currentFileName ? appSettings.progress[runtime.currentFileName] : null;

        if (fileProgress && fileProgress.lastAudioPosition > 0 && tts.ttsState.isLoaded) {
            tts.seekToTime(fileProgress.lastAudioPosition);
        }

        if (runtime.currentFileType === 'epub' && runtime.rendition) {
            runtime.rendition.clear();
            const displayPos = fileProgress ? fileProgress.lastCfi : undefined;
            runtime.rendition.display(displayPos);
        } else if (runtime.pagedContent.length > 0) {
            readerManager.repaginateManualContent();
            if (fileProgress && fileProgress.lastPage !== undefined && fileProgress.lastPage < runtime.pagedContent.length) {
                runtime.currentPage = fileProgress.lastPage;
                readerManager.renderPage();
            }
        }
        els.settingsModal.classList.add('hidden');
        if (!silent) alert('Data imported successfully!');
    } else {
        if (!silent) alert('Invalid file format.');
    }
}

export async function handleBatchImport(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Categorize files
    const bookExts = ['epub', 'pdf', 'txt', 'srt'];
    const audioExts = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'webm'];
    
    const bookFile = files.find(f => bookExts.includes(f.name.split('.').pop().toLowerCase()));
    const audioFile = files.find(f => audioExts.includes(f.name.split('.').pop().toLowerCase()));
    const dataFile = files.find(f => f.name.toLowerCase().endsWith('.json'));

    // Process in order: Book -> Audio -> Data
    if (bookFile) {
        await readerManager.loadFile(bookFile);
    }

    if (audioFile) {
        const fileName = audioFile.name.substring(0, audioFile.name.lastIndexOf('.')) || audioFile.name;
        if (!runtime.currentFileName) runtime.currentFileName = fileName;
        els.audioFilename.textContent = audioFile.name;
        tts.setAudioSource(audioFile);
        
        const fileProgress = appSettings.progress[runtime.currentFileName];
        if (fileProgress && fileProgress.lastAudioPosition > 0) {
            tts.seekToTime(fileProgress.lastAudioPosition);
        }

        let container = els.viewer;
        let offset = 0;
        if (runtime.currentFileType === 'epub' && runtime.rendition) {
            try { 
                container = runtime.rendition.getContents()[0].document.body;
                const loc = runtime.rendition.currentLocation();
                offset = (loc && loc.start) ? Math.floor(loc.start.percentage * runtime.totalContentLength) : 0;
            } catch(err){}
        } else {
            offset = runtime.pageOffsets[runtime.currentPage] || 0;
        }
        tts.prepareSync(container, offset, runtime.totalContentLength);
    }

    if (dataFile) {
        await handleImport(dataFile, true);
    }


}