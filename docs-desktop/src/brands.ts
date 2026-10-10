export interface SiteBrand {
  id: string;
  name: string;
  version: string;
  category:
    | "Frontend & UI"
    | "TanStack Suite"
    | "Backend & JS/TS"
    | "Systems & Languages"
    | "DevOps, Build & Shells";
  color: string;
  bgTint: string;
  description: string;
  svg: string;
  defaultRoutes?: { label: string; path: string }[];
}

export const SITE_BRANDS: Record<string, SiteBrand> = {
  tailwind: {
    id: "tailwind",
    name: "Tailwind CSS",
    version: "v4.3",
    category: "Frontend & UI",
    color: "#38bdf8",
    bgTint: "rgba(56, 189, 248, 0.14)",
    description:
      "Utility-first CSS framework with layout, flexbox, grid, typography, and modern responsive design.",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z"/></svg>`,
    defaultRoutes: [
      { label: "Installation", path: "/docs/installation/using-vite" },
      { label: "Flexbox", path: "/docs/flex" },
      { label: "Grid", path: "/docs/grid-template-columns" },
      { label: "Colors", path: "/docs/colors" },
      { label: "Dark Mode", path: "/docs/dark-mode" },
    ],
  },
  shadcn: {
    id: "shadcn",
    name: "shadcn/ui",
    version: "v4.0",
    category: "Frontend & UI",
    color: "#ffffff",
    bgTint: "rgba(255, 255, 255, 0.14)",
    description:
      "Beautifully designed accessible UI components built with Radix UI, Base UI, and Tailwind CSS.",
    svg: `<svg viewBox="0 0 256 256" fill="none"><line x1="208" y1="128" x2="128" y2="208" stroke="currentColor" stroke-width="28" stroke-linecap="round"/><line x1="192" y1="40" x2="40" y2="192" stroke="currentColor" stroke-width="28" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Components", path: "/docs/components" },
      { label: "Button", path: "/docs/components/radix/button" },
      { label: "Dialog", path: "/docs/components/radix/dialog" },
      { label: "Sidebar", path: "/docs/components/radix/sidebar" },
      { label: "Data Table", path: "/docs/components/radix/data-table" },
    ],
  },
  react: {
    id: "react",
    name: "React",
    version: "v19.1",
    category: "Frontend & UI",
    color: "#61dafb",
    bgTint: "rgba(97, 218, 251, 0.14)",
    description:
      "The library for web and native user interfaces with Hooks, Server Components, and Actions.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="2.1" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></svg>`,
  },
  nextjs: {
    id: "nextjs",
    name: "Next.js",
    version: "v15.3",
    category: "Frontend & UI",
    color: "#e4e4e7",
    bgTint: "rgba(228, 228, 231, 0.14)",
    description:
      "The React Framework for the Web featuring App Router, Server Actions, and Turbopack.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 16V8L16.8 18.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15.5 8V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  vite: {
    id: "vite",
    name: "Vite",
    version: "v6.3",
    category: "Frontend & UI",
    color: "#bd34fe",
    bgTint: "rgba(189, 52, 254, 0.15)",
    description:
      "Next generation frontend tooling with instant HMR, Rollup/Rolldown bundling, and plugin API.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M21 4L12 21L3 4L12 7.5L21 4Z" stroke="#bd34fe" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 3L10 11.5H14L11 18" stroke="#ffd62e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  astro: {
    id: "astro",
    name: "Astro",
    version: "v5.6",
    category: "Frontend & UI",
    color: "#ff5d01",
    bgTint: "rgba(255, 93, 1, 0.15)",
    description:
      "The web framework for content-driven websites with Islands Architecture and Content Collections.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4.5 19H8.5L10.2 14.8H13.8L15.5 19H19.5L12 3Z" stroke="#ff5d01" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 19.5C9.5 21 10.6 22 12 22C13.4 22 14.5 21 14.5 19.5" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  mdn_js: {
    id: "mdn_js",
    name: "MDN JavaScript",
    version: "ES2025",
    category: "Frontend & UI",
    color: "#f7df1e",
    bgTint: "rgba(247, 223, 30, 0.14)",
    description:
      "Complete Mozilla Developer Network JavaScript language reference, built-in objects, and Web APIs.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#f7df1e"/><path d="M10.5 13.5V16.8C10.5 17.6 9.9 18.2 9 18.2C8.2 18.2 7.7 17.7 7.5 17M14.5 16.8C14.9 17.7 15.7 18.2 16.8 18.2C17.9 18.2 18.7 17.6 18.7 16.7C18.7 15.7 18 15.3 16.7 14.8C15.5 14.3 14.8 13.8 14.8 12.8C14.8 11.9 15.5 11.3 16.6 11.3C17.5 11.3 18.1 11.7 18.4 12.4" stroke="#000000" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  },
  htmx: {
    id: "htmx",
    name: "htmx",
    version: "v4.0",
    category: "Frontend & UI",
    color: "#3d72d7",
    bgTint: "rgba(61, 114, 215, 0.15)",
    description:
      "High power tools for HTML: access AJAX, CSS Transitions, WebSockets, and SSE directly in markup.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/><line x1="14" y1="4" x2="10" y2="20" stroke="#38bdf8"/></svg>`,
  },

  // Backend & JS/TS
  typescript: {
    id: "typescript",
    name: "TypeScript",
    version: "v5.8",
    category: "Backend & JS/TS",
    color: "#3178c6",
    bgTint: "rgba(49, 120, 198, 0.16)",
    description:
      "Typed JavaScript at Any Scale: Handbook, tsconfig reference, type manipulation, and compiler API.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#3178c6"/><path d="M7.5 11H12.5M10 11V18M14.5 17C14.9 17.7 15.7 18.1 16.7 18.1C17.8 18.1 18.6 17.5 18.6 16.6C18.6 15.7 17.9 15.3 16.6 14.8C15.4 14.3 14.7 13.8 14.7 12.8C14.7 11.9 15.4 11.3 16.5 11.3C17.4 11.3 18 11.7 18.3 12.3" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  },
  bun: {
    id: "bun",
    name: "Bun",
    version: "v1.2",
    category: "Backend & JS/TS",
    color: "#f472b6",
    bgTint: "rgba(244, 114, 182, 0.15)",
    description:
      "Fast all-in-one JavaScript & TypeScript runtime, bundler, test runner, and Node.js-compatible package manager.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 4C7 4 3.5 7.8 3.5 12.5C3.5 17.2 7.3 20 12 20C16.7 20 20.5 17.2 20.5 12.5C20.5 7.8 17 4 12 4Z" stroke="#fbf0df" stroke-width="1.8"/><circle cx="9.5" cy="12" r="1.2" fill="#fbf0df"/><circle cx="14.5" cy="12" r="1.2" fill="#fbf0df"/><path d="M10.5 15C11 15.8 13 15.8 13.5 15" stroke="#f472b6" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  },
  elysia: {
    id: "elysia",
    name: "ElysiaJS",
    version: "v1.2",
    category: "Backend & JS/TS",
    color: "#c084fc",
    bgTint: "rgba(192, 132, 252, 0.15)",
    description:
      "Ergonomic Framework for Humans: end-to-end type safety with Eden Treaty, OpenAPI, and Bun performance.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L19 7V17L12 22L5 17V7L12 2Z"/><path d="M8 12H16M8 8.5H14M8 15.5H13" stroke="#f472b6"/></svg>`,
  },
  drizzle: {
    id: "drizzle",
    name: "Drizzle ORM",
    version: "v0.41",
    category: "Backend & JS/TS",
    color: "#c5f74f",
    bgTint: "rgba(197, 247, 79, 0.14)",
    description:
      "Headless TypeScript ORM with SQL-like & relational queries, Drizzle Kit migrations, and zero overhead.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#c5f74f" stroke-width="2.4" stroke-linecap="round"><line x1="7" y1="6" x2="5" y2="14"/><line x1="13" y1="5" x2="11" y2="13"/><line x1="19" y1="7" x2="17" y2="15"/><line x1="10" y1="14" x2="8" y2="20"/><line x1="16" y1="13" x2="14" y2="19"/></svg>`,
  },
  oxc: {
    id: "oxc",
    name: "Oxc (Oxidation Compiler)",
    version: "latest",
    category: "Backend & JS/TS",
    color: "#fb923c",
    bgTint: "rgba(251, 146, 60, 0.15)",
    description:
      "Collection of high-performance JavaScript/TypeScript tools written in Rust: oxlint, parser, transformer, resolver.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  },

  // Systems & Languages
  rust: {
    id: "rust",
    name: "Rust Stable Suite",
    version: "1.86",
    category: "Systems & Languages",
    color: "#f97316",
    bgTint: "rgba(249, 115, 22, 0.15)",
    description:
      "Full Rust documentation suite: The Rust Book, Standard Library API (`std`), Cargo Book, Rustonomicon & Reference.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2V5M12 19V22M2 12H5M19 12H22M4.9 4.9L7.1 7.1M16.9 16.9L19.1 19.1M19.1 4.9L16.9 7.1M7.1 16.9L4.9 19.1" stroke-linecap="round"/></svg>`,
  },
  go: {
    id: "go",
    name: "Go (Golang)",
    version: "go1.24",
    category: "Systems & Languages",
    color: "#00add8",
    bgTint: "rgba(0, 173, 216, 0.15)",
    description:
      "Official Go language specification, Effective Go, Standard Library packages, modules, and concurrency guides.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="4" stroke="#00add8" stroke-width="1.9"/><path d="M10.5 10.2C9.8 9.4 8.2 9.4 7.3 10.4C6.4 11.4 6.5 13 7.4 13.9C8.3 14.8 9.9 14.7 10.6 13.7V12.2H8.9" stroke="#00add8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15.5" cy="12" r="2.5" stroke="#00add8" stroke-width="1.9"/></svg>`,
  },
  cppreference: {
    id: "cppreference",
    name: "C++ Reference (cppreference)",
    version: "C++23/26",
    category: "Systems & Languages",
    color: "#3b82f6",
    bgTint: "rgba(59, 130, 246, 0.15)",
    description:
      "Complete C and C++ standard library reference: STL containers, algorithms, ranges, coroutines, and memory model.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 8.5C8.5 7.2 6 7.5 4.8 9.2C3.6 10.9 3.6 13.1 4.8 14.8C6 16.5 8.5 16.8 10 15.5"/><path d="M14 10V14M12 12H16"/><path d="M19.5 10V14M17.5 12H21.5"/></svg>`,
  },
  learncpp: {
    id: "learncpp",
    name: "LearnCpp.com",
    version: "2026",
    category: "Systems & Languages",
    color: "#60a5fa",
    bgTint: "rgba(96, 165, 250, 0.15)",
    description:
      "Step-by-step modern C++ tutorials from fundamentals and pointers to move semantics, templates, and OOP.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20V22H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z"/><path d="M10 8V12M8 10H12M15 8V12M13 10H17" stroke-linecap="round"/></svg>`,
  },
  llvm: {
    id: "llvm",
    name: "LLVM Compiler Infrastructure",
    version: "v20.1",
    category: "Systems & Languages",
    color: "#818cf8",
    bgTint: "rgba(129, 140, 248, 0.15)",
    description:
      "LLVM Language Reference Manual (IR), Kaleidoscope tutorial, Pass Manager, TableGen, and backend codegen.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  },
  lua: {
    id: "lua",
    name: "Lua 5.4 Reference",
    version: "v5.4",
    category: "Systems & Languages",
    color: "#6366f1",
    bgTint: "rgba(99, 102, 241, 0.15)",
    description:
      "Official Lua 5.4 Reference Manual, metatables, coroutines, standard libraries, and C API embedding guide.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="13" r="7" stroke="#6366f1" stroke-width="2"/><circle cx="13.5" cy="10.5" r="2" fill="#6366f1"/><circle cx="18.5" cy="5.5" r="2" fill="#818cf8"/></svg>`,
  },

  // DevOps, Build & Shells
  docker: {
    id: "docker",
    name: "Docker Docs",
    version: "v28",
    category: "DevOps, Build & Shells",
    color: "#2496ed",
    bgTint: "rgba(36, 150, 237, 0.15)",
    description:
      "Docker Engine, Dockerfile reference, Docker Compose v2 specification, BuildKit, and multi-stage builds.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="3" height="3"/><rect x="8" y="10" width="3" height="3"/><rect x="12" y="10" width="3" height="3"/><rect x="8" y="6" width="3" height="3"/><rect x="12" y="6" width="3" height="3"/><path d="M2 13.5H18.5C20 13.5 21.5 12.5 22 11C20.5 10.5 19.5 11 19 12C18.5 18 14 19.5 9 19.5C4.5 19.5 2 17 2 13.5Z"/></svg>`,
  },
  git: {
    id: "git",
    name: "Git Reference Manual",
    version: "v2.49",
    category: "DevOps, Build & Shells",
    color: "#f05032",
    bgTint: "rgba(240, 80, 50, 0.15)",
    description:
      "Complete git-scm manual: porcelain & plumbing commands, rebase, worktrees, bisect, hooks, and Pro Git book.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><line x1="6" y1="8.5" x2="6" y2="15.5"/><path d="M6 8.5C6 12 15.5 12 15.5 12"/></svg>`,
  },
  curl: {
    id: "curl",
    name: "curl & libcurl",
    version: "v8.13",
    category: "DevOps, Build & Shells",
    color: "#2dd4bf",
    bgTint: "rgba(45, 212, 191, 0.15)",
    description:
      "Every curl command-line flag, HTTP/2 & HTTP/3 transfers, TLS certificates, proxies, and libcurl C API.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3.6 9H20.4M3.6 15H20.4"/><path d="M12 3C9.5 7 9.5 17 12 21M12 3C14.5 7 14.5 17 12 21"/></svg>`,
  },
  cmake: {
    id: "cmake",
    name: "CMake Reference",
    version: "v4.0",
    category: "DevOps, Build & Shells",
    color: "#ef4444",
    bgTint: "rgba(239, 68, 68, 0.15)",
    description:
      "CMake commands, target properties, generator expressions, presets (`CMakePresets.json`), and CTest.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L3 20H21L12 3Z" stroke="#ef4444" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 3L12 15L21 20" stroke="#3b82f6" stroke-width="1.7"/><path d="M3 20L12 15" stroke="#22c55e" stroke-width="1.7"/></svg>`,
  },
  ninja: {
    id: "ninja",
    name: "Ninja Build Manual",
    version: "v1.12",
    category: "DevOps, Build & Shells",
    color: "#f43f5e",
    bgTint: "rgba(244, 63, 94, 0.15)",
    description:
      "Small build system with a focus on speed: build.ninja syntax, rules, pools, depfiles, and subninjas.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><polygon points="12 2 14.8 9.2 22 12 14.8 14.8 12 22 9.2 14.8 2 12 9.2 9.2 12 2"/><circle cx="12" cy="12" r="2"/></svg>`,
  },
  powershell: {
    id: "powershell",
    name: "PowerShell 7.5",
    version: "v7.5",
    category: "DevOps, Build & Shells",
    color: "#5391fe",
    bgTint: "rgba(83, 145, 254, 0.15)",
    description:
      "Microsoft PowerShell cmdlets, object pipelines, scripting, modules, remoting, and `about_*` conceptual topics.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><polyline points="7.5 9 11.5 12 7.5 15"/><line x1="12.5" y1="15" x2="16.5" y2="15"/></svg>`,
  },
  cmd: {
    id: "cmd",
    name: "Windows CMD Commands",
    version: "Win11/Server",
    category: "DevOps, Build & Shells",
    color: "#10b981",
    bgTint: "rgba(16, 185, 129, 0.15)",
    description:
      "Complete A-Z Windows Command Prompt reference (`cmd.exe`), batch scripting, `for /f`, `robocopy`, `netsh`, and `diskpart`.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9L10 12L7 15"/><line x1="12" y1="15" x2="17" y2="15"/></svg>`,
  },

  // TanStack Suite (16 Libraries)
  tanstack_query: {
    id: "tanstack_query",
    name: "TanStack Query",
    version: "v5",
    category: "TanStack Suite",
    color: "#ff4154",
    bgTint: "rgba(255, 65, 84, 0.15)",
    description: "Powerful asynchronous state management, caching, synchronization, and mutations for TS/JS.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 14H12L11 22L20 10H12L13 2Z"/></svg>`,
  },
  tanstack_router: {
    id: "tanstack_router",
    name: "TanStack Router",
    version: "v1",
    category: "TanStack Suite",
    color: "#10b981",
    bgTint: "rgba(16, 185, 129, 0.15)",
    description: "100% type-safe routing for React with built-in data loaders, search param validation, and file-based routing.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M8.5 16.5C12 14 12 10 15.5 7.5"/></svg>`,
  },
  tanstack_start: {
    id: "tanstack_start",
    name: "TanStack Start",
    version: "v1",
    category: "TanStack Suite",
    color: "#06b6d4",
    bgTint: "rgba(6, 182, 212, 0.15)",
    description: "Full-stack React framework powered by TanStack Router, Vinxi/Vite, SSR, streaming, and Server Functions.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  },
  tanstack_table: {
    id: "tanstack_table",
    name: "TanStack Table",
    version: "v8",
    category: "TanStack Suite",
    color: "#3b82f6",
    bgTint: "rgba(59, 130, 246, 0.15)",
    description: "Headless UI for building powerful tables & datagrids with sorting, filtering, pagination, and grouping.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  },
  tanstack_form: {
    id: "tanstack_form",
    name: "TanStack Form",
    version: "v1",
    category: "TanStack Suite",
    color: "#f59e0b",
    bgTint: "rgba(245, 158, 11, 0.15)",
    description: "Headless, performant, and type-safe form state management with async validation and Standard Schema.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9H16M8 13H16M8 17H12"/></svg>`,
  },
  tanstack_virtual: {
    id: "tanstack_virtual",
    name: "TanStack Virtual",
    version: "v3",
    category: "TanStack Suite",
    color: "#a855f7",
    bgTint: "rgba(168, 85, 247, 0.15)",
    description: "Headless UI for virtualizing massive 60fps lists, grids, and tables with fixed or dynamic sizes.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`,
  },
  tanstack_store: {
    id: "tanstack_store",
    name: "TanStack Store",
    version: "v0.7",
    category: "TanStack Suite",
    color: "#ec4899",
    bgTint: "rgba(236, 72, 153, 0.15)",
    description: "Framework-agnostic reactive data store with fine-grained signals and derived state.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5V12C4 13.7 7.6 15 12 15C16.4 15 20 13.7 20 12V5"/><path d="M4 12V19C4 20.7 7.6 22 12 22C16.4 22 20 20.7 20 19V12"/></svg>`,
  },
  tanstack_db: {
    id: "tanstack_db",
    name: "TanStack DB",
    version: "latest",
    category: "TanStack Suite",
    color: "#14b8a6",
    bgTint: "rgba(20, 184, 166, 0.15)",
    description: "Reactive client-first database and sync engine with live queries and optimistic mutations.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6V18C4 19.7 7.6 21 12 21C16.4 21 20 19.7 20 18V6"/></svg>`,
  },
  tanstack_ai: {
    id: "tanstack_ai",
    name: "TanStack AI",
    version: "latest",
    category: "TanStack Suite",
    color: "#c084fc",
    bgTint: "rgba(192, 132, 252, 0.15)",
    description: "Type-safe AI streaming, tool calling, and agentic UI primitives for modern web apps.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z"/></svg>`,
  },
  tanstack_pacer: {
    id: "tanstack_pacer",
    name: "TanStack Pacer",
    version: "latest",
    category: "TanStack Suite",
    color: "#fb923c",
    bgTint: "rgba(251, 146, 60, 0.15)",
    description: "Debouncing, throttling, rate-limiting, queuing, and batching utilities with reactive state.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9V13L15 15"/><path d="M9 2H15"/></svg>`,
  },
  tanstack_ranger: {
    id: "tanstack_ranger",
    name: "TanStack Ranger",
    version: "v1",
    category: "TanStack Suite",
    color: "#38bdf8",
    bgTint: "rgba(56, 189, 248, 0.15)",
    description: "Headless range and multi-thumb slider primitives for React.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="8" cy="12" r="3" fill="#09090b"/><circle cx="16" cy="12" r="3" fill="#09090b"/></svg>`,
  },
  tanstack_config: {
    id: "tanstack_config",
    name: "TanStack Config",
    version: "latest",
    category: "TanStack Suite",
    color: "#94a3b8",
    bgTint: "rgba(148, 163, 184, 0.15)",
    description: "Build, Vite/Rollup publishing, and release configuration for TypeScript libraries.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.51 1H21a2 2 0 1 1 0 4h-.09c-.74.05-1.25.4-1.51 1z"/></svg>`,
  },
  tanstack_devtools: {
    id: "tanstack_devtools",
    name: "TanStack Devtools",
    version: "latest",
    category: "TanStack Suite",
    color: "#f43f5e",
    bgTint: "rgba(244, 63, 94, 0.15)",
    description: "Unified developer tools panel and inspection utilities for the TanStack ecosystem.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><path d="M7 14L9.5 16L7 18"/></svg>`,
  },
  tanstack_hotkeys: {
    id: "tanstack_hotkeys",
    name: "TanStack Hotkeys",
    version: "latest",
    category: "TanStack Suite",
    color: "#eab308",
    bgTint: "rgba(234, 179, 8, 0.15)",
    description: "Type-safe keyboard shortcuts, key sequences, and scoped hotkey bindings.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="9" x2="6.01" y2="9"/><line x1="10" y1="9" x2="10.01" y2="9"/><line x1="14" y1="9" x2="14.01" y2="9"/><line x1="18" y1="9" x2="18.01" y2="9"/><line x1="8" y1="15" x2="16" y2="15"/></svg>`,
  },
  tanstack_react_charts: {
    id: "tanstack_react_charts",
    name: "TanStack React Charts",
    version: "v3",
    category: "TanStack Suite",
    color: "#22c55e",
    bgTint: "rgba(34, 197, 94, 0.15)",
    description: "Simple, immersive & interactive charts for React.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  },
  tanstack_create_tsrouter_app: {
    id: "tanstack_create_tsrouter_app",
    name: "Create TS Router App",
    version: "latest",
    category: "TanStack Suite",
    color: "#2dd4bf",
    bgTint: "rgba(45, 212, 191, 0.15)",
    description: "CLI scaffolding tool for TanStack Router and TanStack Start applications.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5V19M5 12H19"/></svg>`,
  },
};

export function getSiteBrand(siteId: string, fallbackName?: string, fallbackVer?: string): SiteBrand {
  if (SITE_BRANDS[siteId]) {
    return SITE_BRANDS[siteId];
  }
  return {
    id: siteId,
    name: fallbackName || siteId,
    version: fallbackVer || "latest",
    category: "Backend & JS/TS",
    color: "#38bdf8",
    bgTint: "rgba(56, 189, 248, 0.14)",
    description: `Offline documentation pack for ${fallbackName || siteId}.`,
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20V22H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z"/></svg>`,
  };
}
