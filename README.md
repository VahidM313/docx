<div align="center">
  <img src="docs-desktop/public/logo.png" alt="Docx Logo" width="96" height="96" />

  # Docx — 121-Site Offline Documentation Engine

  **Ultra-fast, 100% offline desktop documentation hub for 121 developer ecosystems — powered by Tauri v2 (Rust), Max-Gzip Level 9 `.docpack` archives, and HTTP 206 Partial Range delta updates.**

  <p align="center">
    <a href="https://github.com/VahidM313/docx/releases/download/packs-latest/Docx.exe">
      <img src="https://img.shields.io/badge/%E2%AC%87_Download_Docx.exe-Windows_x64_(Standalone)-38bdf8?style=for-the-badge&logo=windows&logoColor=white" alt="Download Docx.exe for Windows" />
    </a>
    <a href="https://github.com/VahidM313/docx/releases/tag/packs-latest">
      <img src="https://img.shields.io/badge/Docpack_Registry-121_Offline_Sites-22c55e?style=for-the-badge&logo=github&logoColor=white" alt="121 Offline Docpacks" />
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

- **121 Documentation Ecosystems**: Instant offline access across 14 specialized developer categories: Frontend & UI, React, Vue, Web Frameworks, TanStack, Backend & Auth, Databases & SQL (including Vector DBs), AI & Machine Learning, Python, Rust, Go, C/C++, DevOps, and Architecture.
- **Original Website Fidelity**: Renders the authentic documentation pages, styles, syntax highlighting, and interactive layouts locally via embedded Rust HTTP servers (`127.0.0.1`).
- **HTTP 206 Partial Range Delta Updates**: Compares local SHA-256 chunk hashes against [`registry.json`](https://github.com/VahidM313/docx/releases/download/packs-latest/registry.json) on GitHub Releases and downloads only modified chunks.
- **Universal Spotlight Search (`Ctrl + K`)**: Instant search across all installed documentation packs with keyboard navigation and category filtering.
- **Reader Typography & Dark Mode**:
  - **Font Size / Zoom Controls**: Adjust scale anytime via `A−` / `100%` / `A+` in the top bar or `Ctrl + +`, `Ctrl + -`, `Ctrl + 0`.
  - **Smart Dark Mode (`🌙 Dark` / `☀️ Light`)**: Automatically converts light-only documentation sites into a clean dark theme while preserving images and diagrams.
- **Single-File Portable Bundler**: Click **Bundle Into Single `Docx.exe`** to embed all your downloaded `.docpack` archives directly into the executable trailer (`DOCXPACK`).

---

## 📚 Included Documentation Catalog (121 Sites Across 14 Categories)

### 🎨 1. Frontend & UI (8)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Tailwind CSS v4.3** | `tailwind` | `https://tailwindcss.com/docs` |
| **shadcn/ui v4.0** | `shadcn` | `https://ui.shadcn.com/docs` |
| **MDN CSS** | `mdn_css` | `https://developer.mozilla.org/en-US/docs/Web/CSS` |
| **MDN HTML** | `mdn_html` | `https://developer.mozilla.org/en-US/docs/Web/HTML` |
| **htmx v4.0** | `htmx` | `https://htmx.org/docs/` |
| **Three.js r175** | `threejs` | `https://threejs.org/docs/` |
| **Motion v12** | `motion` | `https://motion.dev/docs` |
| **Lucide Icons v0.475** | `lucide` | `https://lucide.dev` |

### ⚛️ 2. React Ecosystem (6)
| Site | ID | Source |
| :--- | :--- | :--- |
| **React v19.1** | `react` | `https://react.dev` |
| **Next.js v15.3** | `nextjs` | `https://nextjs.org/docs` |
| **React Hook Form v7.54** | `react_hook_form` | `https://react-hook-form.com` |
| **Radix Primitives v1.1** | `radix_ui` | `https://www.radix-ui.com` |
| **Zustand v5.0** | `zustand` | `https://zustand.docs.pmnd.rs` |
| **SWR (Vercel) v2.3** | `swr` | `https://swr.vercel.app` |

### 💚 3. Vue Ecosystem (5)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Vue.js v3.5** | `vue` | `https://vuejs.org/guide/introduction.html` |
| **Nuxt v4.x** | `nuxt` | `https://nuxt.com/docs/4.x/getting-started/introduction` |
| **Pinia v3.0** | `pinia` | `https://pinia.vuejs.org` |
| **VueUse v12.0** | `vueuse` | `https://vueuse.org` |
| **Vue Router v4.5** | `vue_router` | `https://router.vuejs.org` |

### 🌐 4. Web Frameworks & Tools (9)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Svelte v5.0** | `svelte` | `https://svelte.dev` |
| **SolidJS v1.9** | `solidjs` | `https://docs.solidjs.com` |
| **Astro v5.6** | `astro` | `https://docs.astro.build` |
| **Vite v6.3** | `vite` | `https://vite.dev/guide/` |
| **Angular v17** | `angular` | `https://v17.angular.io/docs` |
| **Bun v1.2** | `bun` | `https://bun.sh/docs` |
| **Oxc Compiler** | `oxc` | `https://oxc.rs/docs/` |
| **TypeScript v5.8** | `typescript` | `https://www.typescriptlang.org/docs/` |
| **MDN JavaScript ES2025** | `mdn_js` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript` |

### ⚡ 5. TanStack Suite (16)
`tanstack_start`, `tanstack_router`, `tanstack_query`, `tanstack_table`, `tanstack_form`, `tanstack_virtual`, `tanstack_store`, `tanstack_db`, `tanstack_ai`, `tanstack_pacer`, `tanstack_ranger`, `tanstack_config`, `tanstack_devtools`, `tanstack_hotkeys`, `tanstack_react_charts`, `tanstack_create_tsrouter_app`

### 🚀 6. Backend, Auth & APIs (7)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Better Auth** | `better_auth` | `https://www.better-auth.com` |
| **Node.js API v22 LTS** | `nodejs` | `https://nodejs.org/docs/latest-v22.x/api/` |
| **Express.js v5.1** | `express` | `https://expressjs.com/` |
| **Hono v4.7** | `hono` | `https://hono.dev/docs/` |
| **NestJS v11** | `nestjs` | `https://docs.nestjs.com/` |
| **ElysiaJS v1.2** | `elysia` | `https://elysiajs.com` |
| **Zod v3.24** | `zod` | `https://zod.dev` |

### 🗄️ 7. Databases & SQL (11)
| Site | ID | Source |
| :--- | :--- | :--- |
| **PostgreSQL v17** | `postgresql` | `https://www.postgresql.org/docs/` |
| **MySQL 8.4 LTS** | `mysql` | `https://dev.mysql.com/doc/` |
| **MariaDB 11.4** | `mariadb` | `https://mariadb.com/kb/en/` |
| **SQLite v3.49** | `sqlite` | `https://www.sqlite.org/docs.html` |
| **Redis v7.4** | `redis` | `https://redis.io/docs/latest/` |
| **DuckDB v1.2** | `duckdb` | `https://duckdb.org/docs/` |
| **MongoDB v8.0** | `mongodb` | `https://www.mongodb.com/docs/manual/` |
| **Prisma ORM v6.4** | `prisma` | `https://www.prisma.io/docs/` |
| **Drizzle ORM v0.41** | `drizzle` | `https://orm.drizzle.team/docs/overview` |
| **Chroma DB v0.6** | `chroma` | `https://docs.trychroma.com` |
| **Qdrant v1.12** | `qdrant` | `https://qdrant.tech/documentation/` |

### 🧠 8. AI & Machine Learning (9)
| Site | ID | Source |
| :--- | :--- | :--- |
| **PyTorch v2.6** | `pytorch` | `https://pytorch.org/docs/stable/` |
| **TensorFlow 2.18** | `tensorflow` | `https://www.tensorflow.org/api_docs/python/tf` |
| **Keras 3.8** | `keras` | `https://keras.io` |
| **LangChain v0.3** | `langchain` | `https://python.langchain.com/docs/` |
| **Hugging Face v4.49** | `huggingface` | `https://huggingface.co/docs/` |
| **Ollama v0.5** | `ollama` | `https://ollama.com` |
| **NumPy v2.2** | `numpy` | `https://numpy.org/doc/stable/` |
| **Pandas v2.2** | `pandas` | `https://pandas.pydata.org/docs/` |
| **Scikit-learn v1.6** | `scikit_learn` | `https://scikit-learn.org/stable/` |

### 🐍 9. Python Ecosystem (9)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Python 3.13** | `python` | `https://docs.python.org/3/` |
| **FastAPI v0.115** | `fastapi` | `https://fastapi.tiangolo.com/` |
| **Django v6.1** | `django` | `https://docs.djangoproject.com/en/6.1/` |
| **Flask v3.1** | `flask` | `https://flask.palletsprojects.com` |
| **Pydantic v2.10** | `pydantic` | `https://docs.pydantic.dev` |
| **SQLAlchemy v2.0** | `sqlalchemy` | `https://docs.sqlalchemy.org/en/20/` |
| **Requests (Python) v2.32** | `requests_py` | `https://requests.readthedocs.io` |
| **Celery v5.4** | `celery` | `https://docs.celeryq.dev` |
| **Matplotlib v3.10** | `matplotlib` | `https://matplotlib.org/stable/` |

### 🦀 10. Rust Ecosystem (7)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Rust Stable Suite 1.86** | `rust` | `https://doc.rust-lang.org/book/` |
| **Tokio (Async Rust) v1.43** | `tokio` | `https://tokio.rs` |
| **Axum (Rust Web) v0.8** | `axum` | `https://docs.rs/axum/latest/axum/` |
| **Actix Web v4.9** | `actix_web` | `https://actix.rs/docs/` |
| **Serde (Rust) v1.0** | `serde` | `https://serde.rs` |
| **Bevy Engine v0.15** | `bevy` | `https://bevyengine.org` |
| **Clap (Rust CLI) v4.5** | `clap` | `https://docs.rs/clap/latest/clap/` |

### 🔷 11. Go (Golang) (6)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Go (Golang) 1.24** | `go` | `https://go.dev/doc/` |
| **Gin (Go Web) v1.10** | `gin` | `https://gin-gonic.com` |
| **GORM (Go ORM) v1.25** | `gorm` | `https://gorm.io` |
| **Fiber (Go Web) v2.52** | `fiber` | `https://gofiber.io` |
| **Echo (Go Web) v4.13** | `echo` | `https://echo.labstack.com` |
| **Cobra (Go CLI) v1.9** | `cobra` | `https://cobra.dev` |

### ⚡ 12. C & C++ Ecosystem (13)
| Site | ID | Source |
| :--- | :--- | :--- |
| **C++ Reference** | `cppreference` | `https://en.cppreference.com/` |
| **LearnCpp.com 2026** | `learncpp` | `https://www.learncpp.com/` |
| **Qt 6 Documentation** | `qt` | `https://doc.qt.io/` |
| **Boost C++ Libraries v1.87** | `boost` | `https://www.boost.org/doc/libs/latest/index.html` |
| **nlohmann/json (C++) v3.11** | `json_cpp` | `https://json.nlohmann.me` |
| **{fmt} C++ Formatting v11.1** | `fmt_cpp` | `https://fmt.dev/latest/` |
| **Raylib Cheatsheet & API v5.5** | `raylib` | `https://www.raylib.com` |
| **OpenCV (C++) 4.11** | `opencv` | `https://docs.opencv.org` |
| **Dear ImGui v1.91** | `imgui` | `https://github.com/ocornut/imgui` |
| **Catch2 v3.7** | `catch2` | `https://github.com/catchorg/Catch2` |
| **spdlog v1.15** | `spdlog` | `https://github.com/gabime/spdlog` |
| **LLVM Infrastructure v20.1** | `llvm` | `https://llvm.org/docs/` |
| **Lua 5.4 Reference** | `lua` | `https://www.lua.org/manual/5.4/` |

### 🐳 13. DevOps & Cloud (12)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Docker Docs v28** | `docker` | `https://docs.docker.com/get-started/` |
| **Kubernetes v1.32** | `kubernetes` | `https://kubernetes.io/docs/home/` |
| **Nginx v1.26** | `nginx` | `https://nginx.org/en/docs/` |
| **Caddy Server v2.9** | `caddy` | `https://caddyserver.com/docs/` |
| **OpenTofu / Terraform v1.9** | `opentofu` | `https://opentofu.org/docs/intro/` |
| **Ansible v11** | `ansible` | `https://docs.ansible.com/ansible/latest/` |
| **Git Reference Manual** | `git` | `https://git-scm.com/docs/git` |
| **curl & libcurl v8.13** | `curl` | `https://curl.se/docs/` |
| **CMake v4.0** | `cmake` | `https://cmake.org/cmake/help/latest/` |
| **Ninja Build v1.12** | `ninja` | `https://ninja-build.org/manual.html` |
| **PowerShell 7.5** | `powershell` | `https://learn.microsoft.com/en-us/powershell/` |
| **Windows CMD** | `cmd` | `https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/` |

### 🏛️ 14. Architecture & Design (3)
| Site | ID | Source |
| :--- | :--- | :--- |
| **Software Design Patterns** | `design_patterns` | `https://refactoring.guru/design-patterns` |
| **Material Design 3 (Web)** | `material_design` | `https://material-web.dev` |
| **Refactoring & Clean Code** | `refactoring` | `https://refactoring.guru` |

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
