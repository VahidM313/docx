export type SiteCategory =
  | "Frontend & UI"
  | "React Ecosystem"
  | "Vue Ecosystem"
  | "Web Frameworks & Tools"
  | "TanStack Suite"
  | "Backend, Auth & APIs"
  | "Databases & SQL"
  | "AI & Machine Learning"
  | "Python Ecosystem"
  | "Rust Ecosystem"
  | "Go (Golang)"
  | "C & C++ Ecosystem"
  | "DevOps & Cloud"
  | "Architecture & Design";

export interface SiteBrand {
  id: string;
  name: string;
  version: string;
  category: SiteCategory;
  color: string;
  bgTint: string;
  description: string;
  svg: string;
  defaultRoutes?: { label: string; path: string }[];
}

export const SITE_BRANDS: Record<string, SiteBrand> = {
  // ==========================================
  // 1. Frontend & UI (8)
  // ==========================================
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
  mdn_css: {
    id: "mdn_css",
    name: "MDN CSS",
    version: "CSS3 / Modern",
    category: "Frontend & UI",
    color: "#2563eb",
    bgTint: "rgba(37, 99, 235, 0.15)",
    description:
      "Complete Mozilla Developer Network CSS reference: selectors, flexbox, grid, animations, and properties.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 3L6 19.5L12 21.2L18 19.5L19.5 3H4.5Z" stroke="#2563eb" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 7H17L16.5 11H8.5L8.8 14H15.5L15 17.5L12 18.3L9 17.5L8.8 15.5" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    defaultRoutes: [
      { label: "Reference", path: "/en-US/docs/Web/CSS/Reference" },
      { label: "Selectors", path: "/en-US/docs/Web/CSS/CSS_selectors" },
      { label: "Flexbox", path: "/en-US/docs/Web/CSS/CSS_flexible_box_layout" },
      { label: "Grid", path: "/en-US/docs/Web/CSS/CSS_grid_layout" },
      { label: "Animations", path: "/en-US/docs/Web/CSS/CSS_animations" },
    ],
  },
  mdn_html: {
    id: "mdn_html",
    name: "MDN HTML",
    version: "HTML5",
    category: "Frontend & UI",
    color: "#e34f26",
    bgTint: "rgba(227, 79, 38, 0.15)",
    description:
      "Complete Mozilla Developer Network HTML reference: elements, attributes, forms, semantic markup, and Web APIs.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 3L6 19.5L12 21.2L18 19.5L19.5 3H4.5Z" stroke="#e34f26" stroke-width="1.8" stroke-linejoin="round"/><path d="M16.5 7H7.5L8 11.5H15.8L15.3 16.5L12 17.5L8.7 16.5L8.5 14" stroke="#e34f26" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    defaultRoutes: [
      { label: "Reference", path: "/en-US/docs/Web/HTML/Reference" },
      { label: "Elements", path: "/en-US/docs/Web/HTML/Reference/Elements" },
      { label: "Attributes", path: "/en-US/docs/Web/HTML/Global_attributes" },
      { label: "Forms", path: "/en-US/docs/Web/HTML/Element/form" },
      { label: "Structure", path: "/en-US/docs/Web/HTML" },
    ],
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
  threejs: {
    id: "threejs",
    name: "Three.js",
    version: "r175",
    category: "Frontend & UI",
    color: "#000000",
    bgTint: "rgba(255, 255, 255, 0.15)",
    description:
      "JavaScript 3D Library: WebGL & WebGPU renderers, geometries, materials, shaders, lights, and scene graph.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2L3 7L12 12L21 7L12 2Z"/><path d="M3 17L12 22L21 17"/><path d="M3 12L12 17L21 12"/></svg>`,
  },
  motion: {
    id: "motion",
    name: "Motion",
    version: "v12",
    category: "Frontend & UI",
    color: "#ff0088",
    bgTint: "rgba(255, 0, 136, 0.15)",
    description:
      "Production-ready animation and gesture library for React, Vue, and vanilla JavaScript (formerly Framer Motion).",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 4H20V12H12L4 4Z" fill="#ff0088"/><path d="M4 12H12L20 20H4V12Z" fill="#ff0088" fill-opacity="0.6"/></svg>`,
  },
  lucide: {
    id: "lucide",
    name: "Lucide Icons",
    version: "v0.475",
    category: "Frontend & UI",
    color: "#f56565",
    bgTint: "rgba(245, 101, 101, 0.15)",
    description:
      "Beautiful & consistent icon toolkit made by the community, supporting React, Vue, Svelte, and HTML.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#f56565" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    defaultRoutes: [
      { label: "Icon Directory", path: "/icons" },
      { label: "Installation", path: "/guide/installation" },
      { label: "React Package", path: "/guide/packages/lucide-react" },
    ],
  },

  // ==========================================
  // 2. React Ecosystem (6)
  // ==========================================
  react: {
    id: "react",
    name: "React",
    version: "v19.1",
    category: "React Ecosystem",
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
    category: "React Ecosystem",
    color: "#e4e4e7",
    bgTint: "rgba(228, 228, 231, 0.14)",
    description:
      "The React Framework for the Web featuring App Router, Server Actions, and Turbopack.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 16V8L16.8 18.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15.5 8V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  react_hook_form: {
    id: "react_hook_form",
    name: "React Hook Form",
    version: "v7.54",
    category: "React Ecosystem",
    color: "#ec5990",
    bgTint: "rgba(236, 89, 144, 0.15)",
    description:
      "Performant, flexible and extensible forms with easy-to-use validation for React & Next.js.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#ec5990" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="m9 14 2 2 4-4"/></svg>`,
    defaultRoutes: [
      { label: "Get Started", path: "/get-started" },
      { label: "useForm API", path: "/docs/useform" },
      { label: "useController", path: "/docs/usecontroller" },
      { label: "TS Types", path: "/ts" },
    ],
  },
  radix_ui: {
    id: "radix_ui",
    name: "Radix Primitives",
    version: "v1.1",
    category: "React Ecosystem",
    color: "#15b886",
    bgTint: "rgba(21, 184, 134, 0.15)",
    description:
      "Unstyled, accessible UI components for building high-quality design systems and web apps.",
    svg: `<svg viewBox="0 0 25 25" fill="none"><path d="M12 25C18.6274 25 24 19.6274 24 13C24 6.37258 18.6274 1 12 1C5.37258 1 0 6.37258 0 13C0 19.6274 5.37258 25 12 25Z" fill="#15b886" fill-opacity="0.2"/><path d="M12 6V18M6 12H18" stroke="#15b886" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Overview", path: "/primitives/docs/overview/introduction" },
      { label: "Dialog", path: "/primitives/docs/components/dialog" },
      { label: "Dropdown Menu", path: "/primitives/docs/components/dropdown-menu" },
      { label: "Tooltip", path: "/primitives/docs/components/tooltip" },
    ],
  },
  zustand: {
    id: "zustand",
    name: "Zustand",
    version: "v5.0",
    category: "React Ecosystem",
    color: "#e8912d",
    bgTint: "rgba(232, 145, 45, 0.15)",
    description:
      "Small, fast and scalable bearbones state management solution using simplified flux principles.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#e8912d" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.5" fill="#e8912d"/><circle cx="15" cy="10" r="1.5" fill="#e8912d"/><path d="M9 15c1 1 5 1 6 0"/></svg>`,
    defaultRoutes: [
      { label: "Introduction", path: "/learn/getting-started/introduction" },
      { label: "Comparison", path: "/learn/getting-started/comparison" },
      { label: "TypeScript", path: "/learn/guides/beginner-typescript" },
      { label: "Reset State", path: "/learn/guides/how-to-reset-state" },
    ],
  },
  swr: {
    id: "swr",
    name: "SWR (Vercel)",
    version: "v2.3",
    category: "React Ecosystem",
    color: "#ffffff",
    bgTint: "rgba(255, 255, 255, 0.15)",
    description:
      "React Hooks for Data Fetching: Stale-While-Revalidate caching, mutation, pagination, and real-time sync.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/></svg>`,
    defaultRoutes: [
      { label: "Getting Started", path: "/docs/getting-started" },
      { label: "Data Fetching", path: "/docs/data-fetching" },
      { label: "Mutation", path: "/docs/mutation" },
      { label: "Pagination", path: "/docs/pagination" },
    ],
  },

  // ==========================================
  // 3. Vue Ecosystem (5)
  // ==========================================
  vue: {
    id: "vue",
    name: "Vue.js",
    version: "v3.5",
    category: "Vue Ecosystem",
    color: "#42b883",
    bgTint: "rgba(66, 184, 131, 0.15)",
    description:
      "The Progressive JavaScript Framework: Composition API, Single-File Components, reactive ref/computed.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 15L2 3H6.5L12 10.5L17.5 3H22L12 15Z" fill="#42b883"/><path d="M12 15L6.5 3H9.5L12 7.5L14.5 3H17.5L12 15Z" fill="#35495e"/></svg>`,
  },
  nuxt: {
    id: "nuxt",
    name: "Nuxt",
    version: "v4.x",
    category: "Vue Ecosystem",
    color: "#00dc82",
    bgTint: "rgba(0, 220, 130, 0.15)",
    description:
      "The Intuitive Vue Framework: file-based routing, auto-imports, SSR/SSG rendering, and Nitro server engine.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#00dc82" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18L7.5 7L13 18H2Z"/><path d="M10 18L14.5 9L19 18H10Z"/><path d="M16 18L19 12L22 18H16Z"/></svg>`,
  },
  pinia: {
    id: "pinia",
    name: "Pinia",
    version: "v3.0",
    category: "Vue Ecosystem",
    color: "#ffd859",
    bgTint: "rgba(255, 216, 89, 0.15)",
    description:
      "The intuitive, type-safe store and state management library for Vue 3 with Devtools support and SSR.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v6c0 5.5 3.8 10 8 11 4.2-1 8-5.5 8-11V7l-8-5z" stroke="#ffd859" stroke-width="1.8"/><circle cx="12" cy="11" r="3" fill="#ffd859"/></svg>`,
    defaultRoutes: [
      { label: "Introduction", path: "/introduction.html" },
      { label: "Getting Started", path: "/getting-started.html" },
      { label: "State", path: "/core-concepts/state.html" },
      { label: "Getters", path: "/core-concepts/getters.html" },
      { label: "Actions", path: "/core-concepts/actions.html" },
    ],
  },
  vueuse: {
    id: "vueuse",
    name: "VueUse",
    version: "v12.0",
    category: "Vue Ecosystem",
    color: "#41b883",
    bgTint: "rgba(65, 184, 131, 0.15)",
    description:
      "Collection of essential Vue Composition Utilities: browser sensors, animation, state, and reactivity helpers.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#41b883" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    defaultRoutes: [
      { label: "Guide", path: "/guide/" },
      { label: "Best Practices", path: "/guide/best-practice.html" },
      { label: "useMouse", path: "/core/useMouse/" },
      { label: "useElementSize", path: "/core/useElementSize/" },
    ],
  },
  vue_router: {
    id: "vue_router",
    name: "Vue Router",
    version: "v4.5",
    category: "Vue Ecosystem",
    color: "#42b883",
    bgTint: "rgba(66, 184, 131, 0.15)",
    description:
      "The official routing library for Vue.js: nested routes, navigation guards, transitions, and history modes.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#42b883" stroke-width="1.8"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v6M9 6h6"/></svg>`,
    defaultRoutes: [
      { label: "Introduction", path: "/introduction.html" },
      { label: "Getting Started", path: "/guide/" },
      { label: "Dynamic Matching", path: "/guide/essentials/dynamic-matching.html" },
      { label: "Navigation Guards", path: "/guide/advanced/navigation-guards.html" },
    ],
  },

  // ==========================================
  // 4. Web Frameworks & Tools (9)
  // ==========================================
  svelte: {
    id: "svelte",
    name: "Svelte",
    version: "v5.0",
    category: "Web Frameworks & Tools",
    color: "#ff3e00",
    bgTint: "rgba(255, 62, 0, 0.15)",
    description:
      "Cybernetically enhanced web apps with Runes, fine-grained signals, zero-runtime compilation, and speed.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5c-2.48 0-4.5-1.5-4.5-3.5h2c0 1 1.12 1.5 2.5 1.5s2.5-.5 2.5-1.5c0-2-5-1.5-5-4 0-1.5 1.34-2.5 3-2.5s3 1 3 2.5h-2c0-.7-.5-1-1-1s-1 .3-1 1c0 1.8 5 1.5 5 4 0 1.8-1.5 3-3.5 3z" fill="#ff3e00"/></svg>`,
    defaultRoutes: [
      { label: "Overview", path: "/docs/svelte/overview" },
      { label: "Runes", path: "/docs/svelte/runes" },
      { label: "Reactivity", path: "/docs/svelte/what-is-reactivity" },
      { label: "Components", path: "/docs/svelte/basic-markup" },
    ],
  },
  solidjs: {
    id: "solidjs",
    name: "SolidJS",
    version: "v1.9",
    category: "Web Frameworks & Tools",
    color: "#4f88c6",
    bgTint: "rgba(79, 136, 198, 0.15)",
    description:
      "Simple and performant reactivity for building user interfaces without a virtual DOM.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#4f88c6" stroke-width="1.8"/><path d="M12 6l5 3-5 3-5-3 5-3zM7 11.5l5 3v5l-5-3v-5zM17 11.5v5l-5 3v-5l5-3z" fill="#4f88c6" fill-opacity="0.3"/></svg>`,
    defaultRoutes: [
      { label: "Quick Start", path: "/quick-start" },
      { label: "Signals", path: "/concepts/signals" },
      { label: "Effects", path: "/concepts/effects" },
      { label: "API Reference", path: "/reference" },
    ],
  },
  astro: {
    id: "astro",
    name: "Astro",
    version: "v5.6",
    category: "Web Frameworks & Tools",
    color: "#ff5d01",
    bgTint: "rgba(255, 93, 1, 0.15)",
    description:
      "The web framework for content-driven websites with Islands Architecture and Content Collections.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L4.5 19H8.5L10.2 14.8H13.8L15.5 19H19.5L12 3Z" stroke="#ff5d01" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 19.5C9.5 21 10.6 22 12 22C13.4 22 14.5 21 14.5 19.5" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  vite: {
    id: "vite",
    name: "Vite",
    version: "v6.3",
    category: "Web Frameworks & Tools",
    color: "#bd34fe",
    bgTint: "rgba(189, 52, 254, 0.15)",
    description:
      "Next generation frontend tooling with instant HMR, Rollup/Rolldown bundling, and plugin API.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M21 4L12 21L3 4L12 7.5L21 4Z" stroke="#bd34fe" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 3L10 11.5H14L11 18" stroke="#ffd62e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  angular: {
    id: "angular",
    name: "Angular",
    version: "v17",
    category: "Web Frameworks & Tools",
    color: "#dd0031",
    bgTint: "rgba(221, 0, 49, 0.15)",
    description:
      "The web development platform for enterprise applications: Signals, hydration, control flow syntax.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 21 5.5 19.5 17.5 12 22 4.5 17.5 3 5.5 12 2" stroke="#dd0031" stroke-width="1.8" stroke-linejoin="round"/><polygon points="12 5.5 16.5 15.5 14.5 15.5 13.5 13 10.5 13 9.5 15.5 7.5 15.5 12 5.5" fill="#dd0031"/></svg>`,
  },
  bun: {
    id: "bun",
    name: "Bun",
    version: "v1.2",
    category: "Web Frameworks & Tools",
    color: "#f472b6",
    bgTint: "rgba(244, 114, 182, 0.15)",
    description:
      "Fast all-in-one JavaScript & TypeScript runtime, bundler, test runner, and Node.js-compatible package manager.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 4C7 4 3.5 7.8 3.5 12.5C3.5 17.2 7.3 20 12 20C16.7 20 20.5 17.2 20.5 12.5C20.5 7.8 17 4 12 4Z" stroke="#fbf0df" stroke-width="1.8"/><circle cx="9.5" cy="12" r="1.2" fill="#fbf0df"/><circle cx="14.5" cy="12" r="1.2" fill="#fbf0df"/><path d="M10.5 15C11 15.8 13 15.8 13.5 15" stroke="#f472b6" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  },
  oxc: {
    id: "oxc",
    name: "Oxc (Oxidation Compiler)",
    version: "latest",
    category: "Web Frameworks & Tools",
    color: "#fb923c",
    bgTint: "rgba(251, 146, 60, 0.15)",
    description:
      "Collection of high-performance JavaScript/TypeScript tools written in Rust: oxlint, parser, transformer, resolver.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  },
  typescript: {
    id: "typescript",
    name: "TypeScript",
    version: "v5.8",
    category: "Web Frameworks & Tools",
    color: "#3178c6",
    bgTint: "rgba(49, 120, 198, 0.16)",
    description:
      "Typed JavaScript at Any Scale: Handbook, tsconfig reference, type manipulation, and compiler API.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#3178c6"/><path d="M7.5 11H12.5M10 11V18M14.5 17C14.9 17.7 15.7 18.1 16.7 18.1C17.8 18.1 18.6 17.5 18.6 16.6C18.6 15.7 17.9 15.3 16.6 14.8C15.4 14.3 14.7 13.8 14.7 12.8C14.7 11.9 15.4 11.3 16.5 11.3C17.4 11.3 18 11.7 18.3 12.3" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  },
  mdn_js: {
    id: "mdn_js",
    name: "MDN JavaScript",
    version: "ES2025",
    category: "Web Frameworks & Tools",
    color: "#f7df1e",
    bgTint: "rgba(247, 223, 30, 0.14)",
    description:
      "Complete Mozilla Developer Network JavaScript language reference, built-in objects, and Web APIs.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#f7df1e"/><path d="M10.5 13.5V16.8C10.5 17.6 9.9 18.2 9 18.2C8.2 18.2 7.7 17.7 7.5 17M14.5 16.8C14.9 17.7 15.7 18.2 16.8 18.2C17.9 18.2 18.7 17.6 18.7 16.7C18.7 15.7 18 15.3 16.7 14.8C15.5 14.3 14.8 13.8 14.8 12.8C14.8 11.9 15.5 11.3 16.6 11.3C17.5 11.3 18.1 11.7 18.4 12.4" stroke="#000000" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  },
  mdn_wasm: {
    id: "mdn_wasm",
    name: "MDN WebAssembly",
    version: "Wasm 2.0",
    category: "Web Frameworks & Tools",
    color: "#654ff0",
    bgTint: "rgba(101, 79, 240, 0.16)",
    description:
      "Complete Mozilla Developer Network WebAssembly documentation: concepts, JavaScript API, memory, and C/C++/Rust compilation.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#654ff0"/><path d="M6.5 7.5L8.5 16.5L10.5 10L12.5 16.5L14.5 7.5" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 16.5L17.5 7.5L19.5 16.5M16.2 13.5H18.8" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    defaultRoutes: [
      { label: "Overview", path: "/en-US/docs/WebAssembly" },
      { label: "Concepts", path: "/en-US/docs/WebAssembly/Concepts" },
      { label: "JS Interface", path: "/en-US/docs/WebAssembly/JavaScript_interface" },
      { label: "C/C++ to Wasm", path: "/en-US/docs/WebAssembly/C_to_wasm" },
      { label: "Rust to Wasm", path: "/en-US/docs/WebAssembly/Rust_to_wasm" },
    ],
  },

  // ==========================================
  // 5. TanStack Suite (16)
  // ==========================================
  tanstack_start: {
    id: "tanstack_start",
    name: "TanStack Start",
    version: "v1",
    category: "TanStack Suite",
    color: "#06b6d4",
    bgTint: "rgba(6, 182, 212, 0.15)",
    description:
      "Full-stack React framework powered by TanStack Router, Vite, and server functions.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  },
  tanstack_router: {
    id: "tanstack_router",
    name: "TanStack Router",
    version: "v1",
    category: "TanStack Suite",
    color: "#10b981",
    bgTint: "rgba(16, 185, 129, 0.15)",
    description:
      "Fully type-safe client & SSR routing with first-class search params, loaders, and code splitting.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12"/></svg>`,
  },
  tanstack_query: {
    id: "tanstack_query",
    name: "TanStack Query",
    version: "v5",
    category: "TanStack Suite",
    color: "#ef4444",
    bgTint: "rgba(239, 68, 68, 0.15)",
    description:
      "Powerful asynchronous state management for TS/JS, React, Solid, Vue, Svelte, and Angular.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  },
  tanstack_table: {
    id: "tanstack_table",
    name: "TanStack Table",
    version: "v8",
    category: "TanStack Suite",
    color: "#3b82f6",
    bgTint: "rgba(59, 130, 246, 0.15)",
    description:
      "Headless UI for building powerful tables & datagrids: sorting, filtering, grouping, and virtualization.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`,
  },
  tanstack_form: {
    id: "tanstack_form",
    name: "TanStack Form",
    version: "v1",
    category: "TanStack Suite",
    color: "#f59e0b",
    bgTint: "rgba(245, 158, 11, 0.15)",
    description:
      "Headless, performant, and type-safe form state management with async validation.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`,
  },
  tanstack_virtual: {
    id: "tanstack_virtual",
    name: "TanStack Virtual",
    version: "v3",
    category: "TanStack Suite",
    color: "#8b5cf6",
    bgTint: "rgba(139, 92, 246, 0.15)",
    description:
      "Headless UI for virtualizing large element lists with dynamic row heights and smooth scrolling.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`,
  },
  tanstack_store: {
    id: "tanstack_store",
    name: "TanStack Store",
    version: "v0.7",
    category: "TanStack Suite",
    color: "#ec4899",
    bgTint: "rgba(236, 72, 153, 0.15)",
    description:
      "Framework agnostic, lightweight state management store with granular subscriptions.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  },
  tanstack_db: {
    id: "tanstack_db",
    name: "TanStack DB",
    version: "latest",
    category: "TanStack Suite",
    color: "#14b8a6",
    bgTint: "rgba(20, 184, 166, 0.15)",
    description:
      "Reactive client database collections and indexes for real-time frontend apps.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="7" y2="8"/><line x1="7" y1="12" x2="7" y2="12"/><line x1="7" y1="16" x2="7" y2="16"/></svg>`,
  },
  tanstack_ai: {
    id: "tanstack_ai",
    name: "TanStack AI",
    version: "latest",
    category: "TanStack Suite",
    color: "#6366f1",
    bgTint: "rgba(99, 102, 241, 0.15)",
    description:
      "AI chat hooks, streaming utilities, and LLM integrations for TanStack applications.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2"/></svg>`,
  },
  tanstack_pacer: {
    id: "tanstack_pacer",
    name: "TanStack Pacer",
    version: "latest",
    category: "TanStack Suite",
    color: "#0284c7",
    bgTint: "rgba(2, 132, 199, 0.15)",
    description:
      "Rate-limiting, concurrency scheduling, batching, and async pacing utilities.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  },
  tanstack_ranger: {
    id: "tanstack_ranger",
    name: "TanStack Ranger",
    version: "v1",
    category: "TanStack Suite",
    color: "#d946ef",
    bgTint: "rgba(217, 70, 239, 0.15)",
    description:
      "Headless multi-range slider and range picker primitives for web interfaces.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12"/><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/></svg>`,
  },
  tanstack_config: {
    id: "tanstack_config",
    name: "TanStack Config",
    version: "latest",
    category: "TanStack Suite",
    color: "#64748b",
    bgTint: "rgba(100, 116, 139, 0.15)",
    description:
      "Shared TypeScript and bundling configurations for enterprise monorepos.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  },
  tanstack_devtools: {
    id: "tanstack_devtools",
    name: "TanStack Devtools",
    version: "latest",
    category: "TanStack Suite",
    color: "#f43f5e",
    bgTint: "rgba(244, 63, 94, 0.15)",
    description:
      "Integrated debugging panel for router, query, and form cache inspection.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  },
  tanstack_hotkeys: {
    id: "tanstack_hotkeys",
    name: "TanStack Hotkeys",
    version: "latest",
    category: "TanStack Suite",
    color: "#a855f7",
    bgTint: "rgba(168, 85, 247, 0.15)",
    description:
      "Type-safe keyboard shortcut binding and keyboard navigation system.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M8 16h8"/></svg>`,
  },
  tanstack_react_charts: {
    id: "tanstack_react_charts",
    name: "TanStack React Charts",
    version: "v3",
    category: "TanStack Suite",
    color: "#059669",
    bgTint: "rgba(5, 150, 105, 0.15)",
    description:
      "Declarative, responsive SVG charting components for React applications.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  },
  tanstack_create_tsrouter_app: {
    id: "tanstack_create_tsrouter_app",
    name: "Create TS Router App",
    version: "latest",
    category: "TanStack Suite",
    color: "#0284c7",
    bgTint: "rgba(2, 132, 199, 0.15)",
    description:
      "CLI generator for scaffolding modern type-safe TanStack Router projects.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  },

  // ==========================================
  // 6. Backend, Auth & APIs (7)
  // ==========================================
  better_auth: {
    id: "better_auth",
    name: "Better Auth",
    version: "v1.1",
    category: "Backend, Auth & APIs",
    color: "#f59e0b",
    bgTint: "rgba(245, 158, 11, 0.15)",
    description:
      "The comprehensive authentication framework for TypeScript: email/password, social OAuth, 2FA, passkeys, sessions, and plugins.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5"/></svg>`,
    defaultRoutes: [
      { label: "Introduction", path: "/docs/introduction" },
      { label: "Installation", path: "/docs/installation" },
      { label: "Basic Usage", path: "/docs/basic-usage" },
      { label: "Plugins", path: "/docs/plugins" },
    ],
  },
  nodejs: {
    id: "nodejs",
    name: "Node.js API",
    version: "v22 LTS",
    category: "Backend, Auth & APIs",
    color: "#5fa04e",
    bgTint: "rgba(95, 160, 78, 0.15)",
    description:
      "Official Node.js JavaScript runtime API: fs, path, http, crypto, streams, worker_threads, buffer, and child_process.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7.2v9.6L12 22l9-5.2V7.2L12 2z" stroke="#5fa04e" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.5" stroke="#5fa04e" stroke-width="1.8"/></svg>`,
    defaultRoutes: [
      { label: "API Index", path: "/docs/latest-v22.x/api/" },
      { label: "File System (fs)", path: "/docs/latest-v22.x/api/fs.html" },
      { label: "HTTP", path: "/docs/latest-v22.x/api/http.html" },
      { label: "Streams", path: "/docs/latest-v22.x/api/stream.html" },
    ],
  },
  express: {
    id: "express",
    name: "Express.js",
    version: "v5.1",
    category: "Backend, Auth & APIs",
    color: "#94a3b8",
    bgTint: "rgba(148, 163, 184, 0.15)",
    description:
      "Fast, unopinionated, minimalist web framework for Node.js: routing, middleware, request/response API.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8H11M4 12H9M4 16H11"/><path d="M14 9L20 16M20 9L14 16"/></svg>`,
  },
  hono: {
    id: "hono",
    name: "Hono",
    version: "v4.7",
    category: "Backend, Auth & APIs",
    color: "#ff5c13",
    bgTint: "rgba(255, 92, 19, 0.15)",
    description:
      "Ultrafast web framework built on Web Standards for Cloudflare Workers, Bun, Deno, and Node.js with RPC.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C12 2 6 8 6 14C6 17.8 8.7 21 12 21C15.3 21 18 17.8 18 14C18 11 16.2 8.5 14.5 7C14.5 9.5 13 10.5 12 10.5C11 10.5 12.8 6 12 2Z" stroke="#ff5c13" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
  },
  nestjs: {
    id: "nestjs",
    name: "NestJS",
    version: "v11",
    category: "Backend, Auth & APIs",
    color: "#ea2845",
    bgTint: "rgba(234, 40, 69, 0.15)",
    description:
      "Progressive Node.js framework for building efficient, scalable enterprise server-side applications with TypeScript.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#ea2845" stroke-width="1.9" stroke-linecap="round"><path d="M12 3C7 3 3 7 3 12C3 17 7 21 12 21C17 21 21 17 21 12"/><path d="M15 4C18.5 5.5 20 9 18 13C16 17 11 18 8 15C6 13 7 9 10 8C13 7 15 10 13 12"/></svg>`,
  },
  elysia: {
    id: "elysia",
    name: "ElysiaJS",
    version: "v1.2",
    category: "Backend, Auth & APIs",
    color: "#c084fc",
    bgTint: "rgba(192, 132, 252, 0.15)",
    description:
      "Ergonomic Framework for Humans: end-to-end type safety with Eden Treaty, OpenAPI, and Bun performance.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L19 7V17L12 22L5 17V7L12 2Z"/><path d="M8 12H16M8 8.5H14M8 15.5H13" stroke="#f472b6"/></svg>`,
  },
  zod: {
    id: "zod",
    name: "Zod",
    version: "v3.24",
    category: "Backend, Auth & APIs",
    color: "#3e67b1",
    bgTint: "rgba(62, 103, 177, 0.15)",
    description:
      "TypeScript-first schema declaration and validation library with static type inference and zero dependencies.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="5 4 19 4 7 20 19 20" stroke="#3e67b1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/" },
      { label: "Basic Usage", path: "/#basic-usage" },
      { label: "Primitives", path: "/#primitives" },
      { label: "Objects", path: "/#objects" },
    ],
  },

  // ==========================================
  // 7. Databases & SQL (11)
  // ==========================================
  postgresql: {
    id: "postgresql",
    name: "PostgreSQL",
    version: "v17",
    category: "Databases & SQL",
    color: "#38bdf8",
    bgTint: "rgba(56, 189, 248, 0.15)",
    description:
      "The World's Most Advanced Open Source Relational Database: SQL syntax, JSONB, indexing, MVCC, and replication.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="6" rx="8" ry="3.2"/><path d="M4 6V12C4 13.8 7.6 15.2 12 15.2C16.4 15.2 20 13.8 20 12V6"/><path d="M4 12V18C4 19.8 7.6 21.2 12 21.2C16.4 21.2 20 19.8 20 18V12"/></svg>`,
  },
  mysql: {
    id: "mysql",
    name: "MySQL",
    version: "v8.4 LTS",
    category: "Databases & SQL",
    color: "#00758f",
    bgTint: "rgba(0, 117, 143, 0.16)",
    description:
      "The world's most popular open-source database: SQL syntax, InnoDB engine, replication, optimizer, and indexing.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3C7 3 3 6.5 3 11c0 3 1.8 5.7 4.5 7.2L6 21l3.5-1.5C10.3 19.8 11.1 20 12 20c5 0 9-3.5 9-9s-4-8-9-8z" stroke="#00758f" stroke-width="1.8"/><circle cx="9" cy="10" r="1.5" fill="#f29111"/><path d="M13 14c2-1 3-3 3-5" stroke="#00758f" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Reference Manual", path: "/doc/refman/8.4/en/" },
      { label: "SQL Syntax", path: "/doc/refman/8.4/en/sql-statements.html" },
      { label: "InnoDB Engine", path: "/doc/refman/8.4/en/innodb-storage-engine.html" },
      { label: "Functions", path: "/doc/refman/8.4/en/functions.html" },
    ],
  },
  mariadb: {
    id: "mariadb",
    name: "MariaDB Server",
    version: "v11.4 LTS",
    category: "Databases & SQL",
    color: "#003545",
    bgTint: "rgba(0, 53, 69, 0.22)",
    description:
      "High-performance open-source relational database: Aria, ColumnStore, Galera clustering, and temporal tables.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#38bdf8" stroke-width="1.8"/><path d="M7 16V8l5 5 5-5v8" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    defaultRoutes: [
      { label: "Knowledge Base", path: "/kb/en/documentation/" },
      { label: "SQL Statements", path: "/kb/en/sql-statements/" },
      { label: "Functions", path: "/kb/en/built-in-functions/" },
      { label: "Engines", path: "/kb/en/storage-engines/" },
    ],
  },
  sqlite: {
    id: "sqlite",
    name: "SQLite",
    version: "v3.49",
    category: "Databases & SQL",
    color: "#0ea5e9",
    bgTint: "rgba(14, 165, 233, 0.15)",
    description:
      "Self-contained, high-reliability, embedded SQL database engine: C/C++ API, SQL syntax, PRAGMAs, and WAL mode.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 3.8C16.5 3.8 11 7.5 8.5 13.5L6 20L10.5 16.5C15.5 14 20.2 8.5 20.2 3.8Z"/><path d="M8.5 13.5L14 11"/><path d="M4 20H18"/></svg>`,
  },
  redis: {
    id: "redis",
    name: "Redis",
    version: "v7.4",
    category: "Databases & SQL",
    color: "#dc382d",
    bgTint: "rgba(220, 56, 45, 0.15)",
    description:
      "In-memory data structure store used as a distributed key-value database, cache, streams, and message broker.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6.5l9 4.5 9-4.5L12 2zM3 11l9 4.5 9-4.5M3 15.5l9 4.5 9-4.5" stroke="#dc382d" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/docs/latest/" },
      { label: "Commands", path: "/docs/latest/commands/" },
      { label: "Data Structures", path: "/docs/latest/develop/data-types/" },
      { label: "Pub/Sub", path: "/docs/latest/develop/interact/pubsub/" },
    ],
  },
  duckdb: {
    id: "duckdb",
    name: "DuckDB",
    version: "v1.2",
    category: "Databases & SQL",
    color: "#fff000",
    bgTint: "rgba(255, 240, 0, 0.15)",
    description:
      "Fast in-process analytical SQL database engine: columnar vectorized execution, zero dependencies, and Parquet/Arrow support.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#fff000" fill-opacity="0.15" stroke="#fff000" stroke-width="1.8"/><path d="M8 14c1.5 2 4.5 2 6 0M9 9h.01M15 9h.01" stroke="#fff000" stroke-width="2" stroke-linecap="round"/><path d="M6 12c2-1 4-1 6 0s4 1 6 0" stroke="#fff000" stroke-width="1.5"/></svg>`,
    defaultRoutes: [
      { label: "Docs Home", path: "/docs/" },
      { label: "SQL Guide", path: "/docs/sql/introduction" },
      { label: "Data Import", path: "/docs/data/overview" },
      { label: "Client APIs", path: "/docs/api/overview" },
    ],
  },
  mongodb: {
    id: "mongodb",
    name: "MongoDB",
    version: "v8.0",
    category: "Databases & SQL",
    color: "#00ed64",
    bgTint: "rgba(0, 237, 100, 0.15)",
    description:
      "Document-oriented NoSQL database: flexible JSON-like documents, indexing, aggregation framework, and sharding.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C12 2 6 9 6 15c0 3.3 2.7 6 6 6s6-2.7 6-6c0-6-6-13-6-13z" stroke="#00ed64" stroke-width="1.8"/><path d="M12 2v19" stroke="#00ed64" stroke-width="1.5"/></svg>`,
    defaultRoutes: [
      { label: "Manual", path: "/docs/manual/" },
      { label: "CRUD Operations", path: "/docs/manual/crud/" },
      { label: "Aggregation", path: "/docs/manual/aggregation/" },
      { label: "Indexes", path: "/docs/manual/indexes/" },
    ],
  },
  prisma: {
    id: "prisma",
    name: "Prisma ORM",
    version: "v6.4",
    category: "Databases & SQL",
    color: "#2d3748",
    bgTint: "rgba(45, 55, 72, 0.15)",
    description:
      "Next-generation Node.js and TypeScript ORM with schema migrations, type-safe queries, and relation handling.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M18.8 19.3L12 2.5 5.2 19.3 12 21.5l6.8-2.2z" stroke="#38bdf8" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 2.5v19" stroke="#38bdf8" stroke-width="1.5"/></svg>`,
    defaultRoutes: [
      { label: "Getting Started", path: "/docs/getting-started" },
      { label: "Prisma Client", path: "/docs/concepts/components/prisma-client" },
      { label: "Prisma Schema", path: "/docs/concepts/components/prisma-schema" },
      { label: "CRUD Operations", path: "/docs/concepts/components/prisma-client/crud" },
    ],
  },
  drizzle: {
    id: "drizzle",
    name: "Drizzle ORM",
    version: "v0.41",
    category: "Databases & SQL",
    color: "#c5f74f",
    bgTint: "rgba(197, 247, 79, 0.14)",
    description:
      "Headless TypeScript ORM with SQL-like & relational queries, Drizzle Kit migrations, and zero overhead.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#c5f74f" stroke-width="2.4" stroke-linecap="round"><line x1="7" y1="6" x2="5" y2="14"/><line x1="13" y1="5" x2="11" y2="13"/><line x1="19" y1="7" x2="17" y2="15"/><line x1="10" y1="14" x2="8" y2="20"/><line x1="16" y1="13" x2="14" y2="19"/></svg>`,
  },
  chroma: {
    id: "chroma",
    name: "Chroma Vector DB",
    version: "v0.6",
    category: "Databases & SQL",
    color: "#ff4f00",
    bgTint: "rgba(255, 79, 0, 0.15)",
    description:
      "The open-source AI-native embedding database: document chunking, embeddings, nearest-neighbor search, and LLM context retrieval.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#ff4f00" stroke-width="1.8"/><circle cx="8" cy="12" r="2.5" fill="#ff4f00"/><circle cx="16" cy="12" r="2.5" fill="#ff4f00"/><circle cx="12" cy="7" r="1.5" fill="#38bdf8"/><circle cx="12" cy="17" r="1.5" fill="#38bdf8"/></svg>`,
    defaultRoutes: [
      { label: "Docs Home", path: "/" },
      { label: "Getting Started", path: "/getting-started" },
      { label: "Collections", path: "/guides/collections" },
      { label: "Querying", path: "/guides/querying" },
    ],
  },
  qdrant: {
    id: "qdrant",
    name: "Qdrant Vector DB",
    version: "v1.13",
    category: "Databases & SQL",
    color: "#dc2626",
    bgTint: "rgba(220, 38, 38, 0.15)",
    description:
      "Vector similarity search engine and database written in Rust: payload-based filtering, HNSW index, quantization, and gRPC/REST APIs.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 21 7.5 21 16.5 12 22 3 16.5 3 7.5 12 2" stroke="#dc2626" stroke-width="1.8"/><circle cx="12" cy="12" r="3.5" fill="#dc2626"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/documentation/" },
      { label: "Quickstart", path: "/documentation/quick-start/" },
      { label: "Search & Filtering", path: "/documentation/concepts/search/" },
      { label: "Collections", path: "/documentation/concepts/collections/" },
    ],
  },

  // ==========================================
  // 8. AI & Machine Learning (9)
  // ==========================================
  pytorch: {
    id: "pytorch",
    name: "PyTorch",
    version: "v2.6",
    category: "AI & Machine Learning",
    color: "#ee4c2c",
    bgTint: "rgba(238, 76, 44, 0.15)",
    description:
      "Open source machine learning framework that accelerates research prototyping and production deployment.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M13.5 3a9 9 0 0 0-4.8 16.7l1.2-2.3a6.4 6.4 0 0 1 3.6-11.8V3z" fill="#ee4c2c"/><circle cx="16.5" cy="5.5" r="1.5" fill="#ee4c2c"/><path d="M12 10.5v3l2.5 1.5" stroke="#ee4c2c" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Docs Home", path: "/docs/stable/index.html" },
      { label: "torch.nn", path: "/docs/stable/nn.html" },
      { label: "torch.Tensor", path: "/docs/stable/tensors.html" },
      { label: "Autograd", path: "/docs/stable/autograd.html" },
    ],
  },
  tensorflow: {
    id: "tensorflow",
    name: "TensorFlow",
    version: "v2.18",
    category: "AI & Machine Learning",
    color: "#ff6f00",
    bgTint: "rgba(255, 111, 0, 0.15)",
    description:
      "End-to-end open source machine learning platform: automatic differentiation, tensors, Keras layers, and distributed training.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6.5v9L12 20l8-4.5v-9L12 2z" stroke="#ff6f00" stroke-width="1.8"/><path d="M12 2v18M12 8l8-4.5M12 8L4 3.5" stroke="#ff6f00" stroke-width="1.5"/></svg>`,
    defaultRoutes: [
      { label: "API Reference", path: "/api_docs/python/tf" },
      { label: "Tensors (tf.Tensor)", path: "/api_docs/python/tf/Tensor" },
      { label: "Keras in TF", path: "/api_docs/python/tf/keras" },
      { label: "tf.data", path: "/api_docs/python/tf/data" },
    ],
  },
  keras: {
    id: "keras",
    name: "Keras 3",
    version: "v3.8",
    category: "AI & Machine Learning",
    color: "#d00000",
    bgTint: "rgba(208, 0, 0, 0.15)",
    description:
      "High-level deep learning API running seamlessly on top of JAX, PyTorch, and TensorFlow with unified model definitions.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#d00000"/><path d="M8 7v10M8 12l5-5M8 12l5 5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    defaultRoutes: [
      { label: "Guides", path: "/guides/" },
      { label: "Getting Started", path: "/getting_started/" },
      { label: "Core API", path: "/api/models/" },
      { label: "Layers", path: "/api/layers/" },
    ],
  },
  langchain: {
    id: "langchain",
    name: "LangChain",
    version: "v0.3",
    category: "AI & Machine Learning",
    color: "#00a67e",
    bgTint: "rgba(0, 166, 126, 0.15)",
    description:
      "Context-aware reasoning framework for developing LLM applications, RAG pipelines, agents, and chains.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#00a67e" stroke-width="1.8" stroke-linecap="round"><circle cx="7" cy="7" r="4"/><circle cx="17" cy="17" r="4"/><path d="M10 10l4 4M7 11v6a2 2 0 0 0 2 2h6"/></svg>`,
    defaultRoutes: [
      { label: "Overview", path: "/oss/python/langchain/overview" },
      { label: "Tutorials", path: "/docs/tutorials/" },
      { label: "Agents", path: "/docs/concepts/agents/" },
      { label: "RAG Pipeline", path: "/docs/tutorials/rag/" },
    ],
  },
  huggingface: {
    id: "huggingface",
    name: "Hugging Face",
    version: "v4.49",
    category: "AI & Machine Learning",
    color: "#ffbc00",
    bgTint: "rgba(255, 188, 0, 0.15)",
    description:
      "The platform where the machine learning community collaborates on models, datasets, Transformers, and apps.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ffbc00" stroke-width="1.8"/><circle cx="9" cy="10" r="1.5" fill="#ffbc00"/><circle cx="15" cy="10" r="1.5" fill="#ffbc00"/><path d="M8 15c1.5 2 6.5 2 8 0" stroke="#ffbc00" stroke-width="1.8" stroke-linecap="round"/><path d="M4 11c-1 2 0 4 2 4M20 11c1 2 0 4-2 4" stroke="#ffbc00" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Transformers", path: "/docs/transformers/index" },
      { label: "Quick Tour", path: "/docs/transformers/quicktour" },
      { label: "Pipelines", path: "/docs/transformers/pipeline_tutorial" },
      { label: "Models", path: "/docs/transformers/model_summary" },
    ],
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    version: "v0.5",
    category: "AI & Machine Learning",
    color: "#f3f4f6",
    bgTint: "rgba(243, 244, 246, 0.15)",
    description:
      "Official Ollama Documentation (docs.ollama.com): run and build local LLMs, REST API reference, Python/JS SDKs, context windows, and Modelfile.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M8 5a4 4 0 0 1 8 0"/><circle cx="9.5" cy="12.5" r="1" fill="currentColor"/><circle cx="14.5" cy="12.5" r="1" fill="currentColor"/><path d="M11 16h2"/></svg>`,
    defaultRoutes: [
      { label: "Quickstart", path: "/" },
      { label: "API Reference", path: "/api" },
      { label: "CLI Guide", path: "/cli" },
      { label: "Modelfile", path: "/modelfile" },
      { label: "Context Window", path: "/context-window" },
    ],
  },
  numpy: {
    id: "numpy",
    name: "NumPy",
    version: "v2.2",
    category: "AI & Machine Learning",
    color: "#4dabcf",
    bgTint: "rgba(77, 171, 207, 0.15)",
    description:
      "The fundamental package for scientific computing with Python: N-dimensional arrays, linear algebra, and FFT.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#4dabcf" stroke-width="1.8"/><path d="M7 8v8M12 8v8M17 8v8M3 12h18" stroke="#4dabcf" stroke-width="1.8"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/doc/stable/" },
      { label: "User Guide", path: "/doc/stable/user/" },
      { label: "Array Basics", path: "/doc/stable/user/absolute_beginners.html" },
      { label: "API Reference", path: "/doc/stable/reference/" },
    ],
  },
  pandas: {
    id: "pandas",
    name: "Pandas",
    version: "v2.2",
    category: "AI & Machine Learning",
    color: "#6495ed",
    bgTint: "rgba(100, 149, 237, 0.18)",
    description:
      "Fast, powerful, and flexible open source data analysis and data manipulation tool for Python DataFrames.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#6495ed" stroke-width="1.8"><rect x="4" y="4" width="6" height="7" rx="1"/><rect x="14" y="4" width="6" height="11" rx="1"/><rect x="4" y="15" width="6" height="5" rx="1"/><rect x="14" y="19" width="6" height="1" rx="0.5"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/docs/" },
      { label: "Getting Started", path: "/docs/getting_started/index.html" },
      { label: "User Guide", path: "/docs/user_guide/index.html" },
      { label: "API Reference", path: "/docs/reference/index.html" },
    ],
  },
  scikit_learn: {
    id: "scikit_learn",
    name: "Scikit-learn",
    version: "v1.6",
    category: "AI & Machine Learning",
    color: "#f89939",
    bgTint: "rgba(248, 153, 57, 0.15)",
    description:
      "Machine learning in Python: classification, regression, clustering, dimensionality reduction, and model selection.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#f89939" stroke-width="1.8"/><path d="M7 14l3-4 4 3 3-5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="14" r="1.5" fill="#f89939"/><circle cx="17" cy="8" r="1.5" fill="#38bdf8"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/stable/" },
      { label: "User Guide", path: "/stable/user_guide.html" },
      { label: "Supervised Learning", path: "/stable/supervised_learning.html" },
      { label: "API Reference", path: "/stable/modules/classes.html" },
    ],
  },

  // ==========================================
  // 9. Python Ecosystem (9)
  // ==========================================
  python: {
    id: "python",
    name: "Python 3",
    version: "v3.13",
    category: "Python Ecosystem",
    color: "#3776ab",
    bgTint: "rgba(55, 118, 171, 0.15)",
    description:
      "Official Python 3 documentation: Language Reference, Standard Library modules, Tutorial, and Global Module Index.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M11.9 2C8.8 2 7 3.3 7 5.6V7.4H12.1V8.3H5.2C3 8.3 2 9.8 2 12.1C2 14.4 3 15.8 5.2 15.8H6.5V13.8C6.5 12.2 7.8 10.9 9.4 10.9H14.5C15.8 10.9 16.8 9.9 16.8 8.6V5.6C16.8 3.3 15 2 11.9 2ZM9.8 3.8C10.4 3.8 10.8 4.3 10.8 4.9C10.8 5.4 10.4 5.9 9.8 5.9C9.3 5.9 8.8 5.4 8.8 4.9C8.8 4.3 9.3 3.8 9.8 3.8Z" fill="#3776ab"/><path d="M12.1 22C15.2 22 17 20.7 17 18.4V16.6H11.9V15.7H18.8C21 15.7 22 14.2 22 11.9C22 9.6 21 8.2 18.8 8.2H17.5V10.2C17.5 11.8 16.2 13.1 14.6 13.1H9.5C8.2 13.1 7.2 14.1 7.2 15.4V18.4C7.2 20.7 9 22 12.1 22ZM14.2 20.2C13.6 20.2 13.2 19.7 13.2 19.1C13.2 18.6 13.6 18.1 14.2 18.1C14.7 18.1 15.2 18.6 15.2 19.1C15.2 19.7 14.7 20.2 14.2 20.2Z" fill="#ffd43b"/></svg>`,
  },
  fastapi: {
    id: "fastapi",
    name: "FastAPI",
    version: "v0.115",
    category: "Python Ecosystem",
    color: "#05998b",
    bgTint: "rgba(5, 153, 139, 0.15)",
    description:
      "High-performance Python web framework for building APIs with automatic OpenAPI docs, Pydantic v2, and async/await.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.5" stroke="#05998b" stroke-width="1.9"/><path d="M13 5.5L7.5 13H12L11 18.5L16.5 11H12L13 5.5Z" fill="#05998b"/></svg>`,
  },
  django: {
    id: "django",
    name: "Django",
    version: "v6.1",
    category: "Python Ecosystem",
    color: "#44b78b",
    bgTint: "rgba(68, 183, 139, 0.15)",
    description:
      "The web framework for perfectionists with deadlines: ORM Models, Views, Templates, Admin, Auth, and Migrations.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#44b78b" stroke-width="2" stroke-linecap="round"><path d="M12 4V16C12 17.7 10.5 19 8.5 19C6.5 19 5 17.7 5 16C5 14.3 6.5 13 8.5 13C9.8 13 11 13.5 12 14.2"/><path d="M16 9V17.5C16 19.5 15 20.8 13.2 21.3"/><circle cx="16" cy="5.5" r="1" fill="#44b78b"/></svg>`,
  },
  flask: {
    id: "flask",
    name: "Flask",
    version: "v3.1",
    category: "Python Ecosystem",
    color: "#ffffff",
    bgTint: "rgba(255, 255, 255, 0.15)",
    description:
      "Lightweight WSGI Python web framework: flexible routing, Jinja templating, blueprints, signals, and request handling.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 3h6M10 3v5l-6 11a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 8V3"/><path d="M7 16h10"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/" },
      { label: "Quickstart", path: "/quickstart/" },
      { label: "API Reference", path: "/api/" },
      { label: "Blueprints", path: "/blueprints/" },
    ],
  },
  pydantic: {
    id: "pydantic",
    name: "Pydantic",
    version: "v2.10",
    category: "Python Ecosystem",
    color: "#e92063",
    bgTint: "rgba(233, 32, 99, 0.15)",
    description:
      "Data validation and settings management using Python type annotations with Rust-powered core (pydantic-core).",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#e92063" stroke-width="1.8"/><path d="M9 7h4a3 3 0 0 1 0 6H9V7zm0 6h4.5a3 3 0 0 1 0 6H9v-6z" fill="#e92063"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/" },
      { label: "Models", path: "/concepts/models/" },
      { label: "Fields", path: "/concepts/fields/" },
      { label: "Validators", path: "/concepts/validators/" },
    ],
  },
  sqlalchemy: {
    id: "sqlalchemy",
    name: "SQLAlchemy",
    version: "v2.0",
    category: "Python Ecosystem",
    color: "#d71f00",
    bgTint: "rgba(215, 31, 0, 0.15)",
    description:
      "The Python SQL toolkit and Object Relational Mapper that gives application developers the full power and flexibility of SQL.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#d71f00" stroke-width="1.8"/><path d="M8 12h8M12 8v8" stroke="#d71f00" stroke-width="2" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/en/20/" },
      { label: "Unified Tutorial", path: "/en/20/tutorial/index.html" },
      { label: "ORM Quick Start", path: "/en/20/orm/quickstart.html" },
      { label: "Core Architecture", path: "/en/20/core/index.html" },
    ],
  },
  requests_py: {
    id: "requests_py",
    name: "Requests (Python HTTP)",
    version: "v2.32",
    category: "Python Ecosystem",
    color: "#2b5b84",
    bgTint: "rgba(43, 91, 132, 0.18)",
    description:
      "HTTP for Humans: simple, elegant Python HTTP client library supporting keep-alive, connection pooling, and SSL.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l5-5 5 5M12 10v8" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/" },
      { label: "Quickstart", path: "/user/quickstart/" },
      { label: "Advanced Usage", path: "/user/advanced/" },
      { label: "API Reference", path: "/api/" },
    ],
  },
  celery: {
    id: "celery",
    name: "Celery",
    version: "v5.4",
    category: "Python Ecosystem",
    color: "#37814a",
    bgTint: "rgba(55, 129, 74, 0.15)",
    description:
      "Distributed task queue: real-time asynchronous job worker, scheduling (beat), retries, and broker integration.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 14.5c-2.5 0-4.5-1.5-4.5-3.5h2c0 1 1.1 1.5 2.5 1.5s2.5-.5 2.5-1.5c0-2-5-1.5-5-4 0-1.5 1.3-2.5 3-2.5s3 1 3 2.5h-2c0-.7-.5-1-1-1s-1 .3-1 1c0 1.8 5 1.5 5 4 0 1.8-1.5 3-3.5 3z" fill="#37814a"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/" },
      { label: "First Steps", path: "/getting-started/first-steps-with-celery.html" },
      { label: "User Guide", path: "/userguide/" },
      { label: "Tasks", path: "/userguide/tasks.html" },
    ],
  },
  matplotlib: {
    id: "matplotlib",
    name: "Matplotlib",
    version: "v3.10",
    category: "Python Ecosystem",
    color: "#11557c",
    bgTint: "rgba(17, 85, 124, 0.15)",
    description:
      "Comprehensive Python library for creating static, animated, and interactive visualizations, plots, and figures.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#11557c" stroke-width="1.8"/><path d="M4 17l4-6 4 4 4-8 4 5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="11" r="1.5" fill="#f59e0b"/><circle cx="12" cy="15" r="1.5" fill="#10b981"/><circle cx="16" cy="7" r="1.5" fill="#ec4899"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/stable/" },
      { label: "Plot Types", path: "/stable/plot_types/index.html" },
      { label: "Tutorials", path: "/stable/tutorials/index.html" },
      { label: "API Reference", path: "/stable/api/index.html" },
    ],
  },

  // ==========================================
  // 10. Rust Ecosystem (7)
  // ==========================================
  rust: {
    id: "rust",
    name: "Rust Stable Suite",
    version: "1.86",
    category: "Rust Ecosystem",
    color: "#f97316",
    bgTint: "rgba(249, 115, 22, 0.15)",
    description:
      "Full Rust documentation suite: The Rust Book, Standard Library API (`std`), Cargo Book, Rustonomicon & Reference.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2V5M12 19V22M2 12H5M19 12H22M4.9 4.9L7.1 7.1M16.9 16.9L19.1 19.1M19.1 4.9L16.9 7.1M7.1 16.9L4.9 19.1" stroke-linecap="round"/></svg>`,
  },
  tokio: {
    id: "tokio",
    name: "Tokio (Async Rust)",
    version: "v1.43",
    category: "Rust Ecosystem",
    color: "#a855f7",
    bgTint: "rgba(168, 85, 247, 0.15)",
    description:
      "Asynchronous runtime for Rust providing non-blocking I/O, timers, channels, and multi-threaded work-stealing scheduler.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#a855f7" stroke-width="1.8"/><path d="M8 12h8M12 8v8" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Tutorial", path: "/tokio/tutorial" },
      { label: "Hello Tokio", path: "/tokio/tutorial/hello-tokio" },
      { label: "Spawning", path: "/tokio/tutorial/spawning" },
      { label: "Async In Depth", path: "/tokio/tutorial/async" },
    ],
  },
  axum: {
    id: "axum",
    name: "Axum (Rust Web)",
    version: "v0.8",
    category: "Rust Ecosystem",
    color: "#ef4444",
    bgTint: "rgba(239, 68, 68, 0.15)",
    description:
      "Ergonomic and modular web framework built with Tokio, Tower, and Hyper for high-performance Rust microservices.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"><path d="M4 18L12 4l8 14H4z"/><path d="M9 13h6"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/axum/latest/axum/" },
      { label: "Routing", path: "/axum/latest/axum/routing/index.html" },
      { label: "Extractors", path: "/axum/latest/axum/extract/index.html" },
    ],
  },
  actix_web: {
    id: "actix_web",
    name: "Actix Web",
    version: "v4.9",
    category: "Rust Ecosystem",
    color: "#00a1d6",
    bgTint: "rgba(0, 161, 214, 0.15)",
    description:
      "Powerful, pragmatic, and extremely fast web framework for Rust: actor system foundation, middlewares, extractors, and WebSocket.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#00a1d6" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/docs/" },
      { label: "Getting Started", path: "/docs/getting-started/" },
      { label: "Extractors", path: "/docs/extractors/" },
      { label: "Middleware", path: "/docs/middleware/" },
    ],
  },
  serde: {
    id: "serde",
    name: "Serde (Rust)",
    version: "v1.0",
    category: "Rust Ecosystem",
    color: "#f97316",
    bgTint: "rgba(249, 115, 22, 0.15)",
    description:
      "Generic serialization/deserialization framework for Rust data structures: JSON, Postcard, Bincode, YAML, and CBOR.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.8" stroke-linecap="round"><path d="M7 8h10M7 12h10M7 16h6"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>`,
    defaultRoutes: [
      { label: "Overview", path: "/" },
      { label: "Attributes", path: "/attributes.html" },
      { label: "Custom Serialization", path: "/custom-serialization.html" },
    ],
  },
  bevy: {
    id: "bevy",
    name: "Bevy Engine",
    version: "v0.15",
    category: "Rust Ecosystem",
    color: "#ffffff",
    bgTint: "rgba(255, 255, 255, 0.15)",
    description:
      "Refreshingly simple data-driven game engine built in Rust: ECS (Entity Component System), render graph, UI, and audio.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 20 8 20 16 12 22 4 16 4 8 12 2" stroke="#ffffff" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="#ffffff"/></svg>`,
    defaultRoutes: [
      { label: "Quick Start", path: "/learn/quick-start/introduction/" },
      { label: "ECS Guide", path: "/learn/quick-start/getting-started/ecs/" },
      { label: "Setup", path: "/learn/quick-start/getting-started/setup/" },
    ],
  },
  clap: {
    id: "clap",
    name: "Clap (Rust CLI)",
    version: "v4.5",
    category: "Rust Ecosystem",
    color: "#d97706",
    bgTint: "rgba(217, 119, 6, 0.15)",
    description:
      "Full featured, fast Command Line Argument Parser for Rust: derive macros, builder pattern, subcommands, and completions.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.8" stroke-linecap="round"><path d="M4 17l6-6-6-6M12 19h8"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/clap/latest/clap/" },
      { label: "Derive Tutorial", path: "/clap/latest/clap/_derive/_tutorial/index.html" },
      { label: "Builder Pattern", path: "/clap/latest/clap/struct.Command.html" },
    ],
  },

  // ==========================================
  // 11. Go (Golang) (6)
  // ==========================================
  go: {
    id: "go",
    name: "Go (Golang)",
    version: "go1.24",
    category: "Go (Golang)",
    color: "#00add8",
    bgTint: "rgba(0, 173, 216, 0.15)",
    description:
      "Official Go language specification, Effective Go, Standard Library packages, modules, and concurrency guides.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="4" stroke="#00add8" stroke-width="1.9"/><path d="M10.5 10.2C9.8 9.4 8.2 9.4 7.3 10.4C6.4 11.4 6.5 13 7.4 13.9C8.3 14.8 9.9 14.7 10.6 13.7V12.2H8.9" stroke="#00add8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15.5" cy="12" r="2.5" stroke="#00add8" stroke-width="1.9"/></svg>`,
  },
  gin: {
    id: "gin",
    name: "Gin (Go Web)",
    version: "v1.10",
    category: "Go (Golang)",
    color: "#00add8",
    bgTint: "rgba(0, 173, 216, 0.15)",
    description:
      "The fastest full-featured web framework for Go featuring martini-like API with custom radix tree routing.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#00add8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M5 3l7 14 7-14H5z"/></svg>`,
    defaultRoutes: [
      { label: "Docs Home", path: "/en/docs/" },
      { label: "Quick Start", path: "/en/docs/quickstart/" },
      { label: "Examples", path: "/en/docs/examples/" },
      { label: "Custom Middleware", path: "/en/docs/examples/custom-middleware/" },
    ],
  },
  gorm: {
    id: "gorm",
    name: "GORM (Go ORM)",
    version: "v1.25",
    category: "Go (Golang)",
    color: "#00add8",
    bgTint: "rgba(0, 173, 216, 0.15)",
    description:
      "The fantastic ORM library for Golang: associations, hooks, preloading, transactions, and auto-migrations.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#00add8" stroke-width="1.8"><ellipse cx="12" cy="7" rx="8" ry="3.5"/><path d="M4 7v10c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V7"/></svg>`,
    defaultRoutes: [
      { label: "Overview", path: "/docs/" },
      { label: "CRUD Interface", path: "/docs/create.html" },
      { label: "Query", path: "/docs/query.html" },
      { label: "Associations", path: "/docs/belongs_to.html" },
    ],
  },
  fiber: {
    id: "fiber",
    name: "Fiber (Go Web)",
    version: "v2.52",
    category: "Go (Golang)",
    color: "#00add8",
    bgTint: "rgba(0, 173, 216, 0.15)",
    description:
      "Express-inspired web framework written in Go on top of Fasthttp: zero memory allocation, routing, and rich middlewares.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#00add8" stroke-width="1.8" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/" },
      { label: "Quick Start", path: "/welcome/quick-start" },
      { label: "API Reference", path: "/api/app" },
      { label: "Middleware", path: "/api/middleware" },
    ],
  },
  echo: {
    id: "echo",
    name: "Echo (Go Framework)",
    version: "v4.13",
    category: "Go (Golang)",
    color: "#2563eb",
    bgTint: "rgba(37, 99, 235, 0.15)",
    description:
      "High performance, extensible, minimalist Go web framework: optimized HTTP router, group APIs, and data binding.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#38bdf8" stroke-width="1.8"/><circle cx="12" cy="12" r="4.5" stroke="#38bdf8" stroke-width="1.5"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/docs" },
      { label: "Quick Start", path: "/docs/quick-start" },
      { label: "Routing", path: "/docs/routing" },
      { label: "Context", path: "/docs/context" },
    ],
  },
  cobra: {
    id: "cobra",
    name: "Cobra (Go CLI)",
    version: "v1.9",
    category: "Go (Golang)",
    color: "#00add8",
    bgTint: "rgba(0, 173, 216, 0.15)",
    description:
      "Commander for modern Go CLI applications: commands, args, flags, POSIX compliance, and auto-generated shell completions.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#00add8" stroke-width="1.8"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M8 12l3 3 5-5"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/" },
      { label: "User Guide", path: "/user-guide/" },
    ],
  },

  // ==========================================
  // 12. C & C++ Ecosystem (13)
  // ==========================================
  cppreference: {
    id: "cppreference",
    name: "C++ Reference (cppreference)",
    version: "C++23/26",
    category: "C & C++ Ecosystem",
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
    category: "C & C++ Ecosystem",
    color: "#60a5fa",
    bgTint: "rgba(96, 165, 250, 0.15)",
    description:
      "Top-rated comprehensive C++ tutorial series: fundamentals, object-oriented programming, templates, and C++20/23.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20V22H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7L13 11L9 15" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  qt: {
    id: "qt",
    name: "Qt 6 Documentation",
    version: "Qt 6.9",
    category: "C & C++ Ecosystem",
    color: "#41cd52",
    bgTint: "rgba(65, 205, 82, 0.15)",
    description:
      "Cross-platform C++ & QML application development framework: Qt Widgets, Qt Quick, Signals & Slots, CMake API.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 4H19L21 6V18L17 20H5L3 18V6L5 4Z" stroke="#41cd52" stroke-width="1.9"/><path d="M9.5 9C7.8 9 6.8 10.2 6.8 12C6.8 13.8 7.8 15 9.5 15C11.2 15 12.2 13.8 12.2 12C12.2 10.2 11.2 9 9.5 9ZM10.5 13.8L12.3 15.8M15.5 8.5V14.5C15.5 15.2 16 15.5 16.8 15.5M14.2 10.5H17" stroke="#41cd52" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  },
  boost: {
    id: "boost",
    name: "Boost C++ Libraries",
    version: "v1.87",
    category: "C & C++ Ecosystem",
    color: "#f7901e",
    bgTint: "rgba(247, 144, 30, 0.15)",
    description:
      "Peer-reviewed portable C++ source libraries: Boost.Asio, Beast, Spirit, Filesystem, Graph, MultiIndex, and Math.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#f7901e" stroke-width="1.9" stroke-linejoin="round"><polygon points="12 2 19 6 19 14 12 18 5 14 5 6 12 2"/><polyline points="5 14 12 22 19 14"/><circle cx="12" cy="10" r="2.5"/></svg>`,
    defaultRoutes: [
      { label: "All Libraries", path: "/doc/libs/latest/libs/libraries.htm" },
      { label: "Boost.Asio", path: "/doc/libs/latest/doc/html/boost_asio.html" },
      { label: "Boost.Beast", path: "/doc/libs/latest/libs/beast/doc/html/index.html" },
      { label: "Getting Started", path: "/doc/libs/latest/more/getting_started/index.html" },
    ],
  },
  json_cpp: {
    id: "json_cpp",
    name: "nlohmann/json (C++)",
    version: "v3.11",
    category: "C & C++ Ecosystem",
    color: "#f59e0b",
    bgTint: "rgba(245, 158, 11, 0.15)",
    description:
      "JSON for Modern C++: intuitive syntax, first-class container integration, serialization, and header-only design.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round"><path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 2-2 2 1 0 2 .5 2 2v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 2 2 2-1 0-2 .5-2 2v2c0 2-1 3-3 3"/></svg>`,
    defaultRoutes: [
      { label: "Overview", path: "/" },
      { label: "Integration", path: "/integration/" },
      { label: "API Reference", path: "/api/basic_json/" },
      { label: "Features", path: "/features/arbitrary_types/" },
    ],
  },
  fmt_cpp: {
    id: "fmt_cpp",
    name: "{fmt} C++ Formatting",
    version: "v11.1",
    category: "C & C++ Ecosystem",
    color: "#10b981",
    bgTint: "rgba(16, 185, 129, 0.15)",
    description:
      "Fast, safe alternative to C stdio and C++ iostreams (underlying implementation for std::format).",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h12M4 17h8"/></svg>`,
    defaultRoutes: [
      { label: "Overview", path: "/latest/" },
      { label: "API Reference", path: "/latest/api.html" },
      { label: "Syntax", path: "/latest/syntax.html" },
    ],
  },
  raylib: {
    id: "raylib",
    name: "Raylib Cheatsheet & API",
    version: "v5.5",
    category: "C & C++ Ecosystem",
    color: "#ffffff",
    bgTint: "rgba(255, 255, 255, 0.14)",
    description:
      "Simple, easy-to-use library to enjoy videogames programming in C/C++: 2D/3D graphics, audio, and windowing.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 17l5-5-5-5M13 17h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    defaultRoutes: [
      { label: "Cheatsheet", path: "/cheatsheet/cheatsheet.html" },
      { label: "Core API", path: "/cheatsheet/cheatsheet.html#core" },
      { label: "Shapes", path: "/cheatsheet/cheatsheet.html#shapes" },
      { label: "Textures", path: "/cheatsheet/cheatsheet.html#textures" },
    ],
  },
  opencv: {
    id: "opencv",
    name: "OpenCV C++",
    version: "v4.11",
    category: "C & C++ Ecosystem",
    color: "#5c3ca5",
    bgTint: "rgba(92, 60, 165, 0.16)",
    description:
      "Open Source Computer Vision Library: real-time image processing, camera calibration, object detection, DNN module, and GPU CUDA.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="4" stroke="#e11d48" stroke-width="1.8"/><circle cx="7" cy="16" r="4" stroke="#16a34a" stroke-width="1.8"/><circle cx="17" cy="16" r="4" stroke="#2563eb" stroke-width="1.8"/></svg>`,
    defaultRoutes: [
      { label: "Reference Manual", path: "/4.x/" },
      { label: "Core Module", path: "/4.x/d0/d7a/classcv_1_1Mat.html" },
      { label: "Image Processing", path: "/4.x/d7/da8/tutorial_table_of_content_imgproc.html" },
    ],
  },
  imgui: {
    id: "imgui",
    name: "Dear ImGui",
    version: "v1.91",
    category: "C & C++ Ecosystem",
    color: "#9b51e0",
    bgTint: "rgba(155, 81, 224, 0.15)",
    description:
      "Bloat-free Immediate Mode Graphical User Interface for C++: game tooling, debug overlays, renderer-agnostic backends.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#9b51e0" stroke-width="1.8"/><rect x="6" y="6" width="6" height="4" rx="1" fill="#9b51e0"/><line x1="6" y1="14" x2="18" y2="14" stroke="#9b51e0" stroke-width="1.8"/><circle cx="12" cy="14" r="2.5" fill="#9b51e0"/></svg>`,
    defaultRoutes: [
      { label: "Interactive Manual", path: "/imgui_manual_online/manual/imgui_manual.html" },
      { label: "Dear ImGui Manual", path: "/imgui_manual_online/manual/imgui_manual.html" },
    ],
  },
  catch2: {
    id: "catch2",
    name: "Catch2 (C++ Testing)",
    version: "v3.7",
    category: "C & C++ Ecosystem",
    color: "#ff6600",
    bgTint: "rgba(255, 102, 0, 0.15)",
    description:
      "Modern, C++-native test framework for unit tests, TDD and BDD with clean assertion macros, matchers, and generators.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#ff6600" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/catchorg/Catch2/blob/devel/docs/Readme.md" },
      { label: "Tutorial", path: "/catchorg/Catch2/blob/devel/docs/tutorial.md" },
    ],
  },
  spdlog: {
    id: "spdlog",
    name: "spdlog (C++ Logging)",
    version: "v1.15",
    category: "C & C++ Ecosystem",
    color: "#3b82f6",
    bgTint: "rgba(59, 130, 246, 0.15)",
    description:
      "Super fast, header-only / compiled C++ logging library: asynchronous logging, rotating sinks, multi-threading, and formatting.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="14" y2="13"/></svg>`,
    defaultRoutes: [
      { label: "Wiki & Documentation", path: "/gabime/spdlog/wiki" },
    ],
  },
  llvm: {
    id: "llvm",
    name: "LLVM Compiler Infrastructure",
    version: "v20.1",
    category: "C & C++ Ecosystem",
    color: "#22c55e",
    bgTint: "rgba(34, 197, 94, 0.15)",
    description:
      "Modular compiler technologies: LLVM IR language reference, Clang C/C++ compiler, optimization passes, and LLD linker.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round"/><path d="M12 6V12L16 16" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  emscripten: {
    id: "emscripten",
    name: "Emscripten",
    version: "v4.0",
    category: "C & C++ Ecosystem",
    color: "#d13438",
    bgTint: "rgba(209, 52, 56, 0.16)",
    description:
      "Open-source LLVM-to-WebAssembly compiler: compile C and C++ codebases, OpenGL, and POSIX APIs into high-speed WebAssembly.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#d13438"/><path d="M8 8H16M8 12H13.5M8 16H16" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="12" r="1.5" fill="#ffffff"/></svg>`,
    defaultRoutes: [
      { label: "Docs Home", path: "/docs/" },
      { label: "Getting Started", path: "/docs/getting_started/index.html" },
      { label: "API Reference", path: "/docs/api_reference/index.html" },
      { label: "Porting Guide", path: "/docs/porting/index.html" },
      { label: "Optimizing", path: "/docs/optimizing/Optimizing-Code.html" },
    ],
  },
  lua: {
    id: "lua",
    name: "Lua 5.4 Reference",
    version: "v5.4",
    category: "C & C++ Ecosystem",
    color: "#000080",
    bgTint: "rgba(0, 0, 128, 0.2)",
    description:
      "Powerful, efficient, lightweight, embeddable scripting language: manual, C API, auxiliary library, and metatables.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3b82f6" stroke-width="1.8"/><circle cx="15.5" cy="8.5" r="2.5" fill="#3b82f6"/><circle cx="8" cy="15" r="1.5" fill="#ffffff"/></svg>`,
  },

  // ==========================================
  // 13. DevOps & Cloud (11)
  // ==========================================
  docker: {
    id: "docker",
    name: "Docker Docs",
    version: "v28",
    category: "DevOps & Cloud",
    color: "#2496ed",
    bgTint: "rgba(36, 150, 237, 0.15)",
    description:
      "Build, share, and run applications: Dockerfile reference, Docker Compose, Docker Engine, CLI, and multi-stage builds.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#2496ed" stroke-width="1.8"><rect x="3" y="11" width="3" height="3" rx="0.5"/><rect x="7" y="11" width="3" height="3" rx="0.5"/><rect x="11" y="11" width="3" height="3" rx="0.5"/><rect x="7" y="7" width="3" height="3" rx="0.5"/><rect x="11" y="7" width="3" height="3" rx="0.5"/><rect x="11" y="3" width="3" height="3" rx="0.5"/><path d="M3 14C3 18 6.5 20.5 12 20.5C18 20.5 21 17 21 14C19.5 14 18 15 16 15C14.5 15 13 14 11 14C9.5 14 8 15 6 15C4.5 15 3.5 14 3 14Z" stroke-linecap="round"/></svg>`,
  },
  kubernetes: {
    id: "kubernetes",
    name: "Kubernetes",
    version: "v1.32",
    category: "DevOps & Cloud",
    color: "#326ce5",
    bgTint: "rgba(50, 108, 229, 0.15)",
    description:
      "Automated container orchestration: deployment, scaling, pods, services, ingress, and cluster management.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 21 7.2 21 16.8 12 22 3 16.8 3 7.2 12 2" stroke="#326ce5" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="#326ce5" stroke-width="1.8"/><path d="M12 2v7M12 15v7M3 7.2l6.2 3.6M14.8 13.2L21 16.8M3 16.8l6.2-3.6M14.8 10.8L21 7.2" stroke="#326ce5" stroke-width="1.5"/></svg>`,
    defaultRoutes: [
      { label: "Docs Home", path: "/docs/home/" },
      { label: "Concepts", path: "/docs/concepts/" },
      { label: "Tasks", path: "/docs/tasks/" },
      { label: "Kubectl", path: "/docs/reference/kubectl/" },
    ],
  },
  nginx: {
    id: "nginx",
    name: "Nginx",
    version: "v1.26",
    category: "DevOps & Cloud",
    color: "#009639",
    bgTint: "rgba(0, 150, 57, 0.15)",
    description:
      "High-performance HTTP web server, reverse proxy, load balancer, mail proxy, and generic TCP/UDP proxy.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 22 8 22 16 12 22 2 16 2 8 12 2" stroke="#009639" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 16V8l8 8V8" stroke="#009639" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/en/docs/" },
      { label: "Core Module", path: "/en/docs/http/ngx_http_core_module.html" },
      { label: "Reverse Proxy", path: "/en/docs/http/ngx_http_proxy_module.html" },
      { label: "Beginner's Guide", path: "/en/docs/beginners_guide.html" },
    ],
  },
  caddy: {
    id: "caddy",
    name: "Caddy Server",
    version: "v2.9",
    category: "DevOps & Cloud",
    color: "#22b473",
    bgTint: "rgba(34, 180, 115, 0.15)",
    description:
      "Enterprise-ready, fast, modern HTTP/2 & HTTP/3 open source web server with automatic HTTPS written in Go: Caddyfile syntax, reverse proxy, and modular architecture.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#22b473" stroke-width="1.8"/><path d="M7 14l5-5 5 5" stroke="#22b473" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="14" r="1.5" fill="#22b473"/></svg>`,
    defaultRoutes: [
      { label: "Getting Started", path: "/docs/getting-started" },
      { label: "Caddyfile", path: "/docs/caddyfile" },
      { label: "Reverse Proxy", path: "/docs/quick-starts/reverse-proxy" },
      { label: "Automatic HTTPS", path: "/docs/automatic-https" },
      { label: "CLI Reference", path: "/docs/command-line" },
    ],
  },
  opentofu: {
    id: "opentofu",
    name: "OpenTofu / Terraform",
    version: "v1.9",
    category: "DevOps & Cloud",
    color: "#ffda19",
    bgTint: "rgba(255, 218, 25, 0.15)",
    description:
      "Open-source Infrastructure as Code tool for declaratively managing cloud resources across AWS, GCP, and Azure.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#ffda19" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2L4 6.5v9L12 20l8-4.5v-9L12 2z"/><path d="M12 2v18M4 6.5l8 4.5 8-4.5"/></svg>`,
    defaultRoutes: [
      { label: "Introduction", path: "/docs/intro/" },
      { label: "Language", path: "/docs/language/" },
      { label: "CLI Reference", path: "/docs/cli/" },
      { label: "State", path: "/docs/language/state/" },
    ],
  },
  ansible: {
    id: "ansible",
    name: "Ansible",
    version: "v11",
    category: "DevOps & Cloud",
    color: "#ee0000",
    bgTint: "rgba(238, 0, 0, 0.15)",
    description:
      "Simple, agentless IT automation engine for configuration management, application deployment, and task automation.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ee0000" stroke-width="1.8"/><path d="M8 18l3.5-11h1l3.5 11h-1.8l-.8-2.6H10.6L9.8 18H8zm3-4.2h2l-1-3.6-1 3.6z" fill="#ee0000"/></svg>`,
    defaultRoutes: [
      { label: "Documentation", path: "/ansible/latest/index.html" },
      { label: "Getting Started", path: "/ansible/latest/getting_started/index.html" },
      { label: "Playbooks", path: "/ansible/latest/playbook_guide/index.html" },
      { label: "Module Index", path: "/ansible/latest/collections/index.html" },
    ],
  },
  git: {
    id: "git",
    name: "Git Reference Manual",
    version: "v2.49",
    category: "DevOps & Cloud",
    color: "#f05032",
    bgTint: "rgba(240, 80, 50, 0.15)",
    description:
      "Official Git documentation: commands, workflows, branching, merge/rebase strategies, and Pro Git book chapters.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5L2.5 12L12 21.5L21.5 12L12 2.5Z" stroke="#f05032" stroke-width="1.8" stroke-linejoin="round"/><circle cx="9.5" cy="12" r="2" fill="#f05032"/><circle cx="14.5" cy="9" r="2" fill="#f05032"/><circle cx="14.5" cy="15" r="2" fill="#f05032"/><path d="M9.5 12H14.5M14.5 9V15" stroke="#ffffff" stroke-width="1.5"/></svg>`,
  },
  curl: {
    id: "curl",
    name: "curl & libcurl",
    version: "v8.13",
    category: "DevOps & Cloud",
    color: "#07354b",
    bgTint: "rgba(7, 53, 75, 0.25)",
    description:
      "Command line tool and library for transferring data with URLs: HTTP/1.1, HTTP/2, HTTP/3, TLS, and libcurl C API.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="M8 12H16M13 9L16 12L13 15"/></svg>`,
  },
  cmake: {
    id: "cmake",
    name: "CMake Reference",
    version: "v4.0",
    category: "DevOps & Cloud",
    color: "#064f8c",
    bgTint: "rgba(6, 79, 140, 0.22)",
    description:
      "Cross-platform build system generator: CMakeLists commands, target properties, generator expressions, and modules.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 22 20 2 20 12 2" stroke="#064f8c" stroke-width="1.8" stroke-linejoin="round"/><polygon points="12 7 18 18 6 18 12 7" fill="#dc2626" fill-opacity="0.8"/></svg>`,
  },
  ninja: {
    id: "ninja",
    name: "Ninja Build Manual",
    version: "v1.12",
    category: "DevOps & Cloud",
    color: "#71717a",
    bgTint: "rgba(113, 113, 122, 0.16)",
    description:
      "Small build system with a focus on speed: build.ninja syntax, rules, edge dependencies, and generator integration.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 2.5V6.5M12 17.5V21.5M2.5 12H6.5M17.5 12H21.5"/><circle cx="12" cy="12" r="3.5"/></svg>`,
  },
  powershell: {
    id: "powershell",
    name: "PowerShell 7.5",
    version: "v7.5",
    category: "DevOps & Cloud",
    color: "#2563eb",
    bgTint: "rgba(37, 99, 235, 0.16)",
    description:
      "Cross-platform task automation and configuration management framework: cmdlets, scripting language, and modules.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="3" stroke="#2563eb" stroke-width="1.8"/><path d="M6.5 8.5L10.5 12L6.5 15.5M11.5 15.5H16.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  cmd: {
    id: "cmd",
    name: "Windows CMD Commands",
    version: "Win11/Server",
    category: "DevOps & Cloud",
    color: "#a1a1aa",
    bgTint: "rgba(161, 161, 170, 0.15)",
    description:
      "Complete A-Z reference of Windows Command Prompt (cmd.exe) internal and external commands, batch scripts, and syntax.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="3" stroke="#a1a1aa" stroke-width="1.8"/><path d="M6 9L9.5 12L6 15M11 15H15" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },

  // ==========================================
  // 14. Architecture & Design (3)
  // ==========================================
  design_patterns: {
    id: "design_patterns",
    name: "Software Design Patterns",
    version: "2026",
    category: "Architecture & Design",
    color: "#06b6d4",
    bgTint: "rgba(6, 182, 212, 0.15)",
    description:
      "Comprehensive design patterns reference: Creational, Structural, and Behavioral patterns with real-world examples and diagrams.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.8"><polygon points="12 2 19 8.5 12 15 5 8.5 12 2"/><polygon points="12 9 19 15.5 12 22 5 15.5 12 9"/></svg>`,
    defaultRoutes: [
      { label: "Design Patterns", path: "/design-patterns" },
      { label: "Creational", path: "/design-patterns/creational-patterns" },
      { label: "Structural", path: "/design-patterns/structural-patterns" },
      { label: "Behavioral", path: "/design-patterns/behavioral-patterns" },
    ],
  },
  material_design: {
    id: "material_design",
    name: "Material Design 3 (Web)",
    version: "M3",
    category: "Architecture & Design",
    color: "#a855f7",
    bgTint: "rgba(168, 85, 247, 0.15)",
    description:
      "Google's Material Design 3 Web Components: accessible UI components, design tokens, dynamic color theming, and typography.",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="7.5" cy="7.5" r="4.5" stroke="#a855f7" stroke-width="1.8"/><rect x="12" y="12" width="9" height="9" rx="2" stroke="#a855f7" stroke-width="1.8"/><polygon points="16.5 3 21 11 12 11 16.5 3" stroke="#a855f7" stroke-width="1.8"/></svg>`,
    defaultRoutes: [
      { label: "Introduction", path: "/about/intro/" },
      { label: "Theming", path: "/theming/material-theming/" },
      { label: "Buttons", path: "/components/button/" },
      { label: "Dialogs", path: "/components/dialog/" },
      { label: "Text Fields", path: "/components/text-field/" },
    ],
  },
  refactoring: {
    id: "refactoring",
    name: "Refactoring & Architecture",
    version: "2026",
    category: "Architecture & Design",
    color: "#ec4899",
    bgTint: "rgba(236, 72, 153, 0.15)",
    description:
      "Clean Code, Refactoring techniques, Code Smells, SOLID principles, and architectural design patterns.",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/><path d="M12 9v4l3 2"/></svg>`,
    defaultRoutes: [
      { label: "Refactoring", path: "/refactoring" },
      { label: "Code Smells", path: "/refactoring/smells" },
      { label: "Design Patterns", path: "/design-patterns" },
      { label: "Clean Code", path: "/refactoring/techniques" },
    ],
  },
};

export function getSiteBrand(
  siteId: string,
  fallbackName?: string,
  fallbackVer?: string
): SiteBrand {
  if (SITE_BRANDS[siteId]) {
    return SITE_BRANDS[siteId];
  }
  return {
    id: siteId,
    name: fallbackName || siteId,
    version: fallbackVer || "latest",
    category: "Backend, Auth & APIs",
    color: "#38bdf8",
    bgTint: "rgba(56, 189, 248, 0.14)",
    description: `Offline documentation pack for ${fallbackName || siteId}.`,
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20V22H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z"/></svg>`,
  };
}
