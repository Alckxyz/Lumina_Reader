import { dictionary, runtime, appSettings, persist } from './state.js';
import { els } from './dom.js';
import { refreshViewerHighlights } from './word_manager.js';
import { pushModalState } from './ui_utils.js';

export function updateTagSuggestions() {
    const input = els.wordTagsInput.value;
    const parts = input.split(',').map(p => p.trim());
    const currentPart = parts[parts.length - 1].toLowerCase();

    if (currentPart.length > 0) {
        const allTags = [...new Set(Object.values(dictionary).flatMap(d => d.tags || []))];
        const matches = allTags
            .filter(t => t.toLowerCase().includes(currentPart) && !parts.slice(0, -1).includes(t))
            .slice(0, 10);

        if (matches.length > 0) {
            els.wordTagsSuggestions.innerHTML = '';
            matches.forEach(m => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.innerHTML = `<span>${m}</span>`;
                item.onclick = () => {
                    parts[parts.length - 1] = m;
                    els.wordTagsInput.value = parts.join(', ') + ', ';
                    els.wordTagsSuggestions.classList.add('hidden');
                    els.wordTagsInput.focus();
                };
                els.wordTagsSuggestions.appendChild(item);
            });
            els.wordTagsSuggestions.classList.remove('hidden');
        } else {
            els.wordTagsSuggestions.classList.add('hidden');
        }
    } else {
        els.wordTagsSuggestions.classList.add('hidden');
    }
}

export function updateLinkPreview() {
    const word = runtime.currentWord;
    const query = els.wordLinkInput.value.trim().toLowerCase();
    
    if (query && dictionary[query] && dictionary[query].meaning) {
        els.wordLinkPreview.innerText = `${query}: ${dictionary[query].meaning}`;
    } else {
        els.wordLinkPreview.innerText = '';
    }

    if (query.length > 0) {
        const matches = Object.keys(dictionary)
            .filter(k => k !== word && k.includes(query))
            .slice(0, 10);

        if (matches.length > 0) {
            els.wordLinkSuggestions.innerHTML = '';
            matches.forEach(m => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                const meaning = dictionary[m].meaning || '';
                item.innerHTML = `<span>${m}</span>${meaning ? `<span class="item-meaning">${meaning}</span>` : ''}`;
                item.onclick = () => {
                    els.wordLinkInput.value = m;
                    els.wordLinkSuggestions.classList.add('hidden');
                    updateLinkPreview();
                };
                els.wordLinkSuggestions.appendChild(item);
            });
            els.wordLinkSuggestions.classList.remove('hidden');
        } else {
            els.wordLinkSuggestions.classList.add('hidden');
        }
    } else {
        els.wordLinkSuggestions.classList.add('hidden');
    }
}

export function openWordEditor(word, displayText = null) {
    if (!word) return;
    // Only push a new history state if the modal is currently hidden
    if (els.wordModal.classList.contains('hidden')) {
        pushModalState();
    }
    els.actionPopup.classList.add('hidden');
    runtime.currentWord = word;
    runtime.colorChangedInEditor = false;
    const data = dictionary[word] || { status: 'new', colorIdx: 0, meaning: '', tags: [], linked: '', shareColor: true };
    document.getElementById('modal-word-title').innerText = displayText || word;
    els.wordMeaningInput.value = data.meaning || '';
    els.wordTagsInput.value = (data.tags || []).join(', ');
    els.wordLinkInput.value = data.linked || '';
    els.wordShareColorCheck.checked = data.hasOwnProperty('shareColor') ? data.shareColor : true;
    els.wordLinkSuggestions.classList.add('hidden');
    updateLinkPreview();
    els.wordTagsSuggestions.classList.add('hidden');
    renderColorSelection(data.status, data.colorIdx);
    els.wordModal.classList.remove('hidden');
}

function renderColorSelection(activeStatus, activeIdx) {
    els.wordColorSelector.innerHTML = '';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
        const blueBubble = document.createElement('div');
        blueBubble.className = `color-bubble ${activeStatus === 'new' ? 'active' : ''}`;
        blueBubble.style.background = '#4a90e2';
        blueBubble.innerHTML = '<span>New</span>';
        blueBubble.onclick = () => {
            runtime.colorChangedInEditor = true;
            els.wordColorSelector.querySelectorAll('.color-bubble').forEach(b => b.classList.remove('active'));
            blueBubble.classList.add('active');
            blueBubble.dataset.status = 'new';
        };
        blueBubble.dataset.status = 'new';
        els.wordColorSelector.appendChild(blueBubble);
        const noneBubble = document.createElement('div');
        noneBubble.className = `color-bubble ${activeStatus === 'neutral' ? 'active' : ''}`;
        noneBubble.style.background = '#333';
        noneBubble.innerHTML = '<span style="font-size: 1.1rem; opacity: 0.7;">&times;</span>';
        noneBubble.onclick = () => {
            runtime.colorChangedInEditor = true;
            els.wordColorSelector.querySelectorAll('.color-bubble').forEach(b => b.classList.remove('active'));
            noneBubble.classList.add('active');
            noneBubble.dataset.status = 'neutral';
        };
        noneBubble.dataset.status = 'neutral';
        els.wordColorSelector.appendChild(noneBubble);
    }
    appSettings.colors.forEach((color, i) => {
        const bubble = document.createElement('div');
        bubble.className = `color-bubble ${activeStatus === 'custom' && activeIdx === i ? 'active' : ''}`;
        bubble.style.background = color;
        bubble.onclick = () => {
            runtime.colorChangedInEditor = true;
            els.wordColorSelector.querySelectorAll('.color-bubble').forEach(b => b.classList.remove('active'));
            bubble.classList.add('active');
            bubble.dataset.status = 'custom';
            bubble.dataset.idx = i;
        };
        bubble.dataset.status = 'custom';
        bubble.dataset.idx = i;
        els.wordColorSelector.appendChild(bubble);
    });
}

export function saveWordData(shouldClose = true) {
    const word = runtime.currentWord;
    if (!word) return;
    
    // Handle both manual calls and event listener trigger (where 1st arg is Event)
    const actualShouldClose = (shouldClose instanceof Event) ? true : shouldClose;

    const activeBubble = els.wordColorSelector.querySelector('.color-bubble.active');
    let status = activeBubble ? activeBubble.dataset.status : 'new';
    let colorIdx = activeBubble && activeBubble.dataset.idx ? parseInt(activeBubble.dataset.idx) : 0;

    // Automatic color assignment if no specific option was chosen for a previously uncolored word
    const currentData = dictionary[word] || { status: 'new' };
    const isUncolored = currentData.status === 'new' || currentData.status === 'neutral';
    if (isUncolored && !runtime.colorChangedInEditor) {
        status = 'custom';
        colorIdx = 0;
    }

    const meaning = els.wordMeaningInput.value.trim();
    const tags = els.wordTagsInput.value.split(',').map(t => t.trim()).filter(t => t);
    const linked = els.wordLinkInput.value.trim().toLowerCase();
    const shareColor = els.wordShareColorCheck.checked;
    
    // Check if we are creating a NEW multi-word phrase
    const isNewPhrase = (word.includes(' ') && !dictionary.hasOwnProperty(word)) || 
                       (linked && linked.includes(' ') && !dictionary.hasOwnProperty(linked));

    const now = Date.now();
    const existing = dictionary[word];
    const createdAt = (existing && existing.created_at) ? existing.created_at : now;

    dictionary[word] = { 
        status, 
        colorIdx, 
        meaning, 
        tags, 
        linked, 
        shareColor, 
        created_at: createdAt, 
        updated_at: now 
    };
    
    if (linked) {
        if (!dictionary[linked]) {
            dictionary[linked] = { status: 'new', meaning: '', tags: [], linked: '', shareColor: true, created_at: now, updated_at: now };
        }
        if (shareColor) {
            dictionary[linked].status = status;
            dictionary[linked].colorIdx = colorIdx;
            dictionary[linked].updated_at = now;
        }
    }
    
    // Only force a full re-wrap if tokenization needs to change (new phrase)
    refreshViewerHighlights(isNewPhrase);
    persist();
    
    if (actualShouldClose) {
        els.wordModal.classList.add('hidden');
    }
}