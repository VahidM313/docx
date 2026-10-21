# Offline Persian (Farsi) Translation Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable full offline English-to-Persian documentation translation in Docx with one-click page/paragraph translation, code-safe DOM walking, persistent local caching, and optional Meta NLLB-200 model management.

**Architecture:** A client-side translation pipeline powered by ONNX Runtime Web / Transformers.js with Meta's NLLB-200 (`pes_Arab`), integrated via a dedicated translation worker and a code-preserving DOM engine injected through `reader-bridge.html`. Translations are cached persistently by text hash in IndexedDB/localStorage for instant 0ms subsequent loads, with full UI controls in the Discord-style header and Settings.

**Tech Stack:** React 19, TypeScript, ONNX Runtime Web / `@xenova/transformers`, Web Worker, Tailwind CSS v4, Lucide Icons, Tauri v2.

---

## Global Constraints
- Code blocks (`<pre>`, `<code>`, `<kbd>`, syntax highlighting, inline symbols) MUST remain strictly untranslated in English and styled LTR.
- Mathematical KaTeX/LaTeX formulas (`.katex`, `math`, `svg`) MUST NOT be translated or corrupted.
- Translation model downloads MUST be strictly optional and user-triggered (not bundled by default to keep the core exe under 10 MB).
- Persistent translation cache MUST allow instant (0ms) offline re-reading of previously translated pages with zero CPU overhead.
- Translation toggle `[ FA | EN ]` MUST instantly swap between Persian and original English without requiring an iframe reload.
- Persian typography MUST use clean RTL styling with Vazirmatn / Sahel / Segoe UI Arabic font stack.

---

## Review Focus
- **Code Block Preservation**: Ensure paragraphs containing inline code (e.g. `The `useState` hook returns...`) translate only the surrounding text while keeping the code token in English.
- **RTL vs LTR Layout**: Verify code blocks and terminal snippets retain `dir="ltr"` and `text-align: left` even when the parent container switches to `dir="rtl"`.
- **Toggle State Sync**: Verify switching from FA back to EN immediately restores original text nodes accurately without DOM destruction.
- **Offline Reliability**: Ensure that once the model is cached or text is in cache, translation operates with network disabled.
- **Memory & CPU Throttling**: Process DOM translation in batches (e.g. 5–10 nodes per tick) so large documentation pages (like entire API references) do not freeze the UI.

---

## File Structure

```
docs-desktop/
├── src/
│   ├── lib/
│   │   ├── translator/
│   │   │   ├── types.ts              # Translation interfaces, settings, state
│   │   │   ├── worker.ts             # Web Worker running NLLB-200 / ONNX pipeline
│   │   │   ├── engine.ts             # Bridge between UI and translation worker/cache
│   │   │   └── cache.ts              # Persistent translation cache (IndexedDB/localStorage)
│   │   └── store.tsx                 # App state updates (persianTranslationEnabled, modelDownloaded)
│   ├── components/
│   │   ├── discordHeader.tsx         # [ FA | EN ] translation toggle button in reader header
│   │   ├── settingsModal.tsx         # Language & Translation management tab
│   │   └── readerPanels.tsx          # PostMessage bridge forwarding translation events to iframes
│   └── src-tauri/src/bridge/
│       └── reader-bridge.html        # Code-safe DOM walker, RTL switcher, and node replacer
```

---

## Tasks

### Task 1: Translation Data Models and Cache Engine
**Files:**
- Create: `docs-desktop/src/lib/translator/types.ts`
- Create: `docs-desktop/src/lib/translator/cache.ts`
- Modify: `docs-desktop/src/lib/store.tsx`

- [ ] **Step 1.1**: Define translation settings, model statuses (`idle`, `downloading`, `ready`, `translating`, `error`), and translation payloads in `types.ts`.
- [ ] **Step 1.2**: Implement `cache.ts` using IndexedDB with fallback to localStorage, hashing English text strings to their Persian translations for instant retrieval.
- [ ] **Step 1.3**: Add translation preferences (`autoTranslate`, `modelDownloaded`, `translationActive`) and actions (`toggleTranslation`, `clearTranslationCache`) to `store.tsx`.
- [ ] **Step 1.4**: Run `bun run --cwd docs-desktop build` to verify clean compilation.

---

### Task 2: Code-Safe DOM Parser & RTL Engine in Reader Bridge
**Files:**
- Modify: `docs-desktop/src-tauri/src/bridge/reader-bridge.html`

- [ ] **Step 2.1**: Implement a text node walker that identifies translatable prose elements (`<p>`, `<li>`, `<h1>`-`<h6>`, `<blockquote>`, `<td>`, `<th>`) while strictly skipping and protecting `<pre>`, `<code>`, `<kbd>`, `.katex`, and `.hljs`.
- [ ] **Step 2.2**: Store original English text in node dataset (`data-docx-original`) so toggling between English and Persian is lossless and instantaneous.
- [ ] **Step 2.3**: Inject Persian typography CSS rules:
  - `font-family: 'Vazirmatn', 'Sahel', 'Segoe UI', Tahoma, sans-serif`
  - RTL direction on translated blocks with LTR isolation for inline code (`bdi`, `dir="ltr"`).
- [ ] **Step 2.4**: Wire `DOCX_TRANSLATE_PAGE` and `DOCX_RESTORE_EN` message handlers to toggle between Persian and English dynamically.

---

### Task 3: Translation Worker & Model Pipeline Integration
**Files:**
- Create: `docs-desktop/src/lib/translator/worker.ts`
- Create: `docs-desktop/src/lib/translator/engine.ts`

- [ ] **Step 3.1**: Create `worker.ts` to execute batch translation tasks in the background without blocking the UI thread.
- [ ] **Step 3.2**: Connect fast translation pipeline with Meta NLLB-200 model parameters (`src_lang: "eng_Latn"`, `tgt_lang: "pes_Arab"`) and fallback dictionary for common programming terms.
- [ ] **Step 3.3**: Implement `engine.ts` to manage worker lifecycle, model download progress, batch queuing, and cache queries.
- [ ] **Step 3.4**: Connect `ReaderPanels` to forward translation requests between the active iframe and the translation engine.

---

### Task 4: UI Controls in Discord Header & Settings Modal
**Files:**
- Modify: `docs-desktop/src/components/discordHeader.tsx`
- Modify: `docs-desktop/src/components/settingsModal.tsx`

- [ ] **Step 4.1**: Add a `[ FA | EN ]` toggle button in `discordHeader.tsx` next to the document theme toggle:
  - Shows current status (active Persian vs English).
  - Displays a subtle spinner indicator while translating.
- [ ] **Step 4.2**: Add a dedicated **Language & Translation** tab in `settingsModal.tsx`:
  - Persian translation toggle switch.
  - Translation Engine info (Meta NLLB-200 `pes_Arab`).
  - Model status (Download / Delete model, progress bar).
  - Translation Cache stats (number of cached translations + Clear Cache button).
- [ ] **Step 4.3**: Build and verify with `bun run --cwd docs-desktop build`.

---

### Task 5: Compilation, Deployment & Verification
**Files:**
- Output: `C:\Users\vahid\OneDrive\Desktop\Docx.exe`
- Output: `D:\Dev\docx\Docx.exe`

- [ ] **Step 5.1**: Build release binary with `bun scripts/build-desktop.ts --force-fe`.
- [ ] **Step 5.2**: Test doc reader with Persian toggle in light and dark modes to verify RTL styling and code block protection.
- [ ] **Step 5.3**: Commit changes and push to `origin/main`.
