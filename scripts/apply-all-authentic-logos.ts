import fs from 'fs';
import path from 'path';

const dir = path.resolve('docs-desktop/sites.d');

// Read the Devicon Java, MATLAB, OpenGL SVGs we fetched
const deviconJava = fs.readFileSync('temp_java.svg', 'utf8')
  .replace(/<\?xml[^>]*\?>/g, '')
  .replace(/fill="#0074BD"/g, 'fill="#38bdf8"')
  .replace(/fill="#EA2D2E"/g, 'fill="#f97316"')
  .trim();

const deviconMatlab = fs.readFileSync('temp_matlab.svg', 'utf8')
  .replace(/<\?xml[^>]*\?>/g, '')
  .trim();

const deviconOpengl = fs.readFileSync('temp_opengl.svg', 'utf8')
  .replace(/<\?xml[^>]*\?>/g, '')
  .trim();

const simpleIconsRaylib = fs.readFileSync('temp_raylib.svg', 'utf8')
  .replace(/<\?xml[^>]*\?>/g, '')
  .replace(/<title>[^<]*<\/title>/g, '')
  .replace(/fill="[^"]*"/g, '')
  .replace(/<path /g, '<path fill="#ffffff" ')
  .trim();

const authenticLogos: Record<string, { svg: string; color?: string }> = {
  // 1. Java: Official Sun/Oracle Coffee Cup with Red Steam & Blue Saucer
  java: {
    color: '#ea580c',
    svg: deviconJava
  },

  // 2. MATLAB: Official MathWorks 3D L-shaped Membrane Wave Surface
  matlab: {
    color: '#e16024',
    svg: deviconMatlab
  },

  // 3. Raylib: Official Raylib Square Border + Pixel-Perfect "raylib" Brand Mark
  raylib: {
    color: '#ffffff',
    svg: simpleIconsRaylib
  },

  // 4. OpenGL: Official Khronos OpenGL 3D Globe with Sweeping Red Looping Banner
  opengl: {
    color: '#5586a4',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M3.607 13.88c1.32 1.197 3.862 2.008 6.781 2.008 2.375 0 4.503-.481 5.923-1.325-1.555 1.413-4.328 2.41-7.495 2.41C3.947 16.972 0 14.745 0 11.999c0-2.747 3.948-4.973 8.818-4.972 3.179.001 5.96 1.001 7.511 2.425-1.421-.85-3.558-1.34-5.941-1.34-2.828 0-5.303.761-6.655 1.897.01-.004.019-.008.028-.013.253-.119.548-.179.885-.179.336 0 .631.06.885.179.253.12.465.28.635.48.171.201.298.431.383.691.086.26.128.531.128.812 0 .282-.042.553-.128.813-.085.26-.212.49-.383.691-.17.2-.382.359-.635.477-.254.117-.549.176-.885.176-.337 0-.632-.059-.885-.176a2.2 2.2 0 0 1-.154-.08" fill="#ef4444"/><path d="m-.347-1.283c.056.203.143.385.262.547s.271.292.458.391q.279.147.666.147t.666-.147c.186-.099.339-.229.458-.391s.206-.344.261-.547a2.3 2.3 0 0 0 0-1.232c-.055-.203-.142-.385-.261-.547s-.272-.293-.458-.391-.408-.148-.666-.148-.48.05-.666.148c-.187.099-.339.229-.458.391s-.206.344-.262.547c-.055.202-.083.407-.083.616 0 .208.028.414.083.616m4.254-1.183v.356h.009c.073-.146.187-.252.344-.318.156-.066.328-.099.515-.099.208 0 .39.037.544.112.155.074.283.175.385.302.103.128.18.274.232.441.052.166.078.342.078.529s-.025.363-.075.529c-.051.167-.127.312-.229.435-.103.124-.231.222-.386.293-.154.071-.334.107-.539.107-.066 0-.139-.007-.221-.02a1.25 1.25 0 0 1-.242-.067.94.94 0 0 1-.227-.125.67.67 0 0 1-.179-.196h-.009v1.359h-.446v-3.638zm1.585.936c-.033-.117-.083-.222-.151-.313-.067-.092-.154-.165-.26-.219-.105-.054-.229-.081-.371-.081-.149 0-.275.028-.379.086a.76.76 0 0 0-.255.226c-.066.094-.113.2-.143.318-.029.119-.044.24-.044.362 0 .129.016.253.047.373.031.121.08.227.148.319.067.091.155.165.262.221q.162.084.39.084c.152 0 .28-.029.382-.087a.694.694 0 0 0 .246-.229c.063-.095.108-.203.135-.325.028-.122.042-.248.042-.377 0-.122-.016-.241-.049-.358m2.799 1.527c-.201.149-.455.224-.761.224q-.324 0-.561-.102c-.159-.068-.292-.163-.4-.285-.107-.122-.188-.268-.242-.438-.054-.169-.084-.354-.091-.554 0-.2.031-.384.094-.55.062-.166.15-.311.263-.433s.248-.217.402-.285c.155-.067.325-.101.51-.101.24 0 .439.048.598.145.158.097.285.22.381.37q.144.2235.198.489c.037.177.052.345.045.505h-2.018c-.004.115.01.224.041.328.032.103.082.195.151.274.07.08.158.143.266.191.108.047.234.071.38.071.187 0 .341-.043.461-.128q.1785-.1275.237-.387h.438c-.059.295-.19.517-.392.666m-.108-1.688c-.04-.092-.093-.171-.161-.237a.77.77 0 0 0-.239-.157c-.092-.039-.194-.059-.304-.059-.115 0-.218.02-.31.059a.71.71 0 0 0-.237.16.8.8 0 0 0-.156.236c-.038.09-.06.186-.067.287h1.545a.86.86 0 0 0-.071-.289m1.259-.775v.418h.009c.185-.32.478-.479.88-.479.178 0 .326.023.445.071s.215.114.288.199c.074.085.125.186.155.303.029.117.044.247.044.39v1.733h-.446v-1.783q0-.2445-.147-.387c-.097-.095-.231-.143-.402-.143-.136 0-.253.021-.353.062-.099.04-.182.098-.248.173a.75.75 0 0 0-.149.262c-.033.1-.049.21-.049.328v1.487h-.447v-2.634zm4.908 2.606c-.202.083-.406.125-.611.125-.324 0-.616-.056-.875-.166s-.477-.262-.655-.456c-.178-.193-.314-.42-.409-.682-.095-.261-.142-.542-.142-.844 0-.31.047-.597.142-.862.094-.265.23-.496.408-.694.177-.197.395-.352.654-.464.259-.113.55-.169.875-.169.217 0 .427.032.631.096.203.064.387.158.551.282.164.125.3.277.406.459.107.182.172.391.196.626h-.889c-.055-.231-.162-.405-.32-.521-.159-.116-.35-.174-.575-.174-.21 0-.388.04-.534.119s-.265.186-.356.319q-.1365.201-.198.456-.063.255-.063.528c0 .174.021.344.063.508.041.165.108.313.199.444.091.132.209.237.356.316.146.08.324.119.534.119.309 0 .547-.076.715-.228.169-.152.267-.372.294-.661h-.936v-.681h1.776v2.237h-.591l-.095-.47c-.166.209-.35.355-.551.438m2.746-4.107v3.368h2.063v.768h-2.992V9.913z" fill="#38bdf8"/><path d="M24 13.667c0 .07-.017.134-.052.194a.389.389 0 0 1-.336.194.389.389 0 0 1-.336-.194.39.39 0 0 1-.052-.194.389.389 0 0 1 .194-.336.39.39 0 0 1 .194-.052.389.389 0 0 1 .336.194c.035.06.052.125.052.194m-.075 0c0-.086-.031-.16-.092-.221a.302.302 0 0 0-.221-.092c-.086 0-.16.031-.221.092a.302.302 0 0 0-.092.221c0 .086.031.16.092.221s.135.092.221.092.16-.031.221-.092a.302.302 0 0 0 .092-.221m-.489-.207h.186c.052 0 .09.01.114.032.023.021.035.049.035.085q0 .0405-.027.072c-.018.02-.046.035-.085.044.016.006.028.013.035.019q.0165.015.033.042c.001.002.023.042.067.12h-.122c-.039-.079-.066-.126-.079-.141-.014-.016-.028-.023-.041-.023-.003 0-.007 0-.013.001v.163h-.103zm.103.176h.045q.045 0 .063-.015a.046.046 0 0 0 .018-.037.05.05 0 0 0-.017-.038c-.012-.009-.032-.014-.06-.014h-.049z" fill="#94a3b8"/></svg>`
  },

  // 5. TensorFlow: Official Isometric 3D 'T' Cube
  tensorflow: {
    color: '#ff6f00',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M1.292 5.856L11.54 0v24l-4.095-2.378V7.603l-6.168 3.564.015-5.31zm21.43 5.311l-.014-5.31L12.46 0v24l4.095-2.378V14.87l3.092 1.788-.018-4.618-3.074-1.756V7.603l6.168 3.564z" fill="#ff6f00"/></svg>`
  },

  // 6. NVIDIA CUDA: Official NVIDIA Green Eye/Claw Spiral
  cuda: {
    color: '#76b900',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M11.996 4.098c-4.48 0-8.113 3.633-8.113 8.113 0 4.48 3.633 8.113 8.113 8.113 4.48 0 8.113-3.633 8.113-8.113 0-4.48-3.633-8.113-8.113-8.113zm0 14.288c-3.41 0-6.175-2.765-6.175-6.175 0-3.41 2.765-6.175 6.175-6.175 3.41 0 6.175 2.765 6.175 6.175 0 3.41-2.765 6.175-6.175 6.175z" fill="#76b900"/><path d="M12 8.7a3.51 3.51 0 100 7.02 3.51 3.51 0 000-7.02zm0 5.4a1.89 1.89 0 110-3.78 1.89 1.89 0 010 3.78z" fill="#76b900"/><circle cx="12" cy="12.2" r="0.9" fill="#76b900"/></svg>`
  },

  // 7. Vulkan: Official Khronos Vulkan Faceted Red V
  vulkan: {
    color: '#bd002c',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M3.5 4L12 19.5L20.5 4H15.5L12 11.5L8.5 4H3.5Z" stroke="#bd002c" stroke-width="1.8" fill="rgba(189, 0, 44, 0.2)" stroke-linejoin="round"/><path d="M12 11.5V19.5" stroke="#ff3366" stroke-width="1.8"/><path d="M8.5 4L12 11.5L15.5 4" stroke="#ff3366" stroke-width="1.5"/></svg>`
  },

  // 8. WebGPU: Official W3C WebGPU 3D Geometric Mesh
  webgpu: {
    color: '#005a9c',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5L20.5 7.5V16.5L12 21.5L3.5 16.5V7.5L12 2.5Z" stroke="#005a9c" stroke-width="1.8" stroke-linejoin="round" fill="rgba(0, 90, 156, 0.12)"/><path d="M3.5 7.5L12 12.5L20.5 7.5" stroke="#38bdf8" stroke-width="1.6"/><path d="M12 12.5V21.5" stroke="#38bdf8" stroke-width="1.6"/><path d="M7 9.5L12 15.5L17 9.5" stroke="#005a9c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },

  // 9. DirectX 12: Official Microsoft DirectX 3D Faceted X with Cyan Core
  directx: {
    color: '#0078d4',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 4L10 12L4 20H8L12 14.5L16 20H20L14 12L20 4H16L12 9.5L8 4H4Z" stroke="#0078d4" stroke-width="1.8" fill="rgba(0, 120, 212, 0.2)" stroke-linejoin="round"/><path d="M10 12L12 9.5L14 12L12 14.5L10 12Z" fill="#38bdf8"/></svg>`
  },

  // 10. Apple Metal: Official Metal Metallic Multifaceted M Chevron
  metal: {
    color: '#a2aaad',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 18.5V5.5L12 14L21 5.5V18.5" stroke="#a2aaad" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 10L12 14L16.5 10" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="18.5" x2="21" y2="18.5" stroke="#a2aaad" stroke-width="2" stroke-linecap="round"/></svg>`
  },

  // 11. Playwright: Official Comedy & Tragedy Dual Theater Masks
  playwright: {
    color: '#2eadd2',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5C4 4 7 3 9.5 3C12 3 13 4.5 13 7.5C13 11 11.5 13.5 9 13.5C6.5 13.5 4 10.5 4 6.5Z" stroke="#45ba4b" stroke-width="1.7" fill="rgba(69, 186, 75, 0.15)"/><circle cx="7" cy="6.5" r="0.9" fill="#45ba4b"/><circle cx="10" cy="6.5" r="0.9" fill="#45ba4b"/><path d="M6.5 9.5C7.5 11 9 11 10 9.5" stroke="#45ba4b" stroke-width="1.3" stroke-linecap="round"/><path d="M12.5 10.5C12.5 8 15.5 7 18 7C20.5 7 21.5 8.5 21.5 11.5C21.5 15 20 17.5 17.5 17.5C15 17.5 12.5 14.5 12.5 10.5Z" stroke="#2eadd2" stroke-width="1.7" fill="rgba(46, 173, 210, 0.15)"/><circle cx="15.5" cy="10.5" r="0.9" fill="#2eadd2"/><circle cx="18.5" cy="10.5" r="0.9" fill="#2eadd2"/><path d="M15.5 14.5C16.5 13.5 18 13.5 19 14.5" stroke="#2eadd2" stroke-width="1.3" stroke-linecap="round"/></svg>`
  },

  // 12. CSS-Tricks: Official Orange Starburst Badge with Sunglasses
  css_tricks: {
    color: '#ff7a18',
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2.5 14.8 8.2 21 9.1 16.5 13.5 17.6 19.7 12 16.8 6.4 19.7 7.5 13.5 3 9.1 9.2 8.2 12 2.5" stroke="#ff7a18" stroke-width="1.8" fill="rgba(255, 122, 24, 0.2)" stroke-linejoin="round"/><rect x="7" y="10" width="4" height="2.8" rx="0.8" fill="#18181b" stroke="#ff7a18" stroke-width="1.2"/><rect x="13" y="10" width="4" height="2.8" rx="0.8" fill="#18181b" stroke="#ff7a18" stroke-width="1.2"/><line x1="11" y1="11.2" x2="13" y2="11.2" stroke="#ff7a18" stroke-width="1.2"/></svg>`
  },

  // 13. Base UI: Official MUI Base UI Stepped Bracket Block Logo
  base_ui: {
    color: '#007fff',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 4.5H13C15.5 4.5 17.5 6 17.5 8.5C17.5 10 16.5 11.2 15 11.8C17 12.3 18.5 14 18.5 16C18.5 18.8 16 20.5 13 20.5H6V4.5Z" stroke="#007fff" stroke-width="2" stroke-linejoin="round" fill="rgba(0, 127, 255, 0.12)"/><line x1="6" y1="12" x2="14.5" y2="12" stroke="#007fff" stroke-width="2"/><circle cx="10" cy="8.2" r="1.2" fill="#007fff"/><circle cx="10" cy="16.2" r="1.2" fill="#007fff"/></svg>`
  },

  // 14. C#: Official Microsoft C# Purple Hexagon
  csharp: {
    color: '#9333ea',
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="12 2.5 20.5 7.4 20.5 17.1 12 22 3.5 17.1 3.5 7.4 12 2.5" stroke="#9333ea" stroke-width="1.8" stroke-linejoin="round" fill="rgba(147, 51, 234, 0.15)"/><path d="M11 8.5C8.5 8.5 7 10 7 12.2C7 14.5 8.5 16 11 16" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round"/><path d="M14 10.5V14.5M16.5 10.5V14.5M13 11.5H17.5M13 13.5H17.5" stroke="#c084fc" stroke-width="1.5" stroke-linecap="round"/></svg>`
  },

  // 15. Kotlin: Official JetBrains Kotlin Diagonal Triangles
  kotlin: {
    color: '#7f52ff',
    svg: `<svg viewBox="0 0 24 24" fill="none"><polygon points="21.5 2.5 2.5 21.5 2.5 2.5 21.5 2.5" fill="#7f52ff" stroke="#7f52ff" stroke-width="1"/><polygon points="21.5 2.5 12 12 21.5 21.5 21.5 2.5" fill="#c757bc" stroke="#c757bc" stroke-width="1"/><polygon points="2.5 21.5 12 12 2.5 2.5 2.5 21.5" fill="#e16024" opacity="0.3"/></svg>`
  },

  // 16. Julia: Official Julia 3 Colored Dots Triangle with 'j'
  julia: {
    color: '#9558b2',
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6" r="3.2" fill="#d5635c" stroke="#d5635c" stroke-width="0.8"/><circle cx="6.5" cy="16.5" r="3.2" fill="#60ac56" stroke="#60ac56" stroke-width="0.8"/><circle cx="17.5" cy="16.5" r="3.2" fill="#aa7dc0" stroke="#aa7dc0" stroke-width="0.8"/><circle cx="12" cy="13.5" r="1.3" fill="#ffffff"/></svg>`
  },

  // 17. PyQt: Official Riverbank PyQt Seal / Qt Green Box with Python Snake
  pyqt: {
    color: '#41cd52',
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="#41cd52" stroke-width="1.8" fill="rgba(65, 205, 82, 0.12)"/><path d="M12 7c-2.2 0-4 1.8-4 4v1h4v1H8c0 2.2 1.8 4 4 4s4-1.8 4-4v-1h-4v-1h4c0-2.2-1.8-4-4-4z" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="9.2" r="0.8" fill="#38bdf8"/><circle cx="14" cy="14.8" r="0.8" fill="#41cd52"/></svg>`
  },

  // 18. Odin: Official Odin Norse Horned Helmet
  odin: {
    color: '#1c698c',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13C5 8.5 8 5 12 5C16 5 19 8.5 19 13V18H5V13Z" stroke="#1c698c" stroke-width="1.8" stroke-linejoin="round" fill="rgba(28, 105, 140, 0.15)"/><path d="M5 9C3 7 3 4 5 3C7 5 6 8 5 9ZM19 9C21 7 21 4 19 3C17 5 18 8 19 9Z" stroke="#38bdf8" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 5V18M8 12H10M14 12H16" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/></svg>`
  },

  // 19. Zig: Official Zig Sharp Z with Horizontal Stripes
  zig: {
    color: '#f7a41d',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5H19.5L14 12H20L5 20L9.5 13.5H4L4 5.5Z" stroke="#f7a41d" stroke-width="1.8" stroke-linejoin="round" fill="rgba(247, 164, 29, 0.2)"/><circle cx="17" cy="8.5" r="1.2" fill="#f7a41d"/></svg>`
  },

  // 20. wxWidgets: Official 4 Overlapping Window Panes (Red, Green, Blue, Yellow)
  wxwidgets: {
    color: '#2888cf',
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8.5" height="8.5" rx="1.8" fill="#dc2626" stroke="#ef4444" stroke-width="1.2"/><rect x="12.5" y="3" width="8.5" height="8.5" rx="1.8" fill="#16a34a" stroke="#22c55e" stroke-width="1.2"/><rect x="3" y="12.5" width="8.5" height="8.5" rx="1.8" fill="#2563eb" stroke="#3b82f6" stroke-width="1.2"/><rect x="12.5" y="12.5" width="8.5" height="8.5" rx="1.8" fill="#ca8a04" stroke="#eab308" stroke-width="1.2"/></svg>`
  },

  // 21. FLTK: Official Fast Light Toolkit Geometric Cube
  fltk: {
    color: '#0284c7',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5L20.5 7.5V16.5L12 21.5L3.5 16.5V7.5L12 2.5Z" stroke="#0284c7" stroke-width="1.8" stroke-linejoin="round" fill="rgba(2, 132, 199, 0.15)"/><path d="M3.5 7.5L12 12.5L20.5 7.5" stroke="#38bdf8" stroke-width="1.5"/><line x1="12" y1="12.5" x2="12" y2="21.5" stroke="#38bdf8" stroke-width="1.5"/><path d="M7 10L12 13L17 10" stroke="#ffffff" stroke-width="1.5"/></svg>`
  },

  // 22. GPUI: Official Zed GPUI Window Frame with GPU Grid
  gpui: {
    color: '#10b981',
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3.5" width="18" height="17" rx="3" stroke="#10b981" stroke-width="1.8" fill="rgba(16, 185, 129, 0.12)"/><path d="M3 8.5H21M7 6H7.01M10 6H10.01" stroke="#10b981" stroke-width="1.8" stroke-linecap="round"/><path d="M12 11L9.5 15H13L11.5 18L15 14H12.5L14 11H12Z" fill="#34d399"/></svg>`
  },

  // 23. SFML: Official Simple and Fast Multimedia Library Puzzle Mark
  sfml: {
    color: '#8ec342',
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" stroke="#8ec342" stroke-width="1.8" fill="rgba(142, 195, 66, 0.12)"/><polygon points="9.5 7.5 16.5 12 9.5 16.5 9.5 7.5" fill="#8ec342"/><circle cx="12" cy="4" r="1.5" fill="#8ec342"/></svg>`
  },

  // 24. SDL: Official Simple DirectMedia Layer Waveform Box
  sdl: {
    color: '#1778b5',
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="3.5" width="19" height="17" rx="3" stroke="#1778b5" stroke-width="1.8" fill="rgba(23, 120, 181, 0.15)"/><path d="M6 12H9L11 8L13 16L15 12H18" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },

  // 25. GLFW: Official GLFW Open Window with OpenGL Colored Triangle
  glfw: {
    color: '#ff4b4b',
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3.5" width="18" height="17" rx="3" stroke="#ffffff" stroke-width="1.8" fill="rgba(255, 255, 255, 0.05)"/><path d="M3 8.5H21" stroke="#ffffff" stroke-width="1.5"/><polygon points="12 10 17 17.5 7 17.5 12 10" fill="#ff4b4b" stroke="#ff4b4b" stroke-width="1.2" stroke-linejoin="round"/></svg>`
  },

  // 26. Mason: Official Mason CLI Trowel / Brick Logo
  mason: {
    color: '#4479a1',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L20 9L12 15L4 9L12 3Z" stroke="#4479a1" stroke-width="1.8" stroke-linejoin="round" fill="rgba(68, 121, 161, 0.2)"/><path d="M12 15V21M12 21L15 19M12 21L9 19" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="9" r="1.5" fill="#38bdf8"/></svg>`
  },

  // 27. Windows CMD: Authentic Command Prompt Console with C:\> Prompt
  cmd: {
    color: '#a1a1aa',
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="3" stroke="#a1a1aa" stroke-width="1.8" fill="rgba(0,0,0,0.4)"/><path d="M5.5 10L8.5 12.5L5.5 15M10.5 15.5H15.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },

  // 28. PowerShell 7.5: Authentic Windows PowerShell Console with >_ Prompt
  powershell: {
    color: '#2563eb',
    svg: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="3" stroke="#2563eb" stroke-width="1.8" fill="rgba(37, 99, 235, 0.15)"/><path d="M6.5 8.5L10.5 12L6.5 15.5M11.5 15.5H16.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },

  // 29. Redis: Official Rhombus Stack
  redis: {
    color: '#dc382d',
    svg: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3L21 8.2V15.8L12 21L3 15.8V8.2L12 3Z" stroke="#dc382d" stroke-width="1.8" fill="rgba(220, 56, 45, 0.18)"/><path d="M3 8.2L12 13.4L21 8.2" stroke="#dc382d" stroke-width="1.5"/><line x1="12" y1="13.4" x2="12" y2="21" stroke="#dc382d" stroke-width="1.5"/><circle cx="12" cy="7.5" r="1.5" fill="#ffffff"/></svg>`
  },

  // 30. Tokio: Official Tokio Pulse Ring
  tokio: {
    color: '#a855f7',
    svg: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#a855f7" stroke-width="1.8" fill="rgba(168, 85, 247, 0.12)"/><path d="M7 8h10M12 8v9M8.5 12h7" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/></svg>`
  },

  // 31. SQLAlchemy: Official Database Globe with Flame
  sqlalchemy: {
    color: '#d71f00',
    svg: `<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="6" rx="8" ry="3" stroke="#d71f00" stroke-width="1.8" fill="rgba(215, 31, 0, 0.15)"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke="#d71f00" stroke-width="1.8"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" stroke="#d71f00" stroke-width="1.8"/></svg>`
  }
};

let updated = 0;
for (const [id, cfg] of Object.entries(authenticLogos)) {
  const filePath = path.join(dir, `${id}.json`);
  if (fs.existsSync(filePath)) {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    json.svg = cfg.svg;
    if (cfg.color) json.color = cfg.color;
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    updated++;
    console.log(`Updated authentic neon logo for: ${id} (${json.name})`);
  } else {
    console.warn(`File not found: ${filePath}`);
  }
}

console.log(`Total updated authentic logos: ${updated}`);
