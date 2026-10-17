import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface SiteConfig {
  id: string;
  name: string;
  version: string;
  origin: string;
  entryPath: string;
  allowedPrefixes: string[];
  maxPages?: number;
}

export const SITE_CATALOG: SiteConfig[] = [
  {
    id: "react",
    name: "React",
    version: "v19.1",
    origin: "https://react.dev",
    entryPath: "/learn",
    allowedPrefixes: ["/learn", "/reference"],
    maxPages: 180,
  },
  {
    id: "nextjs",
    name: "Next.js",
    version: "v15.3",
    origin: "https://nextjs.org",
    entryPath: "/docs",
    allowedPrefixes: ["/docs"],
    maxPages: 180,
  },
  {
    id: "vite",
    name: "Vite",
    version: "v6.3",
    origin: "https://vite.dev",
    entryPath: "/guide/",
    allowedPrefixes: ["/guide", "/config", "/changes"],
    maxPages: 120,
  },
  {
    id: "astro",
    name: "Astro",
    version: "v5.6",
    origin: "https://docs.astro.build",
    entryPath: "/en/getting-started/",
    allowedPrefixes: ["/en/"],
    maxPages: 160,
  },
  {
    id: "typescript",
    name: "TypeScript",
    version: "v5.8",
    origin: "https://www.typescriptlang.org",
    entryPath: "/docs/handbook/intro.html",
    allowedPrefixes: ["/docs/", "/tsconfig"],
    maxPages: 140,
  },
  {
    id: "mdn_js",
    name: "MDN JavaScript",
    version: "ES2025",
    origin: "https://developer.mozilla.org",
    entryPath: "/en-US/docs/Web/JavaScript",
    allowedPrefixes: ["/en-US/docs/Web/JavaScript"],
    maxPages: 180,
  },
  {
    id: "mdn_css",
    name: "MDN CSS",
    version: "CSS3 / Modern",
    origin: "https://developer.mozilla.org",
    entryPath: "/en-US/docs/Web/CSS",
    allowedPrefixes: ["/en-US/docs/Web/CSS"],
    maxPages: 180,
  },
  {
    id: "mdn_html",
    name: "MDN HTML",
    version: "HTML5",
    origin: "https://developer.mozilla.org",
    entryPath: "/en-US/docs/Web/HTML",
    allowedPrefixes: ["/en-US/docs/Web/HTML"],
    maxPages: 180,
  },
  {
    id: "htmx",
    name: "htmx",
    version: "v4.0",
    origin: "https://htmx.org",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs", "/attributes", "/headers", "/events", "/reference", "/examples"],
    maxPages: 100,
  },
  {
    id: "bun",
    name: "Bun",
    version: "v1.2",
    origin: "https://bun.sh",
    entryPath: "/docs",
    allowedPrefixes: ["/docs"],
    maxPages: 160,
  },
  {
    id: "elysia",
    name: "ElysiaJS",
    version: "v1.2",
    origin: "https://elysiajs.com",
    entryPath: "/table-of-content.html",
    allowedPrefixes: ["/at-glance", "/quick-start", "/table-of-content", "/essential", "/life-cycle", "/patterns", "/eden", "/plugins", "/integrations", "/tutorial"],
    maxPages: 120,
  },
  {
    id: "drizzle",
    name: "Drizzle ORM",
    version: "v0.41",
    origin: "https://orm.drizzle.team",
    entryPath: "/docs/overview",
    allowedPrefixes: ["/docs"],
    maxPages: 180,
  },
  {
    id: "oxc",
    name: "Oxc (Oxidation Compiler)",
    version: "latest",
    origin: "https://oxc.rs",
    entryPath: "/docs/guide/introduction.html",
    allowedPrefixes: ["/docs/"],
    maxPages: 120,
  },
  {
    id: "rust",
    name: "Rust Stable Suite",
    version: "1.86",
    origin: "https://doc.rust-lang.org",
    entryPath: "/book/",
    allowedPrefixes: ["/book/", "/rust-by-example/", "/cargo/"],
    maxPages: 180,
  },
  {
    id: "go",
    name: "Go (Golang)",
    version: "go1.24",
    origin: "https://go.dev",
    entryPath: "/doc/",
    allowedPrefixes: ["/doc/", "/ref/"],
    maxPages: 140,
  },
  {
    id: "cppreference",
    name: "C++ Reference (cppreference)",
    version: "C++23/26",
    origin: "https://en.cppreference.com",
    entryPath: "/",
    allowedPrefixes: ["/cpp", "/c", "/w/", "/Main_Page"],
    maxPages: 200,
  },
  {
    id: "learncpp",
    name: "LearnCpp.com",
    version: "2026",
    origin: "https://www.learncpp.com",
    entryPath: "/",
    allowedPrefixes: ["/cpp-tutorial/", "/"],
    maxPages: 160,
  },
  {
    id: "llvm",
    name: "LLVM Compiler Infrastructure",
    version: "v20.1",
    origin: "https://llvm.org",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs/"],
    maxPages: 150,
  },
  {
    id: "lua",
    name: "Lua 5.4 Reference",
    version: "v5.4",
    origin: "https://www.lua.org",
    entryPath: "/manual/5.4/",
    allowedPrefixes: ["/manual/5.4/", "/docs.html", "/pil/"],
    maxPages: 80,
  },
  {
    id: "docker",
    name: "Docker Docs",
    version: "v28",
    origin: "https://docs.docker.com",
    entryPath: "/get-started/",
    allowedPrefixes: ["/get-started", "/manuals", "/engine", "/compose", "/build", "/reference"],
    maxPages: 160,
  },
  {
    id: "git",
    name: "Git Reference Manual",
    version: "v2.49",
    origin: "https://git-scm.com",
    entryPath: "/docs/git",
    allowedPrefixes: ["/docs", "/book/en/v2"],
    maxPages: 160,
  },
  {
    id: "curl",
    name: "curl & libcurl",
    version: "v8.13",
    origin: "https://curl.se",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs/", "/libcurl/"],
    maxPages: 120,
  },
  {
    id: "cmake",
    name: "CMake Reference",
    version: "v4.0",
    origin: "https://cmake.org",
    entryPath: "/cmake/help/latest/index.html",
    allowedPrefixes: ["/cmake/help/latest/"],
    maxPages: 180,
  },
  {
    id: "ninja",
    name: "Ninja Build Manual",
    version: "v1.12",
    origin: "https://ninja-build.org",
    entryPath: "/manual.html",
    allowedPrefixes: ["/manual.html", "/"],
    maxPages: 30,
  },
  {
    id: "powershell",
    name: "PowerShell 7.5",
    version: "v7.5",
    origin: "https://learn.microsoft.com",
    entryPath: "/en-us/powershell/scripting/overview",
    allowedPrefixes: ["/en-us/powershell/"],
    maxPages: 140,
  },
  {
    id: "cmd",
    name: "Windows CMD Commands",
    version: "Win11/Server",
    origin: "https://learn.microsoft.com",
    entryPath: "/en-us/windows-server/administration/windows-commands/windows-commands",
    allowedPrefixes: ["/en-us/windows-server/administration/windows-commands/"],
    maxPages: 160,
  },
  // TanStack Suite (16 Libraries)
  {
    id: "tanstack_start",
    name: "TanStack Start",
    version: "v1",
    origin: "https://tanstack.com",
    entryPath: "/start/latest/docs/framework/react/overview",
    allowedPrefixes: ["/start/latest/docs"],
    maxPages: 100,
  },
  {
    id: "tanstack_router",
    name: "TanStack Router",
    version: "v1",
    origin: "https://tanstack.com",
    entryPath: "/router/latest/docs/framework/react/overview",
    allowedPrefixes: ["/router/latest/docs"],
    maxPages: 120,
  },
  {
    id: "tanstack_query",
    name: "TanStack Query",
    version: "v5",
    origin: "https://tanstack.com",
    entryPath: "/query/latest/docs/framework/react/overview",
    allowedPrefixes: ["/query/latest/docs"],
    maxPages: 120,
  },
  {
    id: "tanstack_table",
    name: "TanStack Table",
    version: "v8",
    origin: "https://tanstack.com",
    entryPath: "/table/latest/docs/introduction",
    allowedPrefixes: ["/table/latest/docs"],
    maxPages: 100,
  },
  {
    id: "tanstack_form",
    name: "TanStack Form",
    version: "v1",
    origin: "https://tanstack.com",
    entryPath: "/form/latest/docs/overview",
    allowedPrefixes: ["/form/latest/docs"],
    maxPages: 100,
  },
  {
    id: "tanstack_virtual",
    name: "TanStack Virtual",
    version: "v3",
    origin: "https://tanstack.com",
    entryPath: "/virtual/latest/docs/introduction",
    allowedPrefixes: ["/virtual/latest/docs"],
    maxPages: 80,
  },
  {
    id: "tanstack_store",
    name: "TanStack Store",
    version: "v0.7",
    origin: "https://tanstack.com",
    entryPath: "/store/latest/docs/overview",
    allowedPrefixes: ["/store/latest/docs"],
    maxPages: 80,
  },
  {
    id: "tanstack_db",
    name: "TanStack DB",
    version: "latest",
    origin: "https://tanstack.com",
    entryPath: "/db/latest/docs/overview",
    allowedPrefixes: ["/db/latest/docs"],
    maxPages: 80,
  },
  {
    id: "tanstack_ai",
    name: "TanStack AI",
    version: "latest",
    origin: "https://tanstack.com",
    entryPath: "/ai/latest/docs/overview",
    allowedPrefixes: ["/ai/latest/docs"],
    maxPages: 80,
  },
  {
    id: "tanstack_pacer",
    name: "TanStack Pacer",
    version: "latest",
    origin: "https://tanstack.com",
    entryPath: "/pacer/latest/docs/overview",
    allowedPrefixes: ["/pacer/latest/docs"],
    maxPages: 80,
  },
  {
    id: "tanstack_ranger",
    name: "TanStack Ranger",
    version: "v1",
    origin: "https://tanstack.com",
    entryPath: "/ranger/latest/docs/overview",
    allowedPrefixes: ["/ranger/latest/docs"],
    maxPages: 60,
  },
  {
    id: "tanstack_config",
    name: "TanStack Config",
    version: "latest",
    origin: "https://tanstack.com",
    entryPath: "/config/latest/docs/overview",
    allowedPrefixes: ["/config/latest/docs"],
    maxPages: 60,
  },
  {
    id: "tanstack_devtools",
    name: "TanStack Devtools",
    version: "latest",
    origin: "https://tanstack.com",
    entryPath: "/devtools/latest/docs/overview",
    allowedPrefixes: ["/devtools/latest/docs"],
    maxPages: 60,
  },
  {
    id: "tanstack_hotkeys",
    name: "TanStack Hotkeys",
    version: "latest",
    origin: "https://tanstack.com",
    entryPath: "/hotkeys/latest/docs/overview",
    allowedPrefixes: ["/hotkeys/latest/docs"],
    maxPages: 60,
  },
  {
    id: "tanstack_react_charts",
    name: "TanStack React Charts",
    version: "v3",
    origin: "https://react-charts.tanstack.com",
    entryPath: "/docs/overview",
    allowedPrefixes: ["/docs"],
    maxPages: 60,
  },
  {
    id: "tanstack_create_tsrouter_app",
    name: "Create TS Router App",
    version: "latest",
    origin: "https://tanstack.com",
    entryPath: "/router/latest/docs/framework/react/quick-start",
    allowedPrefixes: ["/router/latest/docs/framework/react"],
    maxPages: 60,
  },
  // 15 New Documentation Sites
  {
    id: "python",
    name: "Python 3",
    version: "v3.13",
    origin: "https://docs.python.org",
    entryPath: "/3/",
    allowedPrefixes: ["/3/"],
    maxPages: 160,
  },
  {
    id: "threejs",
    name: "Three.js",
    version: "r175",
    origin: "https://threejs.org",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs/", "/manual/"],
    maxPages: 140,
  },
  {
    id: "motion",
    name: "Motion",
    version: "v12",
    origin: "https://motion.dev",
    entryPath: "/docs",
    allowedPrefixes: ["/docs"],
    maxPages: 140,
  },
  {
    id: "vue",
    name: "Vue.js",
    version: "v3.5",
    origin: "https://vuejs.org",
    entryPath: "/guide/introduction.html",
    allowedPrefixes: ["/guide/", "/api/", "/tutorial/", "/examples/"],
    maxPages: 150,
  },
  {
    id: "nuxt",
    name: "Nuxt",
    version: "v4.x",
    origin: "https://nuxt.com",
    entryPath: "/docs/4.x/getting-started/introduction",
    allowedPrefixes: ["/docs"],
    maxPages: 150,
  },
  {
    id: "angular",
    name: "Angular",
    version: "v17",
    origin: "https://v17.angular.io",
    entryPath: "/docs",
    allowedPrefixes: ["/docs", "/guide", "/tutorial", "/api", "/start"],
    maxPages: 140,
  },
  {
    id: "hono",
    name: "Hono",
    version: "v4.7",
    origin: "https://hono.dev",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs", "/examples", "/helpers", "/middleware", "/guides", "/api"],
    maxPages: 130,
  },
  {
    id: "express",
    name: "Express.js",
    version: "v5.1",
    origin: "https://expressjs.com",
    entryPath: "/",
    allowedPrefixes: ["/en/", "/"],
    maxPages: 120,
  },
  {
    id: "nestjs",
    name: "NestJS",
    version: "v11",
    origin: "https://docs.nestjs.com",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 150,
  },
  {
    id: "qt",
    name: "Qt 6 Documentation",
    version: "Qt 6.9",
    origin: "https://doc.qt.io",
    entryPath: "/",
    allowedPrefixes: ["/qt-6/", "/"],
    maxPages: 140,
  },
  {
    id: "boost",
    name: "Boost C++ Libraries",
    version: "v1.87",
    origin: "https://www.boost.org",
    entryPath: "/doc/libs/latest/index.html",
    allowedPrefixes: ["/doc/libs/latest/", "/doc/"],
    maxPages: 140,
  },
  {
    id: "django",
    name: "Django",
    version: "v6.1",
    origin: "https://docs.djangoproject.com",
    entryPath: "/en/6.1/",
    allowedPrefixes: ["/en/6.1/", "/en/"],
    maxPages: 150,
  },
  {
    id: "fastapi",
    name: "FastAPI",
    version: "v0.115",
    origin: "https://fastapi.tiangolo.com",
    entryPath: "/",
    allowedPrefixes: ["/tutorial", "/advanced", "/reference", "/deployment", "/how-to", "/learn", "/"],
    maxPages: 150,
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    version: "v17",
    origin: "https://www.postgresql.org",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs/"],
    maxPages: 150,
  },
  {
    id: "sqlite",
    name: "SQLite",
    version: "v3.49",
    origin: "https://www.sqlite.org",
    entryPath: "/docs.html",
    allowedPrefixes: ["/"],
    maxPages: 140,
  },
  // React Ecosystem (5 Sites)
  {
    id: "react_hook_form",
    name: "React Hook Form",
    version: "v7.54",
    origin: "https://react-hook-form.com",
    entryPath: "/get-started",
    allowedPrefixes: ["/get-started", "/docs", "/api", "/ts"],
    maxPages: 120,
  },
  {
    id: "radix_ui",
    name: "Radix Primitives",
    version: "v1.1",
    origin: "https://www.radix-ui.com",
    entryPath: "/primitives/docs/overview/introduction",
    allowedPrefixes: ["/primitives/docs"],
    maxPages: 140,
  },
  {
    id: "zustand",
    name: "Zustand",
    version: "v5.0",
    origin: "https://zustand.docs.pmnd.rs",
    entryPath: "/learn/getting-started/introduction",
    allowedPrefixes: ["/learn", "/reference", "/getting-started", "/guides", "/"],
    maxPages: 100,
  },
  {
    id: "lucide",
    name: "Lucide Icons",
    version: "v0.475",
    origin: "https://lucide.dev",
    entryPath: "/icons",
    allowedPrefixes: ["/icons", "/guide", "/packages"],
    maxPages: 140,
  },
  {
    id: "swr",
    name: "SWR (Vercel)",
    version: "v2.3",
    origin: "https://swr.vercel.app",
    entryPath: "/docs/getting-started",
    allowedPrefixes: ["/docs"],
    maxPages: 100,
  },
  // Vue & Modern UI (5 Sites)
  {
    id: "pinia",
    name: "Pinia",
    version: "v3.0",
    origin: "https://pinia.vuejs.org",
    entryPath: "/introduction.html",
    allowedPrefixes: ["/introduction", "/getting-started", "/core-concepts", "/cookbook", "/api"],
    maxPages: 100,
  },
  {
    id: "vueuse",
    name: "VueUse",
    version: "v12.0",
    origin: "https://vueuse.org",
    entryPath: "/guide/",
    allowedPrefixes: ["/guide", "/core", "/shared", "/functions"],
    maxPages: 140,
  },
  {
    id: "vue_router",
    name: "Vue Router",
    version: "v4.5",
    origin: "https://router.vuejs.org",
    entryPath: "/introduction.html",
    allowedPrefixes: ["/introduction", "/guide", "/api"],
    maxPages: 100,
  },
  {
    id: "svelte",
    name: "Svelte",
    version: "v5.0",
    origin: "https://svelte.dev",
    entryPath: "/docs/svelte/overview",
    allowedPrefixes: ["/docs"],
    maxPages: 140,
  },
  {
    id: "solidjs",
    name: "SolidJS",
    version: "v1.9",
    origin: "https://docs.solidjs.com",
    entryPath: "/quick-start",
    allowedPrefixes: ["/quick-start", "/concepts", "/guides", "/reference"],
    maxPages: 120,
  },
  // Backend & APIs (4 Sites)
  {
    id: "nodejs",
    name: "Node.js API",
    version: "v22 LTS",
    origin: "https://nodejs.org",
    entryPath: "/docs/latest-v22.x/api/",
    allowedPrefixes: ["/docs/latest-v22.x/api/"],
    maxPages: 180,
  },
  {
    id: "zod",
    name: "Zod",
    version: "v3.24",
    origin: "https://zod.dev",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 60,
  },
  {
    id: "gin",
    name: "Gin (Go Web)",
    version: "v1.10",
    origin: "https://gin-gonic.com",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs/"],
    maxPages: 100,
  },
  {
    id: "gorm",
    name: "GORM (Go ORM)",
    version: "v1.25",
    origin: "https://gorm.io",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs/"],
    maxPages: 120,
  },
  // Databases & ORMs (4 Sites)
  {
    id: "redis",
    name: "Redis",
    version: "v7.4",
    origin: "https://redis.io",
    entryPath: "/docs/latest/",
    allowedPrefixes: ["/docs/latest/"],
    maxPages: 160,
  },
  {
    id: "prisma",
    name: "Prisma ORM",
    version: "v6.4",
    origin: "https://www.prisma.io",
    entryPath: "/docs/getting-started",
    allowedPrefixes: ["/docs"],
    maxPages: 150,
  },
  {
    id: "mongodb",
    name: "MongoDB",
    version: "v8.0",
    origin: "https://www.mongodb.com",
    entryPath: "/docs/manual/",
    allowedPrefixes: ["/docs/manual/"],
    maxPages: 160,
  },
  {
    id: "sqlalchemy",
    name: "SQLAlchemy",
    version: "v2.0",
    origin: "https://docs.sqlalchemy.org",
    entryPath: "/en/20/",
    allowedPrefixes: ["/en/20/"],
    maxPages: 150,
  },
  // AI & Machine Learning (7 Sites)
  {
    id: "pytorch",
    name: "PyTorch",
    version: "v2.6",
    origin: "https://pytorch.org",
    entryPath: "/docs/stable/index.html",
    allowedPrefixes: ["/docs/stable/"],
    maxPages: 160,
  },
  {
    id: "langchain",
    name: "LangChain",
    version: "v0.3",
    origin: "https://python.langchain.com",
    entryPath: "/docs/introduction/",
    allowedPrefixes: ["/docs/"],
    maxPages: 150,
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    version: "v4.49",
    origin: "https://huggingface.co",
    entryPath: "/docs/transformers/index",
    allowedPrefixes: ["/docs/transformers"],
    maxPages: 160,
  },
  {
    id: "ollama",
    name: "Ollama",
    version: "v0.5",
    origin: "https://ollama.com",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 80,
  },
  {
    id: "numpy",
    name: "NumPy",
    version: "v2.2",
    origin: "https://numpy.org",
    entryPath: "/doc/stable/",
    allowedPrefixes: ["/doc/stable/"],
    maxPages: 150,
  },
  {
    id: "pandas",
    name: "Pandas",
    version: "v2.2",
    origin: "https://pandas.pydata.org",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs/"],
    maxPages: 160,
  },
  {
    id: "scikit_learn",
    name: "Scikit-learn",
    version: "v1.6",
    origin: "https://scikit-learn.org",
    entryPath: "/stable/",
    allowedPrefixes: ["/stable/"],
    maxPages: 160,
  },
  // DevOps & Cloud (4 Sites)
  {
    id: "kubernetes",
    name: "Kubernetes",
    version: "v1.32",
    origin: "https://kubernetes.io",
    entryPath: "/docs/home/",
    allowedPrefixes: ["/docs/"],
    maxPages: 160,
  },
  {
    id: "nginx",
    name: "Nginx",
    version: "v1.26",
    origin: "https://nginx.org",
    entryPath: "/en/docs/",
    allowedPrefixes: ["/en/docs/"],
    maxPages: 120,
  },
  {
    id: "opentofu",
    name: "OpenTofu / Terraform",
    version: "v1.9",
    origin: "https://opentofu.org",
    entryPath: "/docs/intro/",
    allowedPrefixes: ["/docs/"],
    maxPages: 140,
  },
  {
    id: "ansible",
    name: "Ansible",
    version: "v11",
    origin: "https://docs.ansible.com",
    entryPath: "/ansible/latest/index.html",
    allowedPrefixes: ["/ansible/latest/"],
    maxPages: 150,
  },
  // Systems & Languages (5 Sites)
  {
    id: "tokio",
    name: "Tokio (Async Rust)",
    version: "v1.43",
    origin: "https://tokio.rs",
    entryPath: "/tokio/tutorial",
    allowedPrefixes: ["/tokio/"],
    maxPages: 100,
  },
  {
    id: "axum",
    name: "Axum (Rust Web)",
    version: "v0.8",
    origin: "https://docs.rs",
    entryPath: "/axum/latest/axum/",
    allowedPrefixes: ["/axum/"],
    maxPages: 120,
  },
  {
    id: "json_cpp",
    name: "nlohmann/json (C++)",
    version: "v3.11",
    origin: "https://json.nlohmann.me",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 80,
  },
  {
    id: "fmt_cpp",
    name: "{fmt} C++ Formatting",
    version: "v11.1",
    origin: "https://fmt.dev",
    entryPath: "/latest/",
    allowedPrefixes: ["/latest/"],
    maxPages: 80,
  },
  {
    id: "raylib",
    name: "Raylib Cheatsheet & API",
    version: "v5.5",
    origin: "https://www.raylib.com",
    entryPath: "/cheatsheet/cheatsheet.html",
    allowedPrefixes: ["/cheatsheet/"],
    maxPages: 40,
  },
  // Architecture & Design (4 Sites)
  {
    id: "system_design",
    name: "System Design Primer",
    version: "2026",
    origin: "https://github.com/donnemartin/system-design-primer",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 80,
  },
  {
    id: "design_patterns",
    name: "Software Design Patterns",
    version: "2026",
    origin: "https://www.patterns.dev",
    entryPath: "/vanilla-design-patterns/",
    allowedPrefixes: ["/vanilla-design-patterns", "/react-design-patterns", "/rendering-patterns"],
    maxPages: 100,
  },
  {
    id: "material_design",
    name: "Material Design 3",
    version: "M3",
    origin: "https://m3.material.io",
    entryPath: "/foundations",
    allowedPrefixes: ["/foundations", "/styles", "/components"],
    maxPages: 120,
  },
  {
    id: "refactoring",
    name: "Refactoring & Architecture",
    version: "2026",
    origin: "https://refactoring.guru",
    entryPath: "/refactoring",
    allowedPrefixes: ["/refactoring", "/design-patterns"],
    maxPages: 140,
  },
  {
    id: "better_auth",
    name: "Better Auth",
    version: "v1.1",
    origin: "https://www.better-auth.com",
    entryPath: "/docs/introduction",
    allowedPrefixes: ["/docs"],
    maxPages: 120,
  },
  {
    id: "duckdb",
    name: "DuckDB",
    version: "v1.2",
    origin: "https://duckdb.org",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs"],
    maxPages: 150,
  },
  {
    id: "mysql",
    name: "MySQL",
    version: "8.4 LTS",
    origin: "https://dev.mysql.com",
    entryPath: "/doc/refman/8.4/en/",
    allowedPrefixes: ["/doc/refman/8.4/en/"],
    maxPages: 160,
  },
  {
    id: "mariadb",
    name: "MariaDB",
    version: "11.4",
    origin: "https://mariadb.com",
    entryPath: "/kb/en/documentation/",
    allowedPrefixes: ["/kb/en/"],
    maxPages: 150,
  },
  {
    id: "chroma",
    name: "Chroma DB",
    version: "v0.6",
    origin: "https://docs.trychroma.com",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 100,
  },
  {
    id: "qdrant",
    name: "Qdrant",
    version: "v1.12",
    origin: "https://qdrant.tech",
    entryPath: "/documentation/",
    allowedPrefixes: ["/documentation/"],
    maxPages: 120,
  },
  {
    id: "tensorflow",
    name: "TensorFlow",
    version: "2.18",
    origin: "https://www.tensorflow.org",
    entryPath: "/api_docs/python/tf",
    allowedPrefixes: ["/api_docs/python/tf", "/tutorials"],
    maxPages: 180,
  },
  {
    id: "keras",
    name: "Keras",
    version: "3.8",
    origin: "https://keras.io",
    entryPath: "/",
    allowedPrefixes: ["/getting_started", "/guides", "/api"],
    maxPages: 140,
  },
  {
    id: "flask",
    name: "Flask",
    version: "v3.1",
    origin: "https://flask.palletsprojects.com",
    entryPath: "/",
    allowedPrefixes: ["/en/stable", "/en/latest", "/"],
    maxPages: 100,
  },
  {
    id: "pydantic",
    name: "Pydantic",
    version: "v2.10",
    origin: "https://docs.pydantic.dev",
    entryPath: "/",
    allowedPrefixes: ["/latest", "/"],
    maxPages: 120,
  },
  {
    id: "requests_py",
    name: "Requests (Python)",
    version: "v2.32",
    origin: "https://requests.readthedocs.io",
    entryPath: "/",
    allowedPrefixes: ["/en/latest", "/"],
    maxPages: 80,
  },
  {
    id: "celery",
    name: "Celery",
    version: "v5.4",
    origin: "https://docs.celeryq.dev",
    entryPath: "/",
    allowedPrefixes: ["/en/stable", "/"],
    maxPages: 110,
  },
  {
    id: "serde",
    name: "Serde (Rust)",
    version: "v1.0",
    origin: "https://serde.rs",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 90,
  },
  {
    id: "actix_web",
    name: "Actix Web",
    version: "v4.9",
    origin: "https://actix.rs",
    entryPath: "/docs/",
    allowedPrefixes: ["/docs"],
    maxPages: 100,
  },
  {
    id: "bevy",
    name: "Bevy Engine",
    version: "v0.15",
    origin: "https://bevyengine.org",
    entryPath: "/learn/quick-start/introduction/",
    allowedPrefixes: ["/learn"],
    maxPages: 120,
  },
  {
    id: "clap",
    name: "Clap (Rust)",
    version: "v4.5",
    origin: "https://docs.rs",
    entryPath: "/clap/latest/clap/",
    allowedPrefixes: ["/clap"],
    maxPages: 90,
  },
  {
    id: "fiber",
    name: "Fiber (Go)",
    version: "v2.52",
    origin: "https://gofiber.io",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 110,
  },
  {
    id: "echo",
    name: "Echo (Go)",
    version: "v4.13",
    origin: "https://echo.labstack.com",
    entryPath: "/docs",
    allowedPrefixes: ["/docs", "/guide"],
    maxPages: 100,
  },
  {
    id: "cobra",
    name: "Cobra (Go)",
    version: "v1.9",
    origin: "https://cobra.dev",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 80,
  },
  {
    id: "opencv",
    name: "OpenCV (C++)",
    version: "4.11",
    origin: "https://docs.opencv.org",
    entryPath: "/4.x/",
    allowedPrefixes: ["/4.x/"],
    maxPages: 160,
  },
  {
    id: "imgui",
    name: "Dear ImGui",
    version: "v1.91",
    origin: "https://github.com/ocornut/imgui",
    entryPath: "/",
    allowedPrefixes: ["/ocornut/imgui"],
    maxPages: 80,
  },
  {
    id: "catch2",
    name: "Catch2",
    version: "v3.7",
    origin: "https://github.com/catchorg/Catch2",
    entryPath: "/",
    allowedPrefixes: ["/catchorg/Catch2"],
    maxPages: 80,
  },
  {
    id: "spdlog",
    name: "spdlog",
    version: "v1.15",
    origin: "https://github.com/gabime/spdlog",
    entryPath: "/",
    allowedPrefixes: ["/gabime/spdlog"],
    maxPages: 80,
  },
  {
    id: "matplotlib",
    name: "Matplotlib",
    version: "v3.10",
    origin: "https://matplotlib.org",
    entryPath: "/stable/",
    allowedPrefixes: ["/stable/"],
    maxPages: 160,
  },
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function getInjectedSnippet(_origin: string): string {
  // Runtime scrollbar, interactive UI controllers, and per-site dark/light sync
  // are injected dynamically by inject_reader_bridge in lib.rs.
  return "";
}

function guessMime(urlPath: string, contentTypeHeader?: string | null): string {
  if (contentTypeHeader && !contentTypeHeader.includes("octet-stream")) {
    return contentTypeHeader.split(";")[0].trim() + (contentTypeHeader.includes("text/") ? "; charset=utf-8" : "");
  }
  const clean = urlPath.split("?")[0].toLowerCase();
  if (clean.endsWith(".css")) return "text/css; charset=utf-8";
  if (clean.endsWith(".js") || clean.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".woff2")) return "font/woff2";
  if (clean.endsWith(".woff")) return "font/woff";
  if (clean.endsWith(".ttf")) return "font/ttf";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".ico")) return "image/x-icon";
  if (clean.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/html; charset=utf-8";
}

function normalizeRouteKey(pathname: string): string {
  let p = pathname || "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function assetUrlToLocalRoute(fullUrl: string, siteOrigin: string): string {
  try {
    const u = new URL(fullUrl, siteOrigin);
    if (u.origin === siteOrigin && !u.search) {
      return u.pathname;
    }
    const extMatch = u.pathname.match(/\.(css|js|woff2|woff|ttf|svg|png|jpg|jpeg|webp|ico|gif)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : u.pathname.includes("load.php") ? ".css" : ".bin";
    const hash = crypto.createHash("sha256").update(u.href).digest("hex").slice(0, 14);
    return `/__docx_assets/${hash}${ext}`;
  } catch {
    return fullUrl;
  }
}

function isChallengeOrBlockHtml(html: string): boolean {
  if (!html || html.length < 120) return true;
  const sample = html.slice(0, 4096).toLowerCase();
  return (
    sample.includes("<title>just a moment...</title>") ||
    sample.includes("attention required! | cloudflare") ||
    sample.includes("cf-browser-verification") ||
    sample.includes("cf-chl-bypass") ||
    sample.includes("<title>access denied</title>") ||
    sample.includes("<title>403 forbidden</title>") ||
    sample.includes("<title>429 too many requests</title>")
  );
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 12000,
  maxRetries = 4,
  onRateLimited?: () => void
): Promise<Response | null> {
  let originReferer = "";
  try {
    originReferer = new URL(url).origin + "/";
  } catch {}

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/css,application/javascript,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Upgrade-Insecure-Requests": "1",
          ...(originReferer ? { Referer: originReferer } : {}),
        },
        redirect: "follow",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status === 503 || res.status === 502 || res.status === 403) {
        onRateLimited?.();
        if (attempt + 1 < maxRetries) {
          const retryHeader = res.headers.get("retry-after");
          const retrySec = retryHeader ? parseInt(retryHeader, 10) : NaN;
          const waitMs =
            !isNaN(retrySec) && retrySec > 0 && retrySec <= 30
              ? retrySec * 1000
              : 800 * Math.pow(2, attempt) + Math.floor(Math.random() * 350);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }
      return res;
    } catch {
      clearTimeout(timer);
      if (attempt + 1 < maxRetries) {
        const waitMs = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  return null;
}

export async function buildDocpackForSite(siteId: string, outDir: string) {
  const site = SITE_CATALOG.find((s) => s.id === siteId);
  if (!site) throw new Error(`Unknown site id: ${siteId}`);

  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== Crawling Real Website for [${site.id}] (${site.origin}${site.entryPath}) ===`);

  // Check if a previous manifest exists so we never overwrite a healthy pack with a partial/rate-limited crawl
  let previousRouteCount = 0;
  const existingManifestPath = path.join(outDir, `${site.id}.manifest.json`);
  if (fs.existsSync(existingManifestPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(existingManifestPath, "utf-8"));
      previousRouteCount = Object.keys(prev.routes || {}).length;
    } catch {}
  }

  const maxPages = site.maxPages || 150;
  const visitedPages = new Set<string>();
  const pageQueue: string[] = [site.entryPath];

  // Map of localRouteKey -> { bytes: Buffer, mime: string }
  const rawAssets = new Map<string, { bytes: Buffer; mime: string }>();
  const pendingAssetUrls = new Map<string, string>(); // fullUrl -> localRoute
  const searchEntries: any[] = [];

  function isAllowedPageUrl(u: URL): boolean {
    if (u.origin !== site.origin) return false;
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|pdf|zip|gz|xml|json)$/i.test(u.pathname)) {
      return false;
    }
    return site.allowedPrefixes.some((pref) => u.pathname.startsWith(pref));
  }

  // Adaptive polite concurrency across ALL 57 sites (steps down automatically if any rate-limit signal occurs)
  let batchConcurrency = 6;
  let batchDelayMs = 100;
  const handleRateLimitSignal = () => {
    batchConcurrency = 2;
    batchDelayMs = 450;
  };

  // 1. Crawl HTML pages concurrently in polite batches
  while (pageQueue.length > 0 && visitedPages.size < maxPages) {
    const batch: string[] = [];
    while (pageQueue.length > 0 && batch.length < batchConcurrency && visitedPages.size + batch.length < maxPages) {
      const nextPath = pageQueue.shift()!;
      const norm = normalizeRouteKey(nextPath.split("?")[0].split("#")[0]);
      if (!visitedPages.has(norm)) {
        visitedPages.add(norm);
        batch.push(nextPath);
      }
    }
    if (batch.length === 0) break;

    if (visitedPages.size > batch.length) {
      const jitter = Math.floor(Math.random() * 70);
      await new Promise((r) => setTimeout(r, batchDelayMs + jitter));
    }

    await Promise.all(
      batch.map(async (relPath) => {
        const fullUrl = new URL(relPath, site.origin).href;
        const res = await fetchWithTimeout(fullUrl, 12000, 4, handleRateLimitSignal);
        if (!res || !res.ok) return;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("html")) return;

        let html = await res.text();
        if (isChallengeOrBlockHtml(html)) return;
        const pageUrl = new URL(res.url || fullUrl);
        const routeKey = normalizeRouteKey(pageUrl.pathname);

        // Extract title & description for Universal Search (Ctrl+K)
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const rawTitle = titleMatch
          ? titleMatch[1].replace(/\s+/g, " ").trim()
          : routeKey.split("/").pop() || site.name;
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        const rawDesc = descMatch ? descMatch[1].trim() : `${site.name} documentation — ${rawTitle}`;

        searchEntries.push({
          id: `${site.id}:${routeKey}`,
          site: site.id,
          siteName: site.name,
          title: rawTitle,
          category: site.name,
          description: rawDesc,
          path: pageUrl.pathname,
          url: pageUrl.pathname,
          keywords: [site.id, ...rawTitle.toLowerCase().split(/\W+/).filter(Boolean)].slice(0, 12),
        });

        // Discover same-origin page links <a href="...">
        const hrefRegex = /<a\b[^>]*?\bhref=["']([^"'#]+)["']/gi;
        let m: RegExpExecArray | null;
        while ((m = hrefRegex.exec(html)) !== null) {
          const rawHref = m[1].trim();
          if (!rawHref || rawHref.startsWith("mailto:") || rawHref.startsWith("javascript:")) continue;
          try {
            let effectiveHref = rawHref;
            if (site.id === "threejs" && pageUrl.pathname.startsWith("/docs") && /^[A-Za-z0-9_.-]+\.html$/i.test(rawHref)) {
              effectiveHref = `/docs/pages/${rawHref}`;
            }
            const resolved = new URL(effectiveHref, pageUrl.href);
            if (isAllowedPageUrl(resolved)) {
              const normTarget = normalizeRouteKey(resolved.pathname);
              if (!visitedPages.has(normTarget) && pageQueue.length < maxPages * 2) {
                pageQueue.push(resolved.pathname);
              }
            }
          } catch {}
        }

        // Discover and rewrite stylesheets <link rel="stylesheet"|"preload stylesheet" href="...">
        html = html.replace(
          /(<link\b[^>]*?\bhref=["'])([^"']+)(["'][^>]*>)/gi,
          (fullTag, prefix, rawHref, suffix) => {
            if (!/\brel=["'][^"']*(?:stylesheet|icon)\b/i.test(fullTag)) {
              return fullTag;
            }
            try {
              const resolved = new URL(rawHref.replace(/&amp;/g, "&"), pageUrl.href);
              const localRoute = assetUrlToLocalRoute(resolved.href, site.origin);
              pendingAssetUrls.set(resolved.href, localRoute);
              const cleanPrefix = prefix.replace(/rel=["']preload stylesheet["']/i, 'rel="stylesheet"');
              const cleanSuffix = suffix.replace(/rel=["']preload stylesheet["']/i, 'rel="stylesheet"');
              return `${cleanPrefix}${localRoute}${cleanSuffix}`;
            } catch {
              return fullTag;
            }
          }
        );

        // Discover and rewrite images <img src="..."> (remove srcset so browser uses local src)
        html = html
          .replace(/\bsrcset=["'][^"']*["']/gi, "")
          .replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'])/gi, (fullMatch, prefix, rawSrc, suffix) => {
            if (rawSrc.startsWith("data:")) return fullMatch;
            try {
              const resolved = new URL(rawSrc.replace(/&amp;/g, "&"), pageUrl.href);
              const localRoute = assetUrlToLocalRoute(resolved.href, site.origin);
              pendingAssetUrls.set(resolved.href, localRoute);
              return `${prefix}${localRoute}${suffix}`;
            } catch {
              return fullMatch;
            }
          });

        if (site.id === "angular" || site.id === "nestjs" || site.id === "threejs" || site.id === "rust") {
          // Keep same-origin JS bundles for SPA sites, Three.js page scripts & Rust mdBook highlight/book scripts, strip only external analytics
          html = html.replace(
            /(<script\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>\s*<\/script>)/gi,
            (fullScript, pre, rawSrc, suf) => {
              try {
                const resolved = new URL(rawSrc.replace(/&amp;/g, "&"), pageUrl.href);
                if (resolved.origin !== site.origin) return "";
                const localRoute = assetUrlToLocalRoute(resolved.href, site.origin);
                pendingAssetUrls.set(resolved.href, localRoute);
                return `${pre}${localRoute}${suf}`;
              } catch {
                return "";
              }
            }
          );
        } else {
          // Remove external client-side hydration/analytics <script src="..."> that would fail or overwrite SSR DOM on localhost
          html = html.replace(/<script\b[^>]*?\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi, "");
        }

        // Rewrite absolute origin links inside href="..." to root-relative paths
        const escapedOrigin = site.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        html = html.replace(new RegExp(`href=["']${escapedOrigin}(/[^"']*)["']`, "gi"), 'href="$1"');

        // Inject <base href> so relative URLs (like cppreference href="cpp/language" or threejs pages/) resolve accurately
        if (!/<base\b/i.test(html) && /<head[^>]*>/i.test(html)) {
          const baseHref =
            site.id === "threejs" && (pageUrl.pathname === "/docs" || pageUrl.pathname === "/docs/")
              ? "/docs/"
              : pageUrl.pathname;
          html = html.replace(/(<head[^>]*>)/i, `$1<base href="${baseHref}">`);
        }

        // Inject Docx scrollbar + dark mode + link navigation bridge before </body>
        const snippet = getInjectedSnippet(site.origin);
        if (html.includes("</body>")) {
          html = html.replace("</body>", `${snippet}</body>`);
        } else {
          html += snippet;
        }

        const htmlBytes = Buffer.from(html, "utf-8");
        rawAssets.set(routeKey, { bytes: htmlBytes, mime: "text/html; charset=utf-8" });
        if (pageUrl.pathname !== routeKey) {
          rawAssets.set(pageUrl.pathname, { bytes: htmlBytes, mime: "text/html; charset=utf-8" });
        }
      })
    );
  }

  // Extra SPA / Viewer assets for Three.js, NestJS, and Angular
  if (site.id === "threejs") {
    pendingAssetUrls.set("https://threejs.org/files/main.css", "/files/main.css");
    pendingAssetUrls.set("https://threejs.org/files/page.css", "/files/page.css");
    pendingAssetUrls.set("https://threejs.org/files/page.js", "/files/page.js");
    pendingAssetUrls.set("https://threejs.org/docs/search.json", "/docs/search.json");
  } else if (site.id === "nestjs") {
    pendingAssetUrls.set("https://docs.nestjs.com/chunk-BYCV1OW9.js", "/chunk-BYCV1OW9.js");
  } else if (site.id === "angular") {
    pendingAssetUrls.set("https://v17.angular.io/light-theme.css", "/light-theme.css");
    pendingAssetUrls.set("https://v17.angular.io/dark-theme.css", "/dark-theme.css");
    pendingAssetUrls.set("https://v17.angular.io/generated/navigation.json", "/generated/navigation.json");
    pendingAssetUrls.set("https://v17.angular.io/generated/docs/docs.json", "/generated/docs/docs.json");
    const navRes = await fetchWithTimeout("https://v17.angular.io/generated/navigation.json", 10000, 4, handleRateLimitSignal);
    if (navRes && navRes.ok) {
      const navText = await navRes.text();
      rawAssets.set("/generated/navigation.json", {
        bytes: Buffer.from(navText, "utf-8"),
        mime: "application/json; charset=utf-8",
      });
      const urlMatches = [...navText.matchAll(/"url"\s*:\s*"([^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => !u.startsWith("http") && !u.includes("#"))
        .slice(0, 140);
      for (const u of urlMatches) {
        const cleanU = u.replace(/^\/+/, "");
        pendingAssetUrls.set(
          `https://v17.angular.io/generated/docs/${cleanU}.json`,
          `/generated/docs/${cleanU}.json`
        );
      }
    }
  }

  console.log(
    `  Crawled ${visitedPages.size} HTML pages for ${site.id}, now fetching ${pendingAssetUrls.size} CSS/JS/JSON/image assets...`
  );

  // 2. Download all discovered CSS and image assets + fonts referenced inside CSS (polite batches of 8)
  const fontAndSubAssets = new Map<string, string>();
  const assetEntries = Array.from(pendingAssetUrls.entries());

  for (let i = 0; i < assetEntries.length; i += 8) {
    if (i > 0) await new Promise((r) => setTimeout(r, 60));
    const slice = assetEntries.slice(i, i + 8);
    await Promise.all(
      slice.map(async ([fullUrl, localRoute]) => {
        const normKey = normalizeRouteKey(localRoute);
        if (rawAssets.has(normKey)) return;
        const res = await fetchWithTimeout(fullUrl, 10000, 3, handleRateLimitSignal);
        if (!res || !res.ok) return;
        const ct = res.headers.get("content-type") || "";
        const mime = guessMime(localRoute, ct);

        if (mime.includes("text/css") || localRoute.endsWith(".css")) {
          let cssText = await res.text();
          // Rewrite url(...) inside CSS for fonts & SVGs
          cssText = cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (fullCssUrl, quote, rawTarget) => {
            const cleanTarget = rawTarget.trim();
            if (cleanTarget.startsWith("data:") || cleanTarget.startsWith("#")) return fullCssUrl;
            try {
              const resolved = new URL(cleanTarget, fullUrl);
              const subLocal = assetUrlToLocalRoute(resolved.href, site.origin);
              fontAndSubAssets.set(resolved.href, subLocal);
              return `url("${subLocal}")`;
            } catch {
              return fullCssUrl;
            }
          });
          const buf = Buffer.from(cssText, "utf-8");
          rawAssets.set(normKey, { bytes: buf, mime: "text/css; charset=utf-8" });
          rawAssets.set(localRoute, { bytes: buf, mime: "text/css; charset=utf-8" });
        } else {
          const arr = await res.arrayBuffer();
          const maxBytes = localRoute.endsWith(".js") || localRoute.endsWith(".json") ? 2000 * 1024 : 350 * 1024;
          if (arr.byteLength > maxBytes) return;
          const buf = Buffer.from(arr);
          rawAssets.set(normKey, { bytes: buf, mime });
          rawAssets.set(localRoute, { bytes: buf, mime });
        }
      })
    );
  }

  // 3. Download fonts & SVGs discovered inside CSS files (polite batches of 8)
  const subEntries = Array.from(fontAndSubAssets.entries()).slice(0, 80);
  for (let i = 0; i < subEntries.length; i += 8) {
    if (i > 0) await new Promise((r) => setTimeout(r, 60));
    const slice = subEntries.slice(i, i + 8);
    await Promise.all(
      slice.map(async ([fullUrl, localRoute]) => {
        const normKey = normalizeRouteKey(localRoute);
        if (rawAssets.has(normKey)) return;
        const res = await fetchWithTimeout(fullUrl, 8000, 3, handleRateLimitSignal);
        if (!res || !res.ok) return;
        const arr = await res.arrayBuffer();
        if (arr.byteLength > 300 * 1024) return;
        const mime = guessMime(localRoute, res.headers.get("content-type"));
        const buf = Buffer.from(arr);
        rawAssets.set(normKey, { bytes: buf, mime });
        rawAssets.set(localRoute, { bytes: buf, mime });
      })
    );
  }

  // 4. Pack all HTML + CSS + Fonts + Images into Max-Gzip content-hashed chunks
  const routes: Record<string, any> = {};
  const chunks: Buffer[] = [];
  let currentOffset = 0;
  const hashToChunk = new Map<string, { offset: number; length: number; hash: string }>();

  for (const [routeKey, asset] of rawAssets.entries()) {
    const gz = Buffer.from(Bun.gzipSync(asset.bytes, { level: 9 }));
    const hash = crypto.createHash("sha256").update(gz).digest("hex").slice(0, 16);
    let stored = hashToChunk.get(hash);
    if (!stored) {
      stored = { offset: currentOffset, length: gz.byteLength, hash };
      hashToChunk.set(hash, stored);
      chunks.push(gz);
      currentOffset += gz.byteLength;
    }
    routes[routeKey] = {
      offset: stored.offset,
      length: stored.length,
      mime: asset.mime,
      gzipped: true,
      hash: stored.hash,
    };
  }

  const entryNorm = normalizeRouteKey(site.entryPath);
  const firstHtmlRoute =
    routes[entryNorm] ||
    routes[site.entryPath] ||
    Object.values(routes).find((r: any) => r.mime.includes("text/html"));

  if (firstHtmlRoute) {
    if (!routes["/docs"]) routes["/docs"] = firstHtmlRoute;
    if (!routes["/"]) routes["/"] = firstHtmlRoute;
  }

  const newRouteCount = Object.keys(routes).length;
  if (newRouteCount === 0 || chunks.length === 0 || searchEntries.length === 0) {
    throw new Error(`Crawl for ${site.id} produced 0 valid HTML pages — refusing to overwrite existing .docpack!`);
  }
  if (previousRouteCount > 10 && newRouteCount < Math.floor(previousRouteCount * 0.5)) {
    throw new Error(
      `Crawl for ${site.id} only captured ${newRouteCount} routes vs ${previousRouteCount} previously — refusing to overwrite healthy .docpack!`
    );
  }

  const commitHash = crypto
    .createHash("sha256")
    .update(Array.from(hashToChunk.keys()).sort().join(","))
    .digest("hex")
    .slice(0, 8);

  const manifest = {
    id: site.id,
    name: site.name,
    version: site.version,
    commit: commitHash,
    origin: site.origin,
    entryPath: site.entryPath,
    updatedAt: new Date().toISOString(),
    totalBytes: currentOffset,
    chunkCount: chunks.length,
    routes,
  };

  const manifestBytes = Buffer.from(JSON.stringify(manifest), "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(manifestBytes.byteLength, 0);

  const docpackPath = path.join(outDir, `${site.id}.docpack`);
  const manifestPath = path.join(outDir, `${site.id}.manifest.json`);
  const searchPath = path.join(outDir, `${site.id}.search.json`);

  fs.writeFileSync(docpackPath, Buffer.concat([header, manifestBytes, ...chunks]));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  fs.writeFileSync(searchPath, JSON.stringify(searchEntries, null, 2), "utf-8");

  console.log(
    `✓ Built real-website ${site.id}.docpack: ${(currentOffset / (1024 * 1024)).toFixed(2)} MB (${
      chunks.length
    } unique chunks, ${Object.keys(routes).length} routes, commit ${commitHash})`
  );
}

// CLI Entrypoint
if (import.meta.main) {
  const argSite = process.argv[2];
  const defaultPacksDir = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "docx")
    : path.resolve("packs");
  const outDir = process.argv[3] || defaultPacksDir;
  if (argSite === "--list-json") {
    console.log(JSON.stringify(SITE_CATALOG.map((s) => s.id)));
  } else if (argSite) {
    for (const id of argSite.split(",").map((s) => s.trim()).filter(Boolean)) {
      await buildDocpackForSite(id, outDir);
    }
  }
}
