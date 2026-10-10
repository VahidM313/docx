<div align="center">
  <img src="docs-desktop/public/logo.png" alt="Docx Logo" width="96" height="96" />

  # Docx — 57-Site Offline Documentation Engine

  **Ultra-fast, 100% offline desktop documentation hub for 57 developer ecosystems — powered by Tauri v2 (Rust), Max-Gzip Level 9 `.docpack` archives, and HTTP 206 Partial Range delta updates.**

  <p align="center">
    <a href="https://github.com/VahidM313/docx/releases/download/packs-latest/Docx.exe">
      <img src="https://img.shields.io/badge/%E2%AC%87_Download_Docx.exe-Windows_x64_(Standalone)-38bdf8?style=for-the-badge&logo=windows&logoColor=white" alt="Download Docx.exe for Windows" />
    </a>
    <a href="https://github.com/VahidM313/docx/releases/tag/packs-latest">
      <img src="https://img.shields.io/badge/Docpack_Registry-57_Offline_Sites-22c55e?style=for-the-badge&logo=github&logoColor=white" alt="57 Offline Docpacks" />
    </a>
  </p>
</div>

---

## ⬇ Direct Download (Windows)

No installer or external runtime required — download and run the standalone executable directly:

- 👉 **[Download `Docx.exe` (Latest Standalone Windows x64 Binary)](https://github.com/VahidM313/docx/releases/download/packs-latest/Docx.exe)**
- 📦 **[Browse All `.docpack` Archives on GitHub Releases (`packs-latest`)](https://github.com/VahidM313/docx/releases/tag/packs-latest)**

---

## ✨ Key Features

- **57 Documentation Ecosystems**: Instant offline access to Frontend, TanStack, Backend, Databases, Systems (Rust/Go/C++/Python/Qt/Boost), and DevOps documentation.
- **Original Website Fidelity**: Renders the authentic documentation pages, styles, syntax highlighting, and interactive layouts locally via embedded Rust HTTP servers (`127.0.0.1`).
- **HTTP 206 Partial Range Delta Updates**: Compares local SHA-256 chunk hashes against [`registry.json`](https://github.com/VahidM313/docx/releases/download/packs-latest/registry.json) on GitHub Releases and downloads only modified chunks.
- **Universal Spotlight Search (`Ctrl + K`)**: Instant search across all installed documentation packs with keyboard navigation.
- **Reader Typography & Dark Mode**:
  - **Font Size / Zoom Controls**: Adjust scale anytime via `A−` / `100%` / `A+` in the top bar or `Ctrl + +`, `Ctrl + -`, `Ctrl + 0`.
  - **Smart Dark Mode (`🌙 Dark` / `☀️ Light`)**: Automatically converts light-only documentation sites (`cppreference`, `LearnCpp`, `Boost`, `SQLite`, `PostgreSQL`, `CMake`, `Git`, `Lua`, etc.) into a clean dark theme while preserving images and diagrams.
- **Single-File Portable Bundler**: Click **Bundle Into Single `Docx.exe`** to embed all your downloaded `.docpack` archives directly into the executable trailer (`DOCXPACK`).

---

## 📚 Included Documentation Catalog (57 Sites)

### 🎨 Frontend & UI (13)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Tailwind CSS v4.3** | `tailwind` | `https://tailwindcss.com/docs` |
| **shadcn/ui v4.0** | `shadcn` | `https://ui.shadcn.com/docs` |
| **React v19.1** | `react` | `https://react.dev` |
| **Next.js v15.3** | `nextjs` | `https://nextjs.org/docs` |
| **Vue.js v3.5** | `vue` | `https://vuejs.org/guide/introduction.html` |
| **Nuxt v4.x** | `nuxt` | `https://nuxt.com/docs/4.x/getting-started/introduction` |
| **Angular v17** | `angular` | `https://v17.angular.io/docs` |
| **Three.js r175** | `threejs` | `https://threejs.org/docs/` |
| **Motion v12** | `motion` | `https://motion.dev/docs` |
| **Vite v6.3** | `vite` | `https://vite.dev/guide/` |
| **Astro v5.6** | `astro` | `https://docs.astro.build` |
| **MDN JavaScript** | `mdn_js` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript` |
| **htmx v4.0** | `htmx` | `https://htmx.org/docs/` |

### ⚡ TanStack Suite (16)
`tanstack_start`, `tanstack_router`, `tanstack_query`, `tanstack_table`, `tanstack_form`, `tanstack_virtual`, `tanstack_store`, `tanstack_db`, `tanstack_ai`, `tanstack_pacer`, `tanstack_ranger`, `tanstack_config`, `tanstack_devtools`, `tanstack_hotkeys`, `tanstack_react_charts`, `tanstack_create_tsrouter_app`

### 🛠️ Backend, Frameworks & Databases (11)
| Site | ID | Source |
| :--- | :--- | :--- |
| **TypeScript v5.8** | `typescript` | `https://www.typescriptlang.org/docs/` |
| **Bun v1.2** | `bun` | `https://bun.sh/docs` |
| **Hono v4.7** | `hono` | `https://hono.dev/docs/` |
| **Express.js v5.1** | `express` | `https://expressjs.com/` |
| **NestJS v11** | `nestjs` | `https://docs.nestjs.com/` |
| **ElysiaJS v1.2** | `elysia` | `https://elysiajs.com` |
| **Drizzle ORM v0.41** | `drizzle` | `https://orm.drizzle.team/docs/overview` |
| **Oxc Compiler** | `oxc` | `https://oxc.rs/docs/` |
| **Django v6.1** | `django` | `https://docs.djangoproject.com/en/6.1/` |
| **FastAPI v0.115** | `fastapi` | `https://fastapi.tiangolo.com/` |
| **PostgreSQL v17** | `postgresql` | `https://www.postgresql.org/docs/` |

### ⚙️ Systems, C/C++, Python & Embedded (10)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Python 3.13** | `python` | `https://docs.python.org/3/` |
| **Rust Stable Suite** | `rust` | `https://doc.rust-lang.org/book/` |
| **Go (Golang) 1.24** | `go` | `https://go.dev/doc/` |
| **C++ Reference** | `cppreference` | `https://en.cppreference.com/` |
| **LearnCpp.com** | `learncpp` | `https://www.learncpp.com/` |
| **Qt 6 Documentation** | `qt` | `https://doc.qt.io/` |
| **Boost C++ Libraries** | `boost` | `https://www.boost.org/doc/libs/latest/index.html` |
| **LLVM Infrastructure** | `llvm` | `https://llvm.org/docs/` |
| **Lua 5.4 Reference** | `lua` | `https://www.lua.org/manual/5.4/` |
| **SQLite v3.49** | `sqlite` | `https://www.sqlite.org/docs.html` |

### 🐳 DevOps, Build Systems & Shells (7)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Docker Docs** | `docker` | `https://docs.docker.com/get-started/` |
| **Git Reference Manual** | `git` | `https://git-scm.com/docs/git` |
| **curl & libcurl** | `curl` | `https://curl.se/docs/` |
| **CMake v4.0** | `cmake` | `https://cmake.org/cmake/help/latest/` |
| **Ninja Build** | `ninja` | `https://ninja-build.org/manual.html` |
| **PowerShell 7.5** | `powershell` | `https://learn.microsoft.com/en-us/powershell/` |
| **Windows CMD** | `cmd` | `https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/` |

---

## 🛠️ Building from Source

```bash
cd docs-desktop
bun install
bun x tauri build --no-bundle
```

To crawl and build `.docpack` archives locally:
```bash
bun run scripts/ci-build-site.ts <site_id> ./packs
```
