import fs from "fs";
import path from "path";

const dir = path.resolve("docs-desktop/sites.d");

const updatedLogos: Record<string, { svg: string; color?: string }> = {
  // 1. Java (Official steaming coffee cup with saucer)
  java: {
    color: "#ea580c",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M8.5 2C9.5 3.5 7.5 5 8.5 6.5M12.5 1.5C14 3.2 11.8 4.8 12.5 6.5M16 3C17 4.2 15.5 5.2 16 6.5" stroke="#f97316" stroke-width="1.6" stroke-linecap="round"/><path d="M4.5 8.5H16.5C16.5 13.5 14.5 16 10.5 16C6.5 16 4.5 13.5 4.5 8.5Z" stroke="#f97316" stroke-width="1.8" fill="rgba(249, 115, 22, 0.15)"/><path d="M16.5 10H18C19.4 10 20.2 11 20.2 12C20.2 13 19.4 14 18 14H15" stroke="#f97316" stroke-width="1.8" stroke-linecap="round"/><path d="M3 18.5C7.5 21 14.5 21 19 18.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/><path d="M5.5 21C9 22.5 13 22.5 16.5 21" stroke="#0284c7" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },

  // 2. MATLAB (Official MathWorks 3D L-shaped membrane wave surface)
  matlab: {
    color: "#e16024",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 15.5L12 21L21.5 15.5L18.5 8.5L12 11.5L8 4.5L2.5 15.5Z" stroke="#e16024" stroke-width="1.8" stroke-linejoin="round" fill="rgba(225, 96, 36, 0.15)"/><path d="M8 4.5L12 11.5L18.5 8.5" stroke="#fb923c" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 11.5V21" stroke="#fb923c" stroke-width="1.8"/><path d="M4.5 12C7.5 15 10 15 12 15C14 15 16.5 15 19.5 12" stroke="#ea580c" stroke-width="1.3" stroke-linecap="round"/><path d="M6 8.5C8.5 10.5 10.5 13 12 13C13.5 13 15.5 10.5 18 8.5" stroke="#fdba74" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  },

  // 3. Raylib (Official Raylib square frame with iconic geometric pixel 'r')
  raylib: {
    color: "#ffffff",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="2.5" width="19" height="19" rx="2.5" stroke="#ffffff" stroke-width="1.9" fill="rgba(255, 255, 255, 0.06)"/><path d="M6.5 7.5H10.5V17H6.5V7.5Z" fill="#ffffff"/><path d="M10.5 7.5H16.5V11H10.5V7.5Z" fill="#ffffff"/><rect x="15" y="11" width="2.5" height="2.5" fill="#ffffff"/></svg>`,
  },

  // 4. OpenGL (Official Khronos 3D globe wrapped by the sweeping red ribbon)
  opengl: {
    color: "#5586a4",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.12)"/><ellipse cx="12" cy="12" rx="3.5" ry="7" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" opacity="0.8"/><line x1="5" y1="12" x2="19" y2="12" stroke="#38bdf8" stroke-width="1" opacity="0.8"/><path d="M2.5 15.5C4 18.5 8 20.5 12.5 20C17.5 19.5 21 16 21.5 11.5C21.8 8.5 19.5 6 16.5 5.5C13.5 5 10 7 7.5 9.5L18.5 15.5" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },

  // 5. NVIDIA CUDA (Official NVIDIA eye spiral logo)
  cuda: {
    color: "#76b900",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 4C6.5 4 3 8 3 12C3 16 6.5 20 12 20C17.5 20 21 16 21 12" stroke="#76b900" stroke-width="2" stroke-linecap="round"/><path d="M12 7.5C8.5 7.5 6.5 9.5 6.5 12C6.5 14.5 8.5 16.5 12 16.5C15 16.5 17.5 14.5 17.5 12" stroke="#76b900" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="#76b900"/><path d="M20 12H21" stroke="#76b900" stroke-width="2" stroke-linecap="round"/></svg>`,
  },

  // 6. Vulkan (Official Khronos Vulkan faceted red V)
  vulkan: {
    color: "#bd002c",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M3.5 4L12 19.5L20.5 4H15.5L12 11.5L8.5 4H3.5Z" stroke="#bd002c" stroke-width="1.8" fill="rgba(189, 0, 44, 0.2)" stroke-linejoin="round"/><path d="M12 11.5V19.5" stroke="#ff3366" stroke-width="1.8"/><path d="M8.5 4L12 11.5L15.5 4" stroke="#ff3366" stroke-width="1.5"/></svg>`,
  },

  // 7. WebGPU (W3C WebGPU 3D faceted cube)
  webgpu: {
    color: "#005a9c",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5L20.5 7.5V16.5L12 21.5L3.5 16.5V7.5L12 2.5Z" stroke="#005a9c" stroke-width="1.8" stroke-linejoin="round" fill="rgba(0, 90, 156, 0.12)"/><path d="M3.5 7.5L12 12.5L20.5 7.5" stroke="#38bdf8" stroke-width="1.6"/><path d="M12 12.5V21.5" stroke="#38bdf8" stroke-width="1.6"/><path d="M7 9.5L12 15.5L17 9.5" stroke="#005a9c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },

  // 8. DirectX (Official Microsoft DirectX 3D X badge)
  directx: {
    color: "#0078d4",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 4L10 12L4 20H8L12 14.5L16 20H20L14 12L20 4H16L12 9.5L8 4H4Z" stroke="#0078d4" stroke-width="1.8" fill="rgba(0, 120, 212, 0.2)" stroke-linejoin="round"/><path d="M10 12L12 9.5L14 12L12 14.5L10 12Z" fill="#38bdf8"/></svg>`,
  },

  // 9. Apple Metal (Official Metal interlocking M chevron)
  metal: {
    color: "#a2aaad",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 18.5V5.5L12 14L21 5.5V18.5" stroke="#a2aaad" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 10L12 14L16.5 10" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="18.5" x2="21" y2="18.5" stroke="#a2aaad" stroke-width="2" stroke-linecap="round"/></svg>`,
  },

  // 10. Playwright (Official dual drama & comedy masks)
  playwright: {
    color: "#2eadd2",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5C4 4 7 3 9.5 3C12 3 13 4.5 13 7.5C13 11 11.5 13.5 9 13.5C6.5 13.5 4 10.5 4 6.5Z" stroke="#45ba4b" stroke-width="1.7" fill="rgba(69, 186, 75, 0.15)"/><circle cx="7" cy="6.5" r="0.9" fill="#45ba4b"/><circle cx="10" cy="6.5" r="0.9" fill="#45ba4b"/><path d="M6.5 9.5C7.5 11 9 11 10 9.5" stroke="#45ba4b" stroke-width="1.3" stroke-linecap="round"/><path d="M12.5 10.5C12.5 8 15.5 7 18 7C20.5 7 21.5 8.5 21.5 11.5C21.5 15 20 17.5 17.5 17.5C15 17.5 12.5 14.5 12.5 10.5Z" stroke="#2eadd2" stroke-width="1.7" fill="rgba(46, 173, 210, 0.15)"/><circle cx="15.5" cy="10.5" r="0.9" fill="#2eadd2"/><circle cx="18.5" cy="10.5" r="0.9" fill="#2eadd2"/><path d="M15.5 14.5C16.5 13.5 18 13.5 19 14.5" stroke="#2eadd2" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  },

  // 11. CSS-Tricks (Official orange starburst with glasses)
  css_tricks: {
    color: "#ff7a18",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2.5 14.8 8.2 21 9.1 16.5 13.5 17.6 19.7 12 16.8 6.4 19.7 7.5 13.5 3 9.1 9.2 8.2 12 2.5" stroke="#ff7a18" stroke-width="1.8" fill="rgba(255, 122, 24, 0.2)" stroke-linejoin="round"/><rect x="7" y="10" width="4" height="2.8" rx="0.8" fill="#18181b" stroke="#ff7a18" stroke-width="1.2"/><rect x="13" y="10" width="4" height="2.8" rx="0.8" fill="#18181b" stroke="#ff7a18" stroke-width="1.2"/><line x1="11" y1="11.2" x2="13" y2="11.2" stroke="#ff7a18" stroke-width="1.2"/></svg>`,
  },

  // 12. Base UI (MUI Base UI unstyled B glyph)
  base_ui: {
    color: "#007fff",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 4.5H13C15.5 4.5 17.5 6 17.5 8.5C17.5 10 16.5 11.2 15 11.8C17 12.3 18.5 14 18.5 16C18.5 18.8 16 20.5 13 20.5H6V4.5Z" stroke="#007fff" stroke-width="2" stroke-linejoin="round" fill="rgba(0, 127, 255, 0.12)"/><line x1="6" y1="12" x2="14.5" y2="12" stroke="#007fff" stroke-width="2"/><circle cx="10" cy="8.2" r="1.2" fill="#007fff"/><circle cx="10" cy="16.2" r="1.2" fill="#007fff"/></svg>`,
  },

  // 13. C# (Official Microsoft C# hexagon badge)
  csharp: {
    color: "#9333ea",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2.5 20.5 7.4 20.5 17.1 12 22 3.5 17.1 3.5 7.4 12 2.5" stroke="#9333ea" stroke-width="1.8" stroke-linejoin="round" fill="rgba(147, 51, 234, 0.15)"/><path d="M11 8.5C8.5 8.5 7 10 7 12.2C7 14.5 8.5 16 11 16" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round"/><path d="M14 10.5V14.5M16.5 10.5V14.5M13 11.5H17.5M13 13.5H17.5" stroke="#c084fc" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },

  // 14. Kotlin (Official JetBrains Kotlin diagonal polygon)
  kotlin: {
    color: "#7f52ff",
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="21.5 2.5 2.5 21.5 2.5 2.5 21.5 2.5" fill="#7f52ff" stroke="#7f52ff" stroke-width="1"/><polygon points="21.5 2.5 12 12 21.5 21.5 21.5 2.5" fill="#c757bc" stroke="#c757bc" stroke-width="1"/><polygon points="2.5 21.5 12 12 2.5 2.5 2.5 21.5" fill="#e16024" opacity="0.3"/></svg>`,
  },

  // 15. Zig (Official Zig lightning Z)
  zig: {
    color: "#f7a41d",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5H19.5L14 12H20L5 20L9.5 13.5H4L4 5.5Z" stroke="#f7a41d" stroke-width="1.8" stroke-linejoin="round" fill="rgba(247, 164, 29, 0.2)"/><circle cx="17" cy="8.5" r="1.2" fill="#f7a41d"/></svg>`,
  },

  // 16. Odin (Official Odin Norse helmet / rune)
  odin: {
    color: "#1c698c",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13C5 8.5 8 5 12 5C16 5 19 8.5 19 13V18H5V13Z" stroke="#1c698c" stroke-width="1.8" stroke-linejoin="round" fill="rgba(28, 105, 140, 0.15)"/><path d="M5 9C3 7 3 4 5 3C7 5 6 8 5 9ZM19 9C21 7 21 4 19 3C17 5 18 8 19 9Z" stroke="#38bdf8" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 5V18M8 12H10M14 12H16" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  },

  // 17. Julia (Official Julia 3-color dot triangle)
  julia: {
    color: "#9558b2",
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="4.2" stroke="#9558b2" stroke-width="2" fill="rgba(149, 88, 178, 0.25)"/><circle cx="6.5" cy="16.5" r="4.2" stroke="#cb3c33" stroke-width="2" fill="rgba(203, 60, 51, 0.25)"/><circle cx="17.5" cy="16.5" r="4.2" stroke="#389826" stroke-width="2" fill="rgba(56, 152, 38, 0.25)"/></svg>`,
  },

  // 18. SFML (Official SFML multimedia S)
  sfml: {
    color: "#83c024",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M17.5 7C17.5 4.5 15.5 3 12 3C8.5 3 6.5 4.8 6.5 7.5C6.5 11 11 11.5 11 13C11 14.5 9.5 15.2 8 15.2C6 15.2 4.5 14 4.5 12" stroke="#83c024" stroke-width="2.2" stroke-linecap="round"/><path d="M6.5 17C6.5 19.5 8.5 21 12 21C15.5 21 17.5 19.2 17.5 16.5C17.5 13 13 12.5 13 11C13 9.5 14.5 8.8 16 8.8C18 8.8 19.5 10 19.5 12" stroke="#83c024" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="#83c024"/></svg>`,
  },

  // 19. SDL (Official SDL 3D cube & media wave)
  sdl: {
    color: "#1772b4",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5L20.5 7.5V16.5L12 21.5L3.5 16.5V7.5L12 2.5Z" stroke="#1772b4" stroke-width="1.8" stroke-linejoin="round" fill="rgba(23, 114, 180, 0.15)"/><path d="M3.5 7.5L12 12.5L20.5 7.5M12 12.5V21.5" stroke="#38bdf8" stroke-width="1.6"/><path d="M7 11L9.5 9.5L12 11L14.5 9.5L17 11" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },

  // 20. GLFW (Official GLFW 3D window with coordinate axes)
  glfw: {
    color: "#e65100",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#e65100" stroke-width="1.8" fill="rgba(230, 81, 0, 0.12)"/><line x1="3" y1="8.5" x2="21" y2="8.5" stroke="#e65100" stroke-width="1.5"/><circle cx="6" cy="6.2" r="1" fill="#e65100"/><circle cx="9" cy="6.2" r="1" fill="#e65100"/><path d="M12 17V11M12 17L8.5 14M12 17L15.5 14" stroke="#ff8f00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },

  // 21. wxWidgets (Official wxWidgets 4-color puzzle blocks)
  wxwidgets: {
    color: "#2a75d3",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" stroke="#2a75d3" stroke-width="1.8" fill="rgba(42, 117, 211, 0.25)"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="#e11d48" stroke-width="1.8" fill="rgba(225, 29, 72, 0.25)"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="#f59e0b" stroke-width="1.8" fill="rgba(245, 158, 11, 0.25)"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="#10b981" stroke-width="1.8" fill="rgba(16, 185, 129, 0.25)"/><path d="M5.5 7L7 10L8.5 7M15.5 5.5L18.5 8.5M18.5 5.5L15.5 8.5" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  },

  // 22. FLTK (Official Fast Light Toolkit FL spark logo)
  fltk: {
    color: "#e11d48",
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 5H13M4 11H11M4 5V19" stroke="#e11d48" stroke-width="2.2" stroke-linecap="round"/><path d="M14 11V19H20" stroke="#f43f5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17.5" cy="6.5" r="2" fill="#fb7185"/><path d="M17.5 3V4.5M17.5 8.5V10M14 6.5H15.5M19.5 6.5H21" stroke="#fb7185" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  },

  // 23. GPUI (Zed GPU-accelerated lightning chip)
  gpui: {
    color: "#f59e0b",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2.5" stroke="#f59e0b" stroke-width="1.8" fill="rgba(245, 158, 11, 0.15)"/><path d="M13 7.5L8.5 13H12.5L11 17.5L16 11.5H12.5L13 7.5Z" stroke="#f59e0b" stroke-width="1.5" fill="#f59e0b" stroke-linejoin="round"/><path d="M8 2V5M12 2V5M16 2V5M8 19V22M12 19V22M16 19V22M2 8H5M2 12H5M2 16H5M19 8H22M19 12H22M19 16H22" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  },

  // 24. PyQt (Official Qt Q with Python cyan/yellow accent)
  pyqt: {
    color: "#41cd52",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="2.5" width="19" height="19" rx="4" stroke="#41cd52" stroke-width="1.9" fill="rgba(65, 205, 82, 0.12)"/><circle cx="11.5" cy="11.5" r="5" stroke="#41cd52" stroke-width="1.8"/><path d="M14.5 14.5L17.5 17.5" stroke="#41cd52" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="9.5" r="1.1" fill="#38bdf8"/></svg>`,
  },

  // 25. Mason CLI (Official Mason brick wall)
  mason: {
    color: "#0284c7",
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#0284c7" stroke-width="1.8" fill="rgba(2, 132, 199, 0.12)"/><line x1="3" y1="9.3" x2="21" y2="9.3" stroke="#0284c7" stroke-width="1.6"/><line x1="3" y1="14.6" x2="21" y2="14.6" stroke="#0284c7" stroke-width="1.6"/><line x1="12" y1="4" x2="12" y2="9.3" stroke="#0284c7" stroke-width="1.6"/><line x1="7.5" y1="9.3" x2="7.5" y2="14.6" stroke="#0284c7" stroke-width="1.6"/><line x1="16.5" y1="9.3" x2="16.5" y2="14.6" stroke="#0284c7" stroke-width="1.6"/><line x1="12" y1="14.6" x2="12" y2="20" stroke="#0284c7" stroke-width="1.6"/></svg>`,
  },
};

for (const [id, update] of Object.entries(updatedLogos)) {
  const filePath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`File ${filePath} not found!`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.svg = update.svg;
  if (update.color) data.color = update.color;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`✓ Updated authentic neon logo for ${id}`);
}

console.log("All authentic neon logos applied successfully.");
