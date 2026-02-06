import ePub from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs';

export async function loadPdf(file) {
    const reader = new FileReader();
    return new Promise((resolve) => {
        reader.onload = async (e) => {
            const typedarray = new Uint8Array(e.target.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;
            let allLines = [];
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const content = await page.getTextContent();
                allLines.push(content.items.map(it => it.str).join(' '));
            }
            resolve(allLines.join('\n\n'));
        };
        reader.readAsArrayBuffer(file);
    });
}

export async function loadTxt(file) {
    const reader = new FileReader();
    return new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
    });
}

export async function loadSrt(file) {
    const text = await loadTxt(file);
    // Standard SRT regex allowing for various line ending and whitespace styles
    const regex = /(\d+)\s*\r?\n(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\r?\n([\s\S]*?)(?=\r?\n\r?\n|\r?\n\s*\r?\n|\r?\n$|$)/g;
    let match;
    const blocks = [];
    
    function timeToSeconds(timeStr) {
        const [h, m, s] = timeStr.split(':');
        const [sec, ms] = s.split(',');
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + (parseInt(ms) || 0) / 1000;
    }

    while ((match = regex.exec(text)) !== null) {
        const content = match[4].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
        if (!content) continue;
        blocks.push({
            start: timeToSeconds(match[2]),
            end: timeToSeconds(match[3]),
            text: content
        });
    }

    const fullText = blocks.map(b => b.text).join('\n\n');
    let currentOffset = 0;
    const timings = blocks.map(b => {
        const t = { ...b, charOffset: currentOffset };
        currentOffset += b.text.length + 2; // +2 for the \n\n joining
        return t;
    });

    return { text: fullText, timings };
}

export function paginateContent(rawText, paragraphsPerPage, skipRefinement = false) {
    // 1. Split by newlines first
    let rawParagraphs = rawText.split(/\n+/).filter(p => p.trim().length > 0);
    
    // 2. Sub-split long paragraphs into smaller chunks to "divide them into more parts"
    // This makes reading less overwhelming for language learners.
    // Skip this for SRT to maintain strict character mapping for sync.
    if (skipRefinement) {
        const pages = [];
        const size = paragraphsPerPage || 5;
        for (let i = 0; i < rawParagraphs.length; i += size) {
            pages.push(rawParagraphs.slice(i, i + size).join('\n\n'));
        }
        return pages;
    }

    const refinedParagraphs = [];
    rawParagraphs.forEach(p => {
        if (p.length > 500) {
            // Split by sentence markers followed by space
            // Using a simple split instead of lookbehind for maximum compatibility
            const sentences = p.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [p];
            let currentChunk = "";
            
            sentences.forEach(s => {
                if ((currentChunk.length + s.length > 400) && currentChunk.length > 0) {
                    refinedParagraphs.push(currentChunk.trim());
                    currentChunk = s;
                } else {
                    currentChunk += (currentChunk ? " " : "") + s;
                }
            });
            if (currentChunk) refinedParagraphs.push(currentChunk.trim());
        } else {
            refinedParagraphs.push(p);
        }
    });

    const pages = [];
    const size = paragraphsPerPage || 5;
    for (let i = 0; i < refinedParagraphs.length; i += size) {
        pages.push(refinedParagraphs.slice(i, i + size).join('\n\n'));
    }
    return pages;
}