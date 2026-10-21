import fs from "fs";
import path from "path";

const sitesDir = path.resolve("docs-desktop/sites.d");

const newSites = [
  // 1. Frontend & UI
  {
    id: "css_tricks",
    order: 3,
    name: "CSS-Tricks Guides",
    version: "2026 Edition",
    category: "Frontend & UI",
    color: "#ff7a18",
    bgTint: "rgba(255, 122, 24, 0.16)",
    description: "In-depth web design and CSS guides: Complete Guide to Flexbox, CSS Grid, Almanac, and Modern Animations.",
    origin: "https://css-tricks.com",
    entryPath: "/guides/",
    allowedPrefixes: ["/guides/", "/snippets/", "/almanac/"],
    maxPages: 120,
    defaultRoutes: [
      { label: "Guides Directory", path: "/guides/" },
      { label: "A Complete Guide to Flexbox", path: "/snippets/css/a-guide-to-flexbox/" },
      { label: "A Complete Guide to CSS Grid", path: "/snippets/css/complete-guide-grid/" },
      { label: "CSS Almanac", path: "/almanac/" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="#ff7a18" stroke-width="1.8" rx="3"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#ff7a18" stroke-width="1.8" stroke-linecap="round"/></svg>`
  },
  {
    id: "base_ui",
    order: 4,
    name: "Base UI",
    version: "v1.0",
    category: "Frontend & UI",
    color: "#007fff",
    bgTint: "rgba(0, 127, 255, 0.16)",
    description: "Unstyled, headless UI component library for React by MUI: robust accessibility, composable primitives, zero CSS bloat.",
    origin: "https://base-ui.com",
    entryPath: "/react/overview/quick-start",
    allowedPrefixes: ["/react/"],
    maxPages: 100,
    defaultRoutes: [
      { label: "Quick Start", path: "/react/overview/quick-start" },
      { label: "Components", path: "/react/components/accordion" },
      { label: "Accessibility", path: "/react/overview/accessibility" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#007fff" stroke-width="1.8"/><path d="M7 8h10M7 12h10M7 16h6" stroke="#007fff" stroke-width="1.8" stroke-linecap="round"/></svg>`
  },

  // 2. Web Frameworks & Tools
  {
    id: "playwright",
    order: 38,
    name: "Playwright",
    version: "v1.50",
    category: "Web Frameworks & Tools",
    color: "#2eadd2",
    bgTint: "rgba(46, 173, 210, 0.16)",
    description: "Reliable end-to-end testing for modern web apps across Chromium, Firefox, and WebKit on Windows, Linux, and macOS.",
    origin: "https://playwright.dev",
    entryPath: "/docs/intro",
    allowedPrefixes: ["/docs/"],
    maxPages: 140,
    defaultRoutes: [
      { label: "Getting Started", path: "/docs/intro" },
      { label: "Writing Tests", path: "/docs/writing-tests" },
      { label: "Locators", path: "/docs/locators" },
      { label: "API Reference", path: "/docs/api/class-playwright" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="8.5" cy="12" r="5.5" stroke="#2eadd2" stroke-width="1.8"/><circle cx="15.5" cy="12" r="5.5" stroke="#45ba4b" stroke-width="1.8"/></svg>`
  },

  // 3. DevOps & Cloud
  {
    id: "mason",
    order: 125,
    name: "Mason CLI",
    version: "v0.1",
    category: "DevOps & Cloud",
    color: "#02569b",
    bgTint: "rgba(2, 86, 155, 0.16)",
    description: "Template generator and brick scaffolding CLI: generate code from reusable bricks and automate project templates.",
    origin: "https://docs.brickhub.dev",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 60,
    defaultRoutes: [
      { label: "Overview", path: "/" },
      { label: "Bricks", path: "/bricks" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#02569b" stroke-width="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="#02569b" stroke-width="1.8"/><rect x="8" y="13" width="8" height="8" rx="1.5" stroke="#02569b" stroke-width="1.8"/></svg>`
  },

  // 4. GUI
  {
    id: "wxwidgets",
    order: 104,
    name: "wxWidgets",
    version: "v3.2",
    category: "GUI",
    color: "#2a75d3",
    bgTint: "rgba(42, 117, 211, 0.16)",
    description: "Cross-platform C++ GUI library that gives native look and feel on Windows, macOS, and Linux using platform controls.",
    origin: "https://docs.wxwidgets.org",
    entryPath: "/3.2/",
    allowedPrefixes: ["/3.2/"],
    maxPages: 160,
    defaultRoutes: [
      { label: "Reference Manual", path: "/3.2/" },
      { label: "Classes by Category", path: "/3.2/page_classesbycat.html" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="2.5" stroke="#2a75d3" stroke-width="1.8"/><path d="M6 9l2.5 6L11 9l2.5 6L16 9" stroke="#2a75d3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: "fltk",
    order: 105,
    name: "FLTK",
    version: "v1.4",
    category: "GUI",
    color: "#e11d48",
    bgTint: "rgba(225, 29, 72, 0.16)",
    description: "Fast Light Toolkit: lightweight cross-platform C++ GUI toolkit designed for small footprint, high speed, and embedded systems.",
    origin: "https://www.fltk.org",
    entryPath: "/doc-1.4/index.html",
    allowedPrefixes: ["/doc-1.4/"],
    maxPages: 140,
    defaultRoutes: [
      { label: "FLTK Documentation", path: "/doc-1.4/index.html" },
      { label: "Classes", path: "/doc-1.4/annotated.html" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 5h16v14H4z" stroke="#e11d48" stroke-width="1.8" rx="2"/><path d="M8 9h8M8 13h5" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round"/></svg>`
  },
  {
    id: "gpui",
    order: 106,
    name: "GPUI",
    version: "v0.1",
    category: "GUI",
    color: "#f59e0b",
    bgTint: "rgba(245, 158, 11, 0.16)",
    description: "Fast, GPU-accelerated desktop UI framework for Rust powering Zed: immediate-mode ergonomics with retained performance.",
    origin: "https://gpui.rs",
    entryPath: "/",
    allowedPrefixes: ["/"],
    maxPages: 60,
    defaultRoutes: [
      { label: "Overview", path: "/" },
      { label: "Getting Started", path: "/docs" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#f59e0b" stroke-width="1.8"/><path d="M8 8h8v8H8z" stroke="#f59e0b" stroke-width="1.5"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5" stroke="#f59e0b" stroke-width="1.5"/></svg>`
  },
  {
    id: "pyqt",
    order: 107,
    name: "PyQt & PySide",
    version: "v6.8",
    category: "GUI",
    color: "#41cd52",
    bgTint: "rgba(65, 205, 82, 0.16)",
    description: "Python bindings for the Qt application framework: Qt Widgets, Qt Quick, QML, and native desktop app creation.",
    origin: "https://doc.qt.io",
    entryPath: "/qtforpython-6/",
    allowedPrefixes: ["/qtforpython-6/"],
    maxPages: 120,
    defaultRoutes: [
      { label: "Qt for Python Guide", path: "/qtforpython-6/" },
      { label: "PySide6 Modules", path: "/qtforpython-6/modules.html" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#41cd52" stroke-width="1.8"/><path d="M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0z" stroke="#41cd52" stroke-width="1.8"/><path d="M15 15l2 2" stroke="#41cd52" stroke-width="1.8" stroke-linecap="round"/></svg>`
  },

  // 5. Graphics & Game APIs
  {
    id: "opengl",
    order: 108,
    name: "OpenGL 4.x",
    version: "v4.6",
    category: "Graphics & Game APIs",
    color: "#5586a4",
    bgTint: "rgba(85, 134, 164, 0.16)",
    description: "Khronos OpenGL Reference Pages: core 2D/3D graphics rendering pipeline, GLSL shaders, textures, and framebuffers.",
    origin: "https://registry.khronos.org",
    entryPath: "/OpenGL-Refpages/gl4/",
    allowedPrefixes: ["/OpenGL-Refpages/gl4/"],
    maxPages: 160,
    defaultRoutes: [
      { label: "GL4 Commands Index", path: "/OpenGL-Refpages/gl4/" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#5586a4" stroke-width="1.8"/><path d="M12 22V12M21 7l-9 5-9-5" stroke="#5586a4" stroke-width="1.8"/></svg>`
  },
  {
    id: "vulkan",
    order: 109,
    name: "Vulkan",
    version: "v1.3",
    category: "Graphics & Game APIs",
    color: "#bd002c",
    bgTint: "rgba(189, 0, 44, 0.16)",
    description: "Low-overhead cross-platform 3D graphics and compute API by Khronos: explicit GPU control, command buffers, and pipeline states.",
    origin: "https://docs.vulkan.org",
    entryPath: "/tutorial/latest/00_Introduction.html",
    allowedPrefixes: ["/tutorial/"],
    maxPages: 100,
    defaultRoutes: [
      { label: "Introduction", path: "/tutorial/latest/00_Introduction.html" },
      { label: "Development Environment", path: "/tutorial/latest/01_Development_environment.html" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 4l9 16L21 4h-5l-4 8-4-8H3z" fill="#bd002c"/></svg>`
  },
  {
    id: "webgpu",
    order: 110,
    name: "WebGPU",
    version: "W3C Spec",
    category: "Graphics & Game APIs",
    color: "#005a9c",
    bgTint: "rgba(0, 90, 156, 0.16)",
    description: "Modern graphics and compute API for the Web: high performance 3D rendering and general GPU compute using WGSL.",
    origin: "https://developer.mozilla.org",
    entryPath: "/en-US/docs/Web/API/WebGPU_API",
    allowedPrefixes: ["/en-US/docs/Web/API/WebGPU_API", "/en-US/docs/Web/API/GPU"],
    maxPages: 100,
    defaultRoutes: [
      { label: "WebGPU Overview", path: "/en-US/docs/Web/API/WebGPU_API" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#005a9c" stroke-width="1.8"/><path d="M7 8l5 8 5-8" stroke="#005a9c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: "directx",
    order: 111,
    name: "DirectX 12",
    version: "D3D12",
    category: "Graphics & Game APIs",
    color: "#0078d4",
    bgTint: "rgba(0, 120, 212, 0.16)",
    description: "Microsoft Direct3D 12 graphics API: bare-metal GPU control, multi-adapter architectures, and low driver overhead on Windows & Xbox.",
    origin: "https://learn.microsoft.com",
    entryPath: "/en-us/windows/win32/direct3d12/direct3d-12-graphics",
    allowedPrefixes: ["/en-us/windows/win32/direct3d12/"],
    maxPages: 120,
    defaultRoutes: [
      { label: "Direct3D 12 Graphics", path: "/en-us/windows/win32/direct3d12/direct3d-12-graphics" },
      { label: "Getting Started", path: "/en-us/windows/win32/direct3d12/getting-started" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" fill="#0078d4"/><rect x="13" y="3" width="8" height="8" fill="#0078d4"/><rect x="3" y="13" width="8" height="8" fill="#0078d4"/><rect x="13" y="13" width="8" height="8" fill="#0078d4"/></svg>`
  },
  {
    id: "metal",
    order: 112,
    name: "Apple Metal",
    version: "Metal 3",
    category: "Graphics & Game APIs",
    color: "#a2aaad",
    bgTint: "rgba(162, 170, 173, 0.16)",
    description: "Apple hardware-accelerated 3D graphics and data-parallel compute framework for iOS, iPadOS, macOS, and visionOS.",
    origin: "https://developer.apple.com",
    entryPath: "/documentation/metal",
    allowedPrefixes: ["/documentation/metal"],
    maxPages: 100,
    defaultRoutes: [
      { label: "Metal Overview", path: "/documentation/metal" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#a2aaad" stroke-width="1.8"/><path d="M7 10l5 3 5-3M12 13v6" stroke="#a2aaad" stroke-width="1.8"/></svg>`
  },
  {
    id: "cuda",
    order: 113,
    name: "NVIDIA CUDA",
    version: "v12.8",
    category: "Graphics & Game APIs",
    color: "#76b900",
    bgTint: "rgba(118, 185, 0, 0.16)",
    description: "NVIDIA parallel computing platform and programming model for general-purpose GPU computing in C and C++.",
    origin: "https://docs.nvidia.com",
    entryPath: "/cuda/cuda-c-programming-guide/index.html",
    allowedPrefixes: ["/cuda/cuda-c-programming-guide/"],
    maxPages: 120,
    defaultRoutes: [
      { label: "Programming Guide", path: "/cuda/cuda-c-programming-guide/index.html" },
      { label: "Introduction", path: "/cuda/cuda-c-programming-guide/index.html#introduction" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 8-8 8 8 0 0 1 8 8 8 8 0 0 1-8 8" stroke="#76b900" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="#76b900"/></svg>`
  },
  {
    id: "sfml",
    order: 114,
    name: "SFML",
    version: "v2.6",
    category: "Graphics & Game APIs",
    color: "#83c024",
    bgTint: "rgba(131, 192, 36, 0.16)",
    description: "Simple and Fast Multimedia Library: portable C++ API for windowing, 2D graphics, audio, and network game development.",
    origin: "https://www.sfml-dev.org",
    entryPath: "/documentation/2.6.1/",
    allowedPrefixes: ["/documentation/2.6.1/"],
    maxPages: 120,
    defaultRoutes: [
      { label: "API Documentation", path: "/documentation/2.6.1/" },
      { label: "Modules", path: "/documentation/2.6.1/modules.php" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l9 6-9 6-9-6 9-6z" stroke="#83c024" stroke-width="1.8"/><path d="M3 14l9 6 9-6" stroke="#83c024" stroke-width="1.8"/></svg>`
  },
  {
    id: "sdl",
    order: 115,
    name: "SDL (SDL2 / SDL3)",
    version: "v3.2",
    category: "Graphics & Game APIs",
    color: "#1772b4",
    bgTint: "rgba(23, 114, 180, 0.16)",
    description: "Simple DirectMedia Layer: cross-platform C development library providing low-level access to audio, keyboard, mouse, joystick, and graphics hardware.",
    origin: "https://wiki.libsdl.org",
    entryPath: "/SDL2/FrontPage",
    allowedPrefixes: ["/SDL2/", "/SDL3/"],
    maxPages: 160,
    defaultRoutes: [
      { label: "SDL2 FrontPage", path: "/SDL2/FrontPage" },
      { label: "API by Category", path: "/SDL2/APIByCategory" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#1772b4" stroke-width="1.8"/><path d="M8 12h8M12 8v8" stroke="#1772b4" stroke-width="1.8" stroke-linecap="round"/></svg>`
  },
  {
    id: "glfw",
    order: 116,
    name: "GLFW",
    version: "v3.4",
    category: "Graphics & Game APIs",
    color: "#e65100",
    bgTint: "rgba(230, 81, 0, 0.16)",
    description: "Open Source, multi-platform library for OpenGL, OpenGL ES and Vulkan development: window creation, input handling, and event loops.",
    origin: "https://www.glfw.org",
    entryPath: "/docs/latest/",
    allowedPrefixes: ["/docs/latest/"],
    maxPages: 120,
    defaultRoutes: [
      { label: "Documentation Overview", path: "/docs/latest/" },
      { label: "Quick Tutorial", path: "/docs/latest/quick.html" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#e65100" stroke-width="1.8"/><path d="M7 8l5 4-5 4M13 16h4" stroke="#e65100" stroke-width="1.8" stroke-linecap="round"/></svg>`
  },

  // 6. Languages & Compilers
  {
    id: "csharp",
    order: 117,
    name: "C# (.NET)",
    version: "C# 13",
    category: "Languages & Compilers",
    color: "#68217a",
    bgTint: "rgba(104, 33, 122, 0.16)",
    description: "Modern, type-safe, object-oriented language for building enterprise applications, cloud microservices, and games on .NET.",
    origin: "https://learn.microsoft.com",
    entryPath: "/en-us/dotnet/csharp/",
    allowedPrefixes: ["/en-us/dotnet/csharp/"],
    maxPages: 160,
    defaultRoutes: [
      { label: "C# Documentation", path: "/en-us/dotnet/csharp/" },
      { label: "Tour of C#", path: "/en-us/dotnet/csharp/tour-of-csharp/" },
      { label: "Language Reference", path: "/en-us/dotnet/csharp/language-reference/" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#68217a" stroke-width="1.8"/><path d="M10 9.5a3 3 0 1 0 0 5M15 10v4M17 10v4M14 11h4M14 13h4" stroke="#68217a" stroke-width="1.5" stroke-linecap="round"/></svg>`
  },
  {
    id: "java",
    order: 118,
    name: "Java SE",
    version: "Java 21 LTS",
    category: "Languages & Compilers",
    color: "#e76f00",
    bgTint: "rgba(231, 111, 0, 0.16)",
    description: "Java SE standard documentation and Dev.java developer tutorials: core language features, streams, virtual threads, and JVM runtime.",
    origin: "https://dev.java",
    entryPath: "/learn/",
    allowedPrefixes: ["/learn/"],
    maxPages: 140,
    defaultRoutes: [
      { label: "Learn Java", path: "/learn/" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M8 18c4 2 8 0 8 0s-4 4-8 0zM7 21c6 2 10 0 10 0s-5 3-10 0z" fill="#e76f00"/><path d="M12 2c2 3-2 5 0 7" stroke="#e76f00" stroke-width="1.8" stroke-linecap="round"/></svg>`
  },
  {
    id: "kotlin",
    order: 119,
    name: "Kotlin",
    version: "v2.1",
    category: "Languages & Compilers",
    color: "#7f52ff",
    bgTint: "rgba(127, 82, 255, 0.16)",
    description: "Modern concise multiplatform language by JetBrains for Android, server-side, web, and native desktop programming.",
    origin: "https://kotlinlang.org",
    entryPath: "/docs/home.html",
    allowedPrefixes: ["/docs/"],
    maxPages: 140,
    defaultRoutes: [
      { label: "Overview", path: "/docs/home.html" },
      { label: "Basics", path: "/docs/basic-syntax.html" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="22 2 2 22 2 2 22 2" fill="#7f52ff"/><polygon points="22 2 12 12 22 22 22 2" fill="#c757bc"/></svg>`
  },
  {
    id: "zig",
    order: 120,
    name: "Zig",
    version: "v0.14",
    category: "Languages & Compilers",
    color: "#f7a41d",
    bgTint: "rgba(247, 164, 29, 0.16)",
    description: "General-purpose systems programming language maintaining robust, optimal and reusable software without hidden control flow.",
    origin: "https://ziglang.org",
    entryPath: "/documentation/master/",
    allowedPrefixes: ["/documentation/master/"],
    maxPages: 100,
    defaultRoutes: [
      { label: "Language Reference", path: "/documentation/master/" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16L6 18h14" stroke="#f7a41d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: "odin",
    order: 121,
    name: "Odin",
    version: "Dev",
    category: "Languages & Compilers",
    color: "#1c698c",
    bgTint: "rgba(28, 105, 140, 0.16)",
    description: "Data-oriented, modern systems programming language designed for high performance, modern architectures, and joy of coding.",
    origin: "https://odin-lang.org",
    entryPath: "/docs/overview/",
    allowedPrefixes: ["/docs/"],
    maxPages: 80,
    defaultRoutes: [
      { label: "Overview", path: "/docs/overview/" },
      { label: "Packages", path: "/docs/packages/" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#1c698c" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#1c698c"/></svg>`
  },
  {
    id: "julia",
    order: 122,
    name: "Julia",
    version: "v1.11",
    category: "Languages & Compilers",
    color: "#9558b2",
    bgTint: "rgba(149, 88, 178, 0.16)",
    description: "High-level, high-performance dynamic programming language for technical computing, data science, and scientific simulations.",
    origin: "https://docs.julialang.org",
    entryPath: "/en/v1/",
    allowedPrefixes: ["/en/v1/"],
    maxPages: 140,
    defaultRoutes: [
      { label: "Manual", path: "/en/v1/manual/getting-started/" },
      { label: "Standard Library", path: "/en/v1/stdlib/LinearAlgebra/" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="16" r="3.5" fill="#cb3c33"/><circle cx="18" cy="16" r="3.5" fill="#389826"/><circle cx="12" cy="7" r="3.5" fill="#9558b2"/></svg>`
  },
  {
    id: "matlab",
    order: 123,
    name: "MATLAB",
    version: "R2024b",
    category: "Languages & Compilers",
    color: "#e16024",
    bgTint: "rgba(225, 96, 36, 0.16)",
    description: "Programming and numeric computing platform used by millions of engineers and scientists to analyze data, develop algorithms, and create models.",
    origin: "https://www.mathworks.com",
    entryPath: "/help/matlab/",
    allowedPrefixes: ["/help/matlab/"],
    maxPages: 120,
    defaultRoutes: [
      { label: "MATLAB Documentation", path: "/help/matlab/" },
      { label: "Language Fundamentals", path: "/help/matlab/language-fundamentals.html" }
    ],
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 14c3-6 5-8 9-8s6 8 9 8" stroke="#e16024" stroke-width="2" stroke-linecap="round"/><path d="M12 6v12" stroke="#e16024" stroke-width="1.8" stroke-dasharray="2 2"/></svg>`
  }
];

for (const site of newSites) {
  const filePath = path.join(sitesDir, `${site.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(site, null, 2) + "\n", "utf8");
  console.log(`Created ${site.id}.json in ${site.category}`);
}

console.log(`✓ All ${newSites.length} site configs created successfully.`);
