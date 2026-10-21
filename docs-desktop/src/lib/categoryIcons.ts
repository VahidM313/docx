// High-fidelity handcrafted SVG icons for all 14 documentation categories
export const CATEGORY_ICONS: Record<string, { color: string; bg: string; svg: string }> = {
  "Frontend & UI": {
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="3"/>
      <path d="M3 9h18"/>
      <path d="M9 21V9"/>
    </svg>`,
  },
  "React Ecosystem": {
    color: "#61dafb",
    bg: "rgba(97, 218, 251, 0.15)",
    svg: `<svg viewBox="-11.5 -10.23174 23 20.46348" fill="currentColor">
      <circle cx="0" cy="0" r="2.05"/>
      <g stroke="currentColor" stroke-width="1" fill="none">
        <ellipse rx="11" ry="4.2"/>
        <ellipse rx="11" ry="4.2" transform="rotate(60)"/>
        <ellipse rx="11" ry="4.2" transform="rotate(120)"/>
      </g>
    </svg>`,
  },
  "Vue Ecosystem": {
    color: "#42b883",
    bg: "rgba(66, 184, 131, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none">
      <path d="M2 3h4.5L12 13.5 17.5 3H22L12 20.5 2 3z" fill="#42b883"/>
      <path d="M6.5 3h3.5L12 6.5 14 3h3.5L12 12.5 6.5 3z" fill="#35495e"/>
    </svg>`,
  },
  "Web Frameworks & Tools": {
    color: "#f97316",
    bg: "rgba(249, 115, 22, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
      <path d="M2 12h20"/>
    </svg>`,
  },
  "TanStack Suite": {
    color: "#e11d48",
    bg: "rgba(225, 29, 72, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>`,
  },
  "Backend, Auth & APIs": {
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
      <line x1="6" x2="6.01" y1="6" y2="6"/>
      <line x1="6" x2="6.01" y1="18" y2="18"/>
      <line x1="10" x2="18" y1="6" y2="6"/>
      <line x1="10" x2="18" y1="18" y2="18"/>
    </svg>`,
  },
  "Databases & SQL": {
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
      <path d="M3 12A9 3 0 0 0 21 12"/>
    </svg>`,
  },
  "AI & Machine Learning": {
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v4"/>
      <path d="M12 18v4"/>
      <path d="m4.93 4.93 2.83 2.83"/>
      <path d="m16.24 16.24 2.83 2.83"/>
      <path d="M2 12h4"/>
      <path d="M18 12h4"/>
      <path d="m4.93 19.07 2.83-2.83"/>
      <path d="m16.24 7.76 2.83-2.83"/>
      <circle cx="12" cy="12" r="3.5"/>
    </svg>`,
  },
  "Python Ecosystem": {
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.922 2c-3.13 0-2.936 1.358-2.936 1.358l.006 1.408h2.984v.425H6.284S4 4.936 4 8.08c0 3.146 1.99 3.044 1.99 3.044h1.189v-1.673s-.065-1.99 1.956-1.99h3.364s1.892.032 1.892-1.826V3.864S14.776 2 11.922 2zm-1.636 1.018a.65.65 0 1 1 0 1.3.65.65 0 0 1 0-1.3zM12.078 22c3.13 0 2.936-1.358 2.936-1.358l-.006-1.408h-2.984v-.425h5.692S20 19.064 20 15.92c0-3.146-1.99-3.044-1.99-3.044h-1.189v1.673s.065 1.99-1.956 1.99h-3.364s-1.892-.032-1.892 1.826v1.772S9.224 22 12.078 22zm1.636-1.018a.65.65 0 1 1 0-1.3.65.65 0 0 1 0 1.3z"/>
    </svg>`,
  },
  "Rust Ecosystem": {
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.22 4.22l2.12 2.12m11.32 11.32 2.12 2.12M4.22 19.78l2.12-2.12m11.32-11.32 2.12-2.12"/>
    </svg>`,
  },
  "Go (Golang)": {
    color: "#00add8",
    bg: "rgba(0, 173, 216, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>`,
  },
  "C & C++ Ecosystem": {
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
      <path d="M12 22V12"/>
      <path d="M22 7l-10 5"/>
      <path d="M2 7l10 5"/>
    </svg>`,
  },
  "DevOps & Cloud": {
    color: "#ec4899",
    bg: "rgba(236, 72, 153, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
    </svg>`,
  },
  "Architecture & Design": {
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="8" height="8" x="3" y="3" rx="2"/>
      <path d="M7 11v4a2 2 0 0 0 2 2h4"/>
      <rect width="8" height="8" x="13" y="13" rx="2"/>
    </svg>`,
  },
  "GUI": {
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="M6 8h.01"/>
      <path d="M10 8h.01"/>
      <path d="M14 8h.01"/>
      <path d="M2 12h20"/>
      <path d="M7 16h10"/>
    </svg>`,
  },
  "Graphics & Game APIs": {
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m21 16-9 5-9-5V8l9-5 9 5v8Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/>
      <path d="M12 12v9"/>
    </svg>`,
  },
  "Languages & Compilers": {
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
      <line x1="14" x2="10" y1="4" y2="20"/>
    </svg>`,
  },
};
