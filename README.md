# Offline Documentation Hub (Tailwind CSS v4 & shadcn/ui v4)

A desktop Tauri application providing 100% offline versions of **Tailwind CSS** (`tailwindcss.com/docs`) and **shadcn/ui** (`ui.shadcn.com/docs`) with full JavaScript functionality, interactive component sandboxes, theme switchers, and a **Universal Search** across both sites.

---

## Quick Start

### Option 1: Double-Click Launcher
Double-click [start-offline-docs.bat](file:///d:/Dev/crawl/start-offline-docs.bat) in the root folder.

### Option 2: Using Bun
From `d:\Dev\crawl`:
```bash
bun start
```

---

## Features

1. **Home Launcher Dashboard**:
   - Choose between **Tailwind CSS v4.3** or **shadcn/ui v4**, or click any quick-topic pill to jump straight to a section.
   - Top navigation bar lets you switch between sites instantly without losing your scroll position or state.
2. **Full JavaScript Functionality**:
   - Powered by the real Next.js + React + MDX applications locally via Bun:
     - **Tailwind CSS Docs**: `http://localhost:3001/docs`
     - **shadcn/ui Docs**: `http://localhost:4000/docs`
   - Interactive Radix UI & Base UI components (dialogs, dropdowns, accordions, charts, calendars, tabs), dark/light theme toggles, and copy-code buttons all work offline.
3. **Universal Search (`Ctrl + K`)**:
   - Press `Ctrl + K` (or click the search bar) from anywhere in the app to open the Spotlight search palette.
   - Instant client-side search across **513 indexed documentation pages** from both Tailwind CSS and shadcn/ui.
   - Filter by `All`, `Tailwind CSS`, or `shadcn/ui`.
   - Use `↑` / `↓` and `Enter` to jump directly to the selected documentation page in the webview.
4. **Automatic Server Management**:
   - The Tauri Rust backend ([lib.rs](file:///d:/Dev/crawl/docs-desktop/src-tauri/src/lib.rs)) automatically checks if ports `3001` and `4000` are active and boots the Bun servers automatically on startup.

---

## Project Structure

- [docs-desktop/](file:///d:/Dev/crawl/docs-desktop): Tauri v2 desktop application + Vite frontend & Universal Search UI
- [tailwindcss-site/](file:///d:/Dev/crawl/tailwindcss-site): Official Tailwind CSS v4 documentation app
- [shadcn-site/apps/v4/](file:///d:/Dev/crawl/shadcn-site/apps/v4): Official shadcn/ui v4 documentation app with all styles & registries pre-built
- [scripts/generate-search-index.ts](file:///d:/Dev/crawl/scripts/generate-search-index.ts): Script that parses all `.mdx` files from both repositories into [search-index.json](file:///d:/Dev/crawl/search-index.json)
