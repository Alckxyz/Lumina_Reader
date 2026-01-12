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

export function paginateContent(rawText, paragraphsPerPage) {
    // 1. Split by newlines first
    let rawParagraphs = rawText.split(/\n+/).filter(p => p.trim().length > 0);
    
    // 2. Sub-split long paragraphs into smaller chunks to "divide them into more parts"
    // This makes reading less overwhelming for language learners.
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