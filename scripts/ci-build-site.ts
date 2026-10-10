import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

export interface SiteConfig {
  id: string;
  name: string;
  shortName: string;
  version: string;
  color: string;
  category: "Frontend & UI" | "TanStack" | "Backend & Runtime" | "Systems & C++" | "DevOps & CLI";
  description: string;
  type: "github-docs" | "single-html" | "prebuilt" | "crawl-docs";
  repo?: string;
  branch?: string;
  docsPath?: string;
  url?: string;
}

export const SITE_CATALOG: SiteConfig[] = [
  // Already Pre-Built Full Next.js Packs
  {
    id: "tailwind",
    name: "Tailwind CSS",
    shortName: "TW",
    version: "v4.3",
    color: "#38bdf8",
    category: "Frontend & UI",
    description: "Utility-first CSS framework with modern v4 engine.",
    type: "prebuilt",
    repo: "tailwindlabs/tailwindcss.com",
    docsPath: "src/docs",
  },
  {
    id: "shadcn",
    name: "shadcn/ui",
    shortName: "UI",
    version: "v4.0",
    color: "#ffffff",
    category: "Frontend & UI",
    description: "Accessible components built on Radix UI and Base UI.",
    type: "prebuilt",
    repo: "shadcn-ui/ui",
    docsPath: "apps/v4/content/docs",
  },

  // Frontend, Web & Fullstack
  {
    id: "react",
    name: "React",
    shortName: "RC",
    version: "v19",
    color: "#58c4dc",
    category: "Frontend & UI",
    description: "The library for web and native user interfaces.",
    type: "github-docs",
    repo: "reactjs/react.dev",
    docsPath: "src/content",
  },
  {
    id: "nextjs",
    name: "Next.js",
    shortName: "NX",
    version: "v16",
    color: "#ffffff",
    category: "Frontend & UI",
    description: "The React Framework for the Web — App & Pages Router.",
    type: "github-docs",
    repo: "vercel/next.js",
    docsPath: "docs",
  },
  {
    id: "vite",
    name: "Vite",
    shortName: "VT",
    version: "v6",
    color: "#bd34fe",
    category: "Frontend & UI",
    description: "Next generation frontend tooling and build engine.",
    type: "github-docs",
    repo: "vitejs/vite",
    docsPath: "docs",
  },
  {
    id: "astro",
    name: "Astro",
    shortName: "AS",
    version: "v5",
    color: "#ff5d01",
    category: "Frontend & UI",
    description: "The web framework for content-driven websites.",
    type: "github-docs",
    repo: "withastro/docs",
    docsPath: "src/content/docs/en",
  },
  {
    id: "typescript",
    name: "TypeScript",
    shortName: "TS",
    version: "v5.8",
    color: "#3178c6",
    category: "Frontend & UI",
    description: "JavaScript with syntax for types — Handbook & Reference.",
    type: "github-docs",
    repo: "microsoft/TypeScript-Website",
    docsPath: "packages/documentation/copy/en",
  },
  {
    id: "mdn_js",
    name: "MDN JavaScript",
    shortName: "JS",
    version: "ES2026",
    color: "#f7df1e",
    category: "Frontend & UI",
    description: "Mozilla Developer Network complete JavaScript reference & guides.",
    type: "github-docs",
    repo: "mdn/content",
    docsPath: "files/en-us/web/javascript",
  },
  {
    id: "htmx",
    name: "htmx",
    shortName: "HX",
    version: "v4 / v2",
    color: "#3d72d7",
    category: "Frontend & UI",
    description: "High power tools for HTML — AJAX, CSS Transitions, WebSockets.",
    type: "github-docs",
    repo: "bigskysoftware/htmx",
    docsPath: "www/content",
  },

  // Backend, Runtimes & ORM
  {
    id: "bun",
    name: "Bun",
    shortName: "BN",
    version: "v1.2+",
    color: "#fbf0df",
    category: "Backend & Runtime",
    description: "All-in-one JavaScript & TypeScript runtime, bundler, and package manager.",
    type: "github-docs",
    repo: "oven-sh/bun",
    docsPath: "docs",
  },
  {
    id: "elysia",
    name: "ElysiaJS",
    shortName: "EL",
    version: "v1.2",
    color: "#f472b6",
    category: "Backend & Runtime",
    description: "Ergonomic web framework for Humans built on Bun with end-to-end type safety.",
    type: "github-docs",
    repo: "elysiajs/documentation",
    docsPath: "docs",
  },
  {
    id: "drizzle",
    name: "Drizzle ORM",
    shortName: "DZ",
    version: "Latest",
    color: "#c5f74f",
    category: "Backend & Runtime",
    description: "TypeScript ORM that is lightweight, performant, and SQL-first.",
    type: "github-docs",
    repo: "drizzle-team/drizzle-orm-docs",
    docsPath: "src/content/docs",
  },
  {
    id: "oxc",
    name: "Oxc (Oxidation Compiler)",
    shortName: "OX",
    version: "Latest",
    color: "#f97316",
    category: "Backend & Runtime",
    description: "Collection of high-performance JavaScript tools written in Rust.",
    type: "github-docs",
    repo: "oxc-project/website",
    docsPath: "src/docs",
  },

  // TanStack Ecosystem (18 Projects)
  {
    id: "tanstack_start",
    name: "TanStack Start",
    shortName: "T:S",
    version: "Latest",
    color: "#00d8ff",
    category: "TanStack",
    description: "Full-stack React & Solid framework powered by TanStack Router.",
    type: "github-docs",
    repo: "TanStack/router",
    docsPath: "docs/start",
  },
  {
    id: "tanstack_router",
    name: "TanStack Router",
    shortName: "T:R",
    version: "Latest",
    color: "#10b981",
    category: "TanStack",
    description: "100% type-safe routing for React and Solid applications.",
    type: "github-docs",
    repo: "TanStack/router",
    docsPath: "docs/router",
  },
  {
    id: "tanstack_query",
    name: "TanStack Query",
    shortName: "T:Q",
    version: "v5",
    color: "#ef4444",
    category: "TanStack",
    description: "Powerful asynchronous state management & data fetching.",
    type: "github-docs",
    repo: "TanStack/query",
    docsPath: "docs",
  },
  {
    id: "tanstack_db",
    name: "TanStack DB",
    shortName: "T:DB",
    version: "Latest",
    color: "#a855f7",
    category: "TanStack",
    description: "Reactive client-first database & sync engine for TanStack.",
    type: "github-docs",
    repo: "TanStack/db",
    docsPath: "docs",
  },
  {
    id: "tanstack_store",
    name: "TanStack Store",
    shortName: "T:ST",
    version: "Latest",
    color: "#eab308",
    category: "TanStack",
    description: "Framework-agnostic reactive data store powering TanStack libraries.",
    type: "github-docs",
    repo: "TanStack/store",
    docsPath: "docs",
  },
  {
    id: "tanstack_ai",
    name: "TanStack AI",
    shortName: "T:AI",
    version: "Latest",
    color: "#ec4899",
    category: "TanStack",
    description: "AI primitives, streaming state, and client tools for TanStack.",
    type: "github-docs",
    repo: "TanStack/ai",
    docsPath: "docs",
  },
  {
    id: "tanstack_table",
    name: "TanStack Table",
    shortName: "T:TB",
    version: "v8",
    color: "#3b82f6",
    category: "TanStack",
    description: "Headless UI for building powerful tables & datagrids.",
    type: "github-docs",
    repo: "TanStack/table",
    docsPath: "docs",
  },
  {
    id: "tanstack_charts",
    name: "TanStack Charts",
    shortName: "T:CH",
    version: "Latest",
    color: "#06b6d4",
    category: "TanStack",
    description: "Declarative, responsive charts for React.",
    type: "github-docs",
    repo: "TanStack/charts",
    docsPath: "docs",
  },
  {
    id: "tanstack_form",
    name: "TanStack Form",
    shortName: "T:FM",
    version: "Latest",
    color: "#f59e0b",
    category: "TanStack",
    description: "Headless, performant, and type-safe form state management.",
    type: "github-docs",
    repo: "TanStack/form",
    docsPath: "docs",
  },
  {
    id: "tanstack_virtual",
    name: "TanStack Virtual",
    shortName: "T:VR",
    version: "v3",
    color: "#8b5cf6",
    category: "TanStack",
    description: "Headless UI for virtualizing large element lists at 60FPS.",
    type: "github-docs",
    repo: "TanStack/virtual",
    docsPath: "docs",
  },
  {
    id: "tanstack_pacer",
    name: "TanStack Pacer",
    shortName: "T:PC",
    version: "Latest",
    color: "#14b8a6",
    category: "TanStack",
    description: "Rate-limiting, throttling, debouncing, and queuing utilities.",
    type: "github-docs",
    repo: "TanStack/pacer",
    docsPath: "docs",
  },
  {
    id: "tanstack_hotkeys",
    name: "TanStack Hotkeys",
    shortName: "T:HK",
    version: "Latest",
    color: "#f43f5e",
    category: "TanStack",
    description: "Type-safe keyboard shortcuts and keybinding manager.",
    type: "github-docs",
    repo: "TanStack/hotkeys",
    docsPath: "docs",
  },
  {
    id: "tanstack_devtools",
    name: "TanStack Devtools",
    shortName: "T:DT",
    version: "Latest",
    color: "#10b981",
    category: "TanStack",
    description: "Unified developer tools for the TanStack ecosystem.",
    type: "github-docs",
    repo: "TanStack/devtools",
    docsPath: "docs",
  },
  {
    id: "tanstack_config",
    name: "TanStack Config",
    shortName: "T:CF",
    version: "Latest",
    color: "#64748b",
    category: "TanStack",
    description: "Build, publish, and configuration tooling for JS/TS packages.",
    type: "github-docs",
    repo: "TanStack/config",
    docsPath: "docs",
  },
  {
    id: "tanstack_cli",
    name: "TanStack CLI",
    shortName: "T:CL",
    version: "Latest",
    color: "#22c55e",
    category: "TanStack",
    description: "Command-line scaffolding and project tooling for TanStack.",
    type: "github-docs",
    repo: "TanStack/cli",
    docsPath: "docs",
  },
  {
    id: "tanstack_markdown",
    name: "TanStack Markdown & Highlight",
    shortName: "T:MD",
    version: "Latest",
    color: "#38bdf8",
    category: "TanStack",
    description: "TanStack Markdown, Highlight & Intent documentation.",
    type: "github-docs",
    repo: "TanStack/tanstack.com",
    docsPath: "src",
  },

  // Systems, Languages & C++
  {
    id: "rust",
    name: "Rust Documentation (Book, Std, Cargo)",
    shortName: "RS",
    version: "Stable",
    color: "#f97316",
    category: "Systems & C++",
    description: "The Rust Programming Language Book, Rust By Example, Cargo, and Reference.",
    type: "github-docs",
    repo: "rust-lang/book",
    docsPath: "src",
  },
  {
    id: "go",
    name: "Go Documentation",
    shortName: "GO",
    version: "Latest",
    color: "#00add8",
    category: "Systems & C++",
    description: "Official Go programming language documentation, tutorials, and Effective Go.",
    type: "github-docs",
    repo: "golang/website",
    docsPath: "_content/doc",
  },
  {
    id: "cppreference",
    name: "C++ Reference (cppreference)",
    shortName: "C++",
    version: "C++23/26",
    color: "#00599c",
    category: "Systems & C++",
    description: "Complete C and C++ standard library and language reference.",
    type: "github-docs",
    repo: "PeterFeicht/cppreference-doc",
    docsPath: ".",
  },
  {
    id: "learncpp",
    name: "LearnCpp Tutorials",
    shortName: "LCPP",
    version: "Latest",
    color: "#60a5fa",
    category: "Systems & C++",
    description: "Comprehensive C++ programming tutorials from basics to advanced OOP.",
    type: "crawl-docs",
    url: "https://www.learncpp.com/",
  },
  {
    id: "llvm",
    name: "LLVM Compiler Infrastructure",
    shortName: "LLVM",
    version: "Latest",
    color: "#ef4444",
    category: "Systems & C++",
    description: "LLVM Language Reference Manual, passes, backend guides, and architecture.",
    type: "github-docs",
    repo: "llvm/llvm-project",
    docsPath: "llvm/docs",
  },
  {
    id: "lua",
    name: "Lua 5.4 Reference Manual",
    shortName: "LUA",
    version: "5.4",
    color: "#3b82f6",
    category: "Systems & C++",
    description: "Official Lua 5.4 Reference Manual and standard library documentation.",
    type: "single-html",
    url: "https://www.lua.org/manual/5.4/manual.html",
  },

  // DevOps, Build Tools & Shells
  {
    id: "docker",
    name: "Docker Documentation",
    shortName: "DK",
    version: "Latest",
    color: "#2496ed",
    category: "DevOps & CLI",
    description: "Docker Engine, Compose, Dockerfile reference, BuildKit, and CLI guides.",
    type: "github-docs",
    repo: "docker/docs",
    docsPath: "content/manuals",
  },
  {
    id: "git",
    name: "Git Reference Manual",
    shortName: "GIT",
    version: "Latest",
    color: "#f05032",
    category: "DevOps & CLI",
    description: "Official Git SCM command reference and Pro Git documentation.",
    type: "github-docs",
    repo: "git/git",
    docsPath: "Documentation",
  },
  {
    id: "curl",
    name: "cURL Documentation",
    shortName: "CRL",
    version: "Latest",
    color: "#22c55e",
    category: "DevOps & CLI",
    description: "cURL command-line options, libcurl API, and Everything curl guide.",
    type: "github-docs",
    repo: "curl/curl",
    docsPath: "docs",
  },
  {
    id: "cmake",
    name: "CMake Reference",
    shortName: "CMK",
    version: "Latest",
    color: "#064f8c",
    category: "DevOps & CLI",
    description: "CMake commands, variables, properties, modules, and generator expressions.",
    type: "github-docs",
    repo: "Kitware/CMake",
    docsPath: "Help",
  },
  {
    id: "ninja",
    name: "Ninja Build Manual",
    shortName: "NJA",
    version: "Latest",
    color: "#a1a1aa",
    category: "DevOps & CLI",
    description: "Official manual for the Ninja small build system with a focus on speed.",
    type: "single-html",
    url: "https://ninja-build.org/manual.html",
  },
  {
    id: "powershell",
    name: "PowerShell 7.5 Docs",
    shortName: "PS",
    version: "7.5",
    color: "#5391fe",
    category: "DevOps & CLI",
    description: "Official Microsoft PowerShell scripting, Core cmdlets, and about_* topics.",
    type: "github-docs",
    repo: "MicrosoftDocs/PowerShell-Docs",
    docsPath: "reference/7.5/Microsoft.PowerShell.Core",
  },
  {
    id: "cmd",
    name: "Windows CMD Reference",
    shortName: "CMD",
    version: "Win11/Server",
    color: "#d4d4d8",
    category: "DevOps & CLI",
    description: "Official Microsoft A-Z Windows Command Prompt (cmd.exe) commands reference.",
    type: "github-docs",
    repo: "MicrosoftDocs/windowsserverdocs",
    docsPath: "WindowsServerDocs/administration/windows-commands",
  },
];

// Interactive SPA Shell CSS + JS injected into every generated documentation pack
function buildInteractiveDocShellHtml(
  site: SiteConfig,
  pageTitle: string,
  pagePath: string,
  renderedBodyHtml: string,
  headings: { id: string; text: string; level: number }[],
  navTreeHtml: string
): string {
  const tocHtml =
    headings.length > 0
      ? headings
          .map(
            (h) =>
              `<a href="#${h.id}" class="toc-link lvl-${h.level}">${escapeHtml(h.text)}</a>`
          )
          .join("")
      : `<span class="toc-empty">No sub-headings</span>`;

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(pageTitle)} — ${escapeHtml(site.name)}</title>
<style>
:root {
  --bg: #070709;
  --bg-sidebar: #0b0b0e;
  --bg-card: #111116;
  --bg-code: #0d0d12;
  --border: rgba(255,255,255,0.08);
  --text: #f4f4f5;
  --muted: #a1a1aa;
  --accent: ${site.color || "#38bdf8"};
}
html.light {
  --bg: #ffffff;
  --bg-sidebar: #f8fafc;
  --bg-card: #f1f5f9;
  --bg-code: #0f172a;
  --border: rgba(0,0,0,0.1);
  --text: #0f172a;
  --muted: #475569;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #070709; }
::-webkit-scrollbar-thumb { background: #24242b; border-radius: 999px; border: 2px solid #070709; }
::-webkit-scrollbar-thumb:hover { background: #3a3a45; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  display: flex;
  height: 100vh;
  overflow: hidden;
  line-height: 1.65;
}
.doc-sidebar {
  width: 270px;
  min-width: 270px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.sidebar-top {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.site-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  font-size: 0.98rem;
  margin-bottom: 10px;
}
.site-badge {
  font-size: 0.7rem;
  padding: 2px 7px;
  border-radius: 99px;
  background: rgba(255,255,255,0.09);
  color: var(--accent);
}
.sidebar-filter {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 0.82rem;
  outline: none;
}
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px 24px;
}
.nav-group-title {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 12px 8px 4px;
}
.nav-link {
  display: block;
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--muted);
  text-decoration: none;
  font-size: 0.84rem;
  transition: all 0.12s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-link:hover { background: rgba(255,255,255,0.05); color: var(--text); }
.nav-link.active { background: rgba(255,255,255,0.1); color: #fff; font-weight: 600; border-left: 2px solid var(--accent); }
.doc-main {
  flex: 1;
  overflow-y: auto;
  padding: 40px 52px 80px;
}
.doc-article {
  max-width: 780px;
  margin: 0 auto;
}
.doc-article h1 { font-size: 2.1rem; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.02em; }
.doc-article h2 { font-size: 1.45rem; font-weight: 700; margin: 34px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.doc-article h3 { font-size: 1.15rem; font-weight: 600; margin: 24px 0 8px; }
.doc-article p { margin-bottom: 14px; color: var(--text); opacity: 0.92; }
.doc-article ul, .doc-article ol { margin: 0 0 16px 22px; }
.doc-article li { margin-bottom: 6px; }
.doc-article a { color: var(--accent); text-decoration: none; }
.doc-article a:hover { text-decoration: underline; }
.doc-article code {
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
  font-size: 0.85em;
  background: rgba(255,255,255,0.08);
  padding: 2px 5px;
  border-radius: 4px;
}
.code-block-wrap {
  position: relative;
  margin: 16px 0 22px;
  background: var(--bg-code);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.code-block-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--border);
  font-size: 0.74rem;
  color: var(--muted);
  font-family: monospace;
}
.copy-code-btn {
  background: rgba(255,255,255,0.08);
  border: none;
  color: #fff;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  cursor: pointer;
}
.copy-code-btn:hover { background: rgba(255,255,255,0.18); }
.doc-article pre {
  padding: 14px 16px;
  overflow-x: auto;
  font-size: 0.84rem;
  line-height: 1.55;
}
.doc-article pre code { background: none; padding: 0; color: #e4e4e7; }
.doc-article blockquote {
  border-left: 3px solid var(--accent);
  background: var(--bg-card);
  padding: 12px 16px;
  border-radius: 0 8px 8px 0;
  margin: 16px 0;
}
.doc-article table {
  width: 100%;
  border-collapse: collapse;
  margin: 18px 0;
  font-size: 0.88rem;
}
.doc-article th, .doc-article td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
}
.doc-article th { background: var(--bg-card); }
.doc-toc {
  width: 220px;
  min-width: 220px;
  border-left: 1px solid var(--border);
  padding: 28px 16px;
  overflow-y: auto;
  font-size: 0.8rem;
}
.toc-header { font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 10px; }
.toc-link { display: block; color: var(--muted); text-decoration: none; padding: 4px 0; transition: color 0.12s; }
.toc-link:hover { color: var(--text); }
.toc-link.lvl-3 { padding-left: 12px; font-size: 0.76rem; }
@media (max-width: 1100px) { .doc-toc { display: none; } }
</style>
</head>
<body>
  <aside class="doc-sidebar">
    <div class="sidebar-top">
      <div class="site-brand">
        <span>${escapeHtml(site.name)}</span>
        <span class="site-badge">${escapeHtml(site.version)}</span>
      </div>
      <input type="text" class="sidebar-filter" id="navFilter" placeholder="Filter pages..." autocomplete="off" />
    </div>
    <nav class="sidebar-nav" id="sidebarNav" data-current="${escapeHtml(pagePath)}">
      ${navTreeHtml}
    </nav>
  </aside>
  <main class="doc-main">
    <article class="doc-article">
      ${renderedBodyHtml}
    </article>
  </main>
  <aside class="doc-toc">
    <div class="toc-header">On This Page</div>
    ${tocHtml}
  </aside>
<script>
(function(){
  // Filter sidebar links interactively
  var filterInput = document.getElementById('navFilter');
  var nav = document.getElementById('sidebarNav');
  if (nav) {
    var cur = nav.getAttribute('data-current');
    var links = nav.querySelectorAll('.nav-link');
    links.forEach(function(l){
      if (l.getAttribute('href') === cur) {
        l.classList.add('active');
        l.scrollIntoView({ block: 'nearest' });
      }
    });
    if (filterInput) {
      filterInput.addEventListener('input', function(){
        var q = filterInput.value.toLowerCase().trim();
        links.forEach(function(l){
          var match = !q || l.textContent.toLowerCase().indexOf(q) !== -1;
          l.style.display = match ? 'block' : 'none';
        });
      });
    }
  }
  // Copy buttons for code blocks
  document.querySelectorAll('.copy-code-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var pre = btn.closest('.code-block-wrap').querySelector('pre');
      if (pre && navigator.clipboard) {
        navigator.clipboard.writeText(pre.innerText);
        btn.textContent = 'Copied!';
        setTimeout(function(){ btn.textContent = 'Copy'; }, 1400);
      }
    });
  });
  // Docx parent window bridges (Ctrl+K, Left/Top edge hover)
  window.addEventListener('keydown', function(e){
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      window.parent.postMessage({ type: 'OPEN_UNIVERSAL_SEARCH' }, '*');
    }
  }, true);
  var lastL = 0, lastT = 0;
  window.addEventListener('mousemove', function(e){
    var now = Date.now();
    if (e.clientX <= 18 && now - lastL > 120) { lastL = now; window.parent.postMessage({ type: 'HOVER_LEFT_EDGE' }, '*'); }
    if (e.clientY <= 10 && now - lastT > 120) { lastT = now; window.parent.postMessage({ type: 'HOVER_TOP_EDGE' }, '*'); }
  }, { passive: true });
  window.addEventListener('mousedown', function(){
    window.parent.postMessage({ type: 'IFRAME_INTERACT' }, '*');
  }, { passive: true });
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Fast Markdown/MDX/RST to interactive HTML converter
function renderDocMarkup(raw: string, fallbackTitle: string) {
  let content = raw.replace(/\r\n/g, "\n");
  let title = fallbackTitle;
  let description = "";

  // Strip YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const t = fm.match(/^title:\s*(.+)$/m);
    if (t) title = t[1].trim().replace(/^['"]|['"]$/g, "");
    const d = fm.match(/^description:\s*(.+)$/m);
    if (d) description = d[1].trim().replace(/^['"]|['"]$/g, "");
    content = content.slice(fmMatch[0].length);
  }

  // Extract code blocks first
  const codeBlocks: string[] = [];
  content = content.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const cleanLang = lang || "code";
    codeBlocks.push(
      `<div class="code-block-wrap"><div class="code-block-bar"><span>${escapeHtml(
        cleanLang
      )}</span><button class="copy-code-btn">Copy</button></div><pre><code>${escapeHtml(
        code.trim()
      )}</code></pre></div>`
    );
    return `@@CODEBLOCK_${idx}@@`;
  });

  // Strip JSX import/export statements from MDX
  content = content.replace(/^(import|export)\s+.*$/gm, "");

  const headings: { id: string; text: string; level: number }[] = [];
  const lines = content.split("\n");
  const out: string[] = [];
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith("@@CODEBLOCK_")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const m = trimmed.match(/@@CODEBLOCK_(\d+)@@/);
      if (m) out.push(codeBlocks[Number(m[1])]);
      continue;
    }

    const hMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (hMatch) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const level = hMatch[1].length;
      const text = hMatch[2].replace(/\{#.*\}$/, "").trim();
      if (level === 1 && title === fallbackTitle) title = text;
      const id = slugify(text) || `sec-${headings.length}`;
      if (level >= 2 && level <= 3) headings.push({ id, text, level });
      out.push(`<h${level} id="${id}">${formatInline(text)}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<blockquote><p>${formatInline(trimmed.slice(2))}</p></blockquote>`);
      continue;
    }

    if (!description && !trimmed.startsWith("<") && trimmed.length > 25) {
      description = trimmed.replace(/[*_`#\[\]]/g, "").slice(0, 160);
    }

    out.push(`<p>${formatInline(trimmed)}</p>`);
  }

  if (inList) out.push("</ul>");
  if (!out.some((l) => l.startsWith("<h1"))) {
    out.unshift(`<h1>${escapeHtml(title)}</h1>`);
  }

  return { title, description, headings, html: out.join("\n") };
}

function formatInline(s: string): string {
  let res = escapeHtml(s);
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>");
  res = res.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  res = res.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return res;
}

export async function buildDocpackForSite(siteId: string, outDir: string) {
  const site = SITE_CATALOG.find((s) => s.id === siteId);
  if (!site) throw new Error(`Unknown site id: ${siteId}`);

  fs.mkdirSync(outDir, { recursive: true });
  const workDir = path.join(outDir, `.tmp_${site.id}`);
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  console.log(`\n=== Building [${site.id}] (${site.name}) ===`);
  let commitSha = "latest";
  const pages: {
    route: string;
    category: string;
    title: string;
    description: string;
    headings: { id: string; text: string; level: number }[];
    bodyHtml: string;
  }[] = [];

  if (site.type === "single-html" && site.url) {
    const res = await fetch(site.url);
    const rawHtml = await res.text();
    commitSha = crypto.createHash("sha256").update(rawHtml).digest("hex").slice(0, 7);
    pages.push({
      route: "/docs",
      category: "Manual",
      title: site.name,
      description: site.description,
      headings: [],
      bodyHtml: rawHtml,
    });
  } else if (site.type === "crawl-docs" && site.id === "learncpp") {
    const res = await fetch("https://www.learncpp.com/");
    const indexHtml = await res.text();
    commitSha = crypto.createHash("sha256").update(indexHtml).digest("hex").slice(0, 7);
    pages.push({
      route: "/docs",
      category: "Chapters",
      title: "LearnCpp.com Complete Index",
      description: site.description,
      headings: [],
      bodyHtml: indexHtml,
    });
  } else if (site.repo) {
    const repoUrl = `https://github.com/${site.repo}.git`;
    const subPath = site.docsPath || ".";
    try {
      if (subPath === ".") {
        execSync(`git clone --depth 1 "${repoUrl}" "${workDir}"`, { stdio: "inherit" });
      } else {
        execSync(
          `git clone --depth 1 --filter=blob:none --sparse "${repoUrl}" "${workDir}"`,
          { stdio: "inherit" }
        );
        execSync(`git -C "${workDir}" sparse-checkout set "${subPath}"`, { stdio: "inherit" });
      }
      commitSha = execSync(`git -C "${workDir}" rev-parse --short HEAD`).toString().trim();
    } catch (e) {
      console.warn(`Sparse clone warning for ${site.id}:`, e);
    }

    const rootSearchDir = subPath === "." ? workDir : path.join(workDir, subPath);
    const docFiles: string[] = [];

    function walkDocs(dir: string) {
      if (!fs.existsSync(dir) || docFiles.length >= 450) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDocs(full);
        } else if (/\.(mdx?|rst|txt|adoc|html)$/i.test(entry.name)) {
          docFiles.push(full);
        }
      }
    }
    walkDocs(rootSearchDir);

    for (const file of docFiles) {
      const rel = path.relative(rootSearchDir, file).replace(/\\/g, "/");
      const ext = path.extname(file);
      const cleanRel = rel.slice(0, -ext.length).replace(/\/index$/i, "");
      const route = cleanRel ? `/docs/${cleanRel}` : "/docs";
      const parts = cleanRel.split("/").filter(Boolean);
      const category = parts.length > 1 ? parts[0].replace(/-/g, " ") : "Documentation";
      const defaultTitle = (parts[parts.length - 1] || site.name).replace(/[-_]/g, " ");

      const rawText = fs.readFileSync(file, "utf-8");
      const parsed = renderDocMarkup(rawText, defaultTitle);

      pages.push({
        route,
        category,
        title: parsed.title,
        description: parsed.description || site.description,
        headings: parsed.headings,
        bodyHtml: parsed.html,
      });
    }
  }

  if (pages.length === 0) {
    pages.push({
      route: "/docs",
      category: "Overview",
      title: site.name,
      description: site.description,
      headings: [],
      bodyHtml: `<h1>${escapeHtml(site.name)}</h1><p>${escapeHtml(site.description)}</p>`,
    });
  }

  // Group pages by category to build the sidebar navigation HTML
  const byCat = new Map<string, typeof pages>();
  for (const p of pages) {
    const list = byCat.get(p.category) || [];
    list.push(p);
    byCat.set(p.category, list);
  }

  let navTreeHtml = "";
  for (const [cat, list] of byCat.entries()) {
    navTreeHtml += `<div class="nav-group-title">${escapeHtml(cat)}</div>`;
    for (const item of list) {
      navTreeHtml += `<a class="nav-link" href="${escapeHtml(item.route)}">${escapeHtml(
        item.title
      )}</a>`;
    }
  }

  // Pack all pages into Max-Gzip content-hashed chunks
  const routes: Record<string, any> = {};
  const chunks: Buffer[] = [];
  const searchEntries: any[] = [];
  let currentOffset = 0;

  for (const p of pages) {
    const fullHtml = buildInteractiveDocShellHtml(
      site,
      p.title,
      p.route,
      p.bodyHtml,
      p.headings,
      navTreeHtml
    );
    const gz = Buffer.from(Bun.gzipSync(Buffer.from(fullHtml, "utf-8"), { level: 9 }));
    const hash = crypto.createHash("sha256").update(gz).digest("hex").slice(0, 16);
    const offset = currentOffset;
    const length = gz.byteLength;

    chunks.push(gz);
    currentOffset += length;

    routes[p.route] = {
      offset,
      length,
      mime: "text/html; charset=utf-8",
      gzipped: true,
      hash,
    };

    searchEntries.push({
      id: `${site.id}:${p.route}`,
      site: site.id,
      siteName: site.name,
      title: p.title,
      category: p.category,
      description: p.description,
      path: p.route,
      url: p.route,
      keywords: [site.id, p.title.toLowerCase(), ...p.headings.map((h) => h.text.toLowerCase())].slice(0, 15),
    });
  }

  // Ensure /docs root route always exists
  if (!routes["/docs"] && pages.length > 0) {
    routes["/docs"] = routes[pages[0].route];
  }
  routes["/"] = routes["/docs"];

  const manifest = {
    id: site.id,
    name: site.name,
    version: site.version,
    commit: commitSha,
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

  fs.rmSync(workDir, { recursive: true, force: true });

  console.log(
    `✓ Built ${site.id}.docpack (${(currentOffset / (1024 * 1024)).toFixed(2)} MB, ${
      chunks.length
    } chunks, commit ${commitSha})`
  );
}

// CLI Entrypoint: bun run scripts/ci-build-site.ts <siteId> [outDir]
if (import.meta.main) {
  const argSite = process.argv[2];
  const outDir = process.argv[3] || path.resolve("packs");
  if (argSite === "--list-json") {
    console.log(JSON.stringify(SITE_CATALOG.filter((s) => s.type !== "prebuilt").map((s) => s.id)));
  } else if (argSite) {
    for (const id of argSite.split(",").map((s) => s.trim()).filter(Boolean)) {
      await buildDocpackForSite(id, outDir);
    }
  }
}
