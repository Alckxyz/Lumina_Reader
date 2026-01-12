import { dictionary } from './state.js';

export function processNodes(node, wrapperFn) {
    if (node.nodeType === 3) { // Text Node
        const text = node.nodeValue;
        if (!text.trim()) return;
        
        const wrappedHTML = wrapperFn(text);
        const temp = document.createElement('div');
        temp.innerHTML = wrappedHTML;
        
        const fragments = document.createDocumentFragment();
        while (temp.firstChild) {
            fragments.appendChild(temp.firstChild);
        }
        node.replaceWith(fragments);
    } else if (node.nodeType === 1) {
        // Skip script, style and non-content tags
        if (['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT'].includes(node.tagName)) return;
        Array.from(node.childNodes).forEach(n => processNodes(n, wrapperFn));
    }
}

export function getWordEffectiveData(wordText) {
    const data = dictionary[wordText];
    if (!data) return { status: 'new', colorIdx: 0 };
    
    if (data.linked && data.shareColor && dictionary[data.linked]) {
        const rootData = dictionary[data.linked];
        return {
            status: rootData.status || 'new',
            colorIdx: rootData.colorIdx || 0
        };
    }
    
    return {
        status: data.status || 'new',
        colorIdx: data.colorIdx || 0
    };
}

export function wrapWords(text) {
    // Get phrases from dictionary (keys with spaces)
    const phrases = Object.keys(dictionary)
        .filter(k => k.includes(' '))
        .sort((a, b) => b.length - a.length);

    // Escape phrases for regex
    const escapedPhrases = phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    
    // Create pattern that looks for longest phrases first, then individual words, then separate dashes/hyphens
    // We include standard (') and curly (’) apostrophes, as well as accented characters.
    // Hyphens and dashes are now treated as individual selectable words rather than glue.
    const wordPattern = `[a-zA-Z0-9'’\u00C0-\u017F]+`;
    const dashPattern = `[\\-\\u2013\\u2014]`;
    
    const patternStr = (escapedPhrases.length > 0) 
        ? `(${escapedPhrases.join('|')}|${wordPattern}|${dashPattern})`
        : `(${wordPattern}|${dashPattern})`;
    
    const regex = new RegExp(patternStr, 'gi');

    return text.replace(regex, (match) => {
        const clean = match.toLowerCase();
        const effective = getWordEffectiveData(clean);
        
        let cls = ''; 
        if (effective.status === 'new') cls = 'word-new';
        else if (effective.status === 'ignored') cls = 'word-ignored';
        else if (effective.status === 'custom') cls = `word-custom-${effective.colorIdx}`;
        
        return `<span class="reader-word ${cls}" data-word="${clean}">${match}</span>`;
    });
}