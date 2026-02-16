export const DEFAULT_SETTINGS = {
    fontSize: 18,
    paragraphsPerPage: (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) ? 5 : 6,
    colors: ['#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#2ecc71'],
    playbackRate: 1.0,
    volume: 1.0,
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
    srtTimings: null, // Stores timestamp data for SRT files
    colorChangedInEditor: false, // Flag to track if the user manually clicked a color bubble
    totalContentLength: 0,
    pageOffsets: [] // Starting character index for each page/section
};

export function setDictionary(newDict) { dictionary = newDict; }
export function setSettings(newSettings) { appSettings = newSettings; }

// removed function exportData() {}
// removed function importData() {}

export const AI_PROMPT_TEXT = `When I send you a SINGLE word:

- If the word is misspelled:
  wrong_word ❌ → corrected_word ✅
- If it is correct, say NOTHING about spelling.

- Start the answer using this format:
  word — type (noun, verb, adjective, tense, etc.)

- Identify the base form (dictionary form).
  - This includes:
    - Verb forms (past, present, future, -ing, -ed, etc.).
    - Adjectives derived from verbs (e.g., impending → impend).
    - Other grammatical shifts (noun ↔ verb ↔ adjective).
  - If the base form is the same, do NOT mention it.
  - If it is different, write:
    Base form: base_form — type

- CRITICAL RULE:
  If the base form and the exact word express the SAME core meaning,
  even if the grammatical category is different (verb, adjective, etc.),
  give ONLY ONE shared meaning and STOP.
  Do NOT separate them.
  Do NOT restate the meaning.

- Only separate meanings if the semantic meaning is truly different.

- If the meanings are DIFFERENT:

  Base form — type:
  meaning

  Exact word — type:
  meaning

- Do NOT number sections.
- Do NOT add explanations or extra text.
- Do NOT introduce idioms or phrasal verbs at this stage.

---

IDIOMS

- If I send a FULL sentence using the word:
  - Check if the word is part of an idiomatic expression in THAT sentence.
  - ONLY THEN show:

  Idiomatic expression (base form):
  Meaning:

- If no idiom appears in the sentence, do NOT mention idioms.

---

SYNONYM / PHRASE REPLACEMENT (USING *) — STRICT

- If I send * word1:
  - Replace the FIRST occurrence of that word in the LAST meaning you gave
    with ONE natural synonym.
  - The synonym MUST NOT be:
    - the original headword being defined
    - the same word being replaced

- If I send * word1, word2, word3:
  - Replace EACH listed word independently.
  - Use ONE appropriate synonym per word.
  - Keep the rest of the meaning unchanged.

- If I send * a full phrase:
  - Replace ONLY that exact phrase with a synonymous phrase.
  - The replacement must preserve the original meaning.
  - Do NOT rewrite the rest of the sentence.

- General rules for all * replacements:
  - Replace ONLY the specified word(s) or phrase.
  - Do NOT repeat the original word(s) or phrase.
  - Do NOT change word order outside the replacement.
  - Do NOT add or remove other words.
  - If a replacement is not possible, say:
    Cannot apply replacement.

---

If I send "+" alone:
- Give another meaning.

If I send "#":
- Give the same meaning in a different form.

---

FORMAT RULE (MANDATORY)

Always use this structure:

word — type

Base form: base_form — type (only if different)

meaning

Only include separate sections if meanings are different.
Do NOT repeat meanings.
Do NOT add extra text.`;