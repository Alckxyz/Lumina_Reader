import { dictionary, appSettings, persist } from './state.js';
import { els } from './dom.js';
import { openWordEditor } from './editor_manager.js';
import { pushModalState } from './ui_utils.js';
import { refreshViewerHighlights } from './word_manager.js';
import { createIcons, Trash2 } from 'lucide';

export function openWordList() {
    pushModalState();
    els.wordListModal.classList.remove('hidden');
    els.wordListSearch.value = '';
    renderWordList();
}

export function renderWordList(filter = '') {
    els.wordListContainer.innerHTML = '';
    const query = filter.toLowerCase().trim();
    const sortMode = els.wordListSort ? els.wordListSort.value : 'alpha';

    const entries = Object.entries(dictionary)
        .filter(([word, data]) => {
            if (data.status !== 'custom') return false;
            if (!query) return true;
            
            return word.includes(query) || 
                   (data.meaning && data.meaning.toLowerCase().includes(query)) ||
                   (data.tags && data.tags.some(t => t.toLowerCase().includes(query)));
        });

    // Apply Sorting
    entries.sort((a, b) => {
        const [wordA, dataA] = a;
        const [wordB, dataB] = b;

        if (sortMode === 'newest') {
            return (dataB.created_at || 0) - (dataA.created_at || 0);
        } else if (sortMode === 'updated') {
            return (dataB.updated_at || 0) - (dataA.updated_at || 0);
        } else {
            return wordA.localeCompare(wordB);
        }
    });

    if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'word-list-empty';
        empty.innerText = query ? 'No matches found.' : 'No colored words saved yet.';
        els.wordListContainer.appendChild(empty);
        return;
    }

    entries.forEach(([word, data]) => {
        const item = document.createElement('div');
        item.className = 'word-list-item';
        item.onclick = () => {
            els.wordListModal.classList.add('hidden');
            openWordEditor(word);
        };

        const color = appSettings.colors[data.colorIdx] || '#fff';
        
        item.innerHTML = `
            <div class="word-list-color-indicator" style="background-color: ${color}"></div>
            <div class="word-list-item-content">
                <div class="word-list-item-header">
                    <span class="word-list-word">${word}</span>
                </div>
                ${data.meaning ? `<span class="word-list-meaning">${data.meaning}</span>` : ''}
                ${data.tags && data.tags.length > 0 ? `<span class="word-list-tags">${data.tags.join(', ')}</span>` : ''}
            </div>
            <button class="icon-btn small delete-btn word-list-delete-btn" title="Delete word">
                <i data-lucide="trash-2"></i>
            </button>
        `;

        const deleteBtn = item.querySelector('.word-list-delete-btn');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${word}"?`)) {
                delete dictionary[word];
                renderWordList(els.wordListSearch.value);
                refreshViewerHighlights();
                persist();
            }
        };

        els.wordListContainer.appendChild(item);
    });

    createIcons({ icons: { Trash2 } });
}