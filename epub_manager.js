import ePub from 'epubjs';
import { runtime, appSettings, persist } from './state.js';
import { els } from './dom.js';
import { wrapWords, processNodes } from './utils.js';
import { createIcons, BookOpen } from 'lucide';
import { handleWordClick } from './word_manager.js';
import { handleWordHover, handleWordOut, updateHeaderVisibility } from './ui_utils.js';
import { handleSelection, initTouchSelection } from './selection_manager.js';
import { setupSwipeGestures, updatePageDisplay, finishReading, applyTextStyles } from './reader_manager.js';
import * as tts from './tts.js';

export async function loadEpub(file) {
    const fileReader = new FileReader();
    return new Promise((resolve) => {
        fileReader.onload = async (e) => {
            runtime.currentBook = ePub(e.target.result);
            runtime.rendition = runtime.currentBook.renderTo("viewer", { width: "100%", height: "100%", flow: "scrolled" });

            const resizeObserver = new ResizeObserver(() => {
                if (runtime.rendition) {
                    try { runtime.rendition.resize(); } catch(e) {}
                }
            });
            resizeObserver.observe(els.viewer);

            runtime.currentBook.ready.then(() => {
                runtime.totalContentLength = 1000000;
                els.progressSlider.max = 100;
                return runtime.currentBook.locations.generate(1024);
            }).then(updatePageDisplay);

            runtime.rendition.on('relocated', () => {
                updatePageDisplay();
                updateHeaderVisibility(0);
                const loc = runtime.rendition.currentLocation();

                if (loc && loc.atEnd) {
                    const body = runtime.rendition.getContents()[0].document.body;
                    if (!body.querySelector('#finish-reading-btn')) {
                        const container = body.ownerDocument.createElement('div');
                        container.className = 'finish-reading-container';
                        container.style.marginTop = '40px';
                        container.style.padding = '20px 0';
                        container.style.textAlign = 'center';
                        
                        const btn = body.ownerDocument.createElement('button');
                        btn.id = 'finish-reading-btn';
                        btn.innerText = 'Finished';
                        btn.style.cssText = `background: #bb86fc; color: #000; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: sans-serif;`;
                        btn.onclick = finishReading;
                        container.appendChild(btn);
                        body.appendChild(container);
                    }
                }
                if (runtime.currentFileName && loc && loc.start) {
                    if (!appSettings.progress[runtime.currentFileName]) appSettings.progress[runtime.currentFileName] = {};
                    appSettings.progress[runtime.currentFileName].lastCfi = loc.start.cfi;
                    persist();
                }

                const body = runtime.rendition.getContents()[0].document.body;
                const offset = (loc && loc.start) ? Math.floor(loc.start.percentage * runtime.totalContentLength) : 0;
                tts.prepareSync(body, offset, runtime.totalContentLength);
            });
            
            runtime.rendition.hooks.content.register((contents) => {
                const body = contents.document.body;
                processNodes(body, wrapWords);
                contents.document.addEventListener('click', handleWordClick);
                contents.document.addEventListener('mouseover', handleWordHover);
                contents.document.addEventListener('mouseout', handleWordOut);
                contents.document.addEventListener('selectionchange', () => handleSelection(null, contents.document));

                if (window.matchMedia('(max-width: 768px)').matches) {
                    initTouchSelection(body, contents.document);
                    setupSwipeGestures(contents.document, true);
                }

                contents.window.addEventListener('scroll', () => {
                    handleWordOut();
                    updateHeaderVisibility(contents.window.scrollY || contents.document.documentElement.scrollTop);
                });

                const style = contents.document.createElement('style');
                style.textContent = `
                    body { color: #e8e8e8 !important; }
                    .reader-word { cursor: pointer; border-radius: 2px; padding: 0 1px; color: inherit; }
                    .reader-word:hover { background: rgba(255,255,255,0.1); }
                    .word-new { color: #4a90e2 !important; }
                    ${appSettings.colors.map((c, i) => `.word-custom-${i} { color: ${c} !important; }`).join('\n')}
                `;
                contents.document.head.appendChild(style);
            });

            const storedProgress = appSettings.progress[runtime.currentFileName];
            const initialPos = storedProgress ? storedProgress.lastCfi : undefined;

            await runtime.rendition.display(initialPos);
            updatePageDisplay();
            applyTextStyles();
            resolve();
        };
        fileReader.readAsArrayBuffer(file);
    });
}