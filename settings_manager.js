import { appSettings, persist } from './state.js';
import { els } from './dom.js';
import * as readerManager from './reader_manager.js';

export function renderColorSettings() {
    els.colorGrid.innerHTML = '';
    appSettings.colors.forEach((color, i) => {
        const div = document.createElement('div');
        div.className = 'color-input-group';
        div.innerHTML = `<label>Custom ${i+1}</label><input type="color" value="${color}" data-idx="${i}">`;
        div.querySelector('input').onchange = (e) => {
            appSettings.colors[i] = e.target.value;
            applyGlobalColors();
            if (window.runtime && window.runtime.rendition) readerManager.applyTextStyles();
            persist();
        };
        els.colorGrid.appendChild(div);
    });
}

export function applyGlobalColors() {
    appSettings.colors.forEach((color, i) => {
        document.documentElement.style.setProperty(`--color-custom-${i}`, color);
    });
}

export function initSettingsUI() {
    els.fontSizeSlider.addEventListener('input', (e) => {
        appSettings.fontSize = parseInt(e.target.value);
        readerManager.applyTextStyles();
        persist();
    });

    els.paragraphsSlider.addEventListener('input', (e) => {
        appSettings.paragraphsPerPage = parseInt(e.target.value);
        els.paragraphsVal.innerText = e.target.value;
        if (window.runtime && window.runtime.currentFileType !== 'epub' && window.runtime.currentFileType !== null) {
            readerManager.repaginateManualContent();
        }
        persist();
    });

    renderColorSettings();
    applyGlobalColors();
}