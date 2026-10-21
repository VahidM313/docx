import fs from 'fs';
import path from 'path';

// Mapping from docx site ID to Simple Icons slug or Devicon or custom SVG
const iconMapping: Record<string, { type: 'si' | 'devicon' | 'custom'; name?: string; color?: string; svg?: string }> = {
  // Languages & Core
  java: { type: 'devicon', name: 'java/java-original', color: '#ea580c' },
  matlab: { type: 'devicon', name: 'matlab/matlab-original', color: '#e16024' },
  python: { type: 'si', name: 'python', color: '#38bdf8' },
  rust: { type: 'si', name: 'rust', color: '#f97316' },
  go: { type: 'si', name: 'go', color: '#00add8' },
  typescript: { type: 'si', name: 'typescript', color: '#3178c6' },
  kotlin: { type: 'si', name: 'kotlin', color: '#7f52ff' },
  csharp: { type: 'si', name: 'csharp', color: '#9333ea' },
  julia: { type: 'si', name: 'julia', color: '#9558b2' },
  odin: { type: 'si', name: 'odin', color: '#1c698c' },
  zig: { type: 'si', name: 'zig', color: '#f7a41d' },
  lua: { type: 'si', name: 'lua', color: '#000080' },
  llvm: { type: 'si', name: 'llvm', color: '#f97316' },
  bun: { type: 'si', name: 'bun', color: '#fbf0df' },
  nodejs: { type: 'si', name: 'nodedotjs', color: '#5fa04e' },

  // Graphics & Game APIs
  opengl: { type: 'devicon', name: 'opengl/opengl-original', color: '#5586a4' },
  vulkan: { type: 'si', name: 'vulkan', color: '#bd002c' },
  webgpu: { type: 'si', name: 'webgpu', color: '#005a9c' },
  raylib: { type: 'si', name: 'raylib', color: '#ffffff' },
  threejs: { type: 'si', name: 'threedotjs', color: '#ffffff' },
  sfml: { type: 'si', name: 'sfml', color: '#8ec342' },
  sdl: { type: 'devicon', name: 'sdl/sdl-original', color: '#1778b5' },
  cuda: { type: 'si', name: 'nvidia', color: '#76b900' },

  // GUI Frameworks
  qt: { type: 'si', name: 'qt', color: '#41cd52' },

  // AI & ML
  tensorflow: { type: 'si', name: 'tensorflow', color: '#ff6f00' },
  keras: { type: 'si', name: 'keras', color: '#d00000' },
  pytorch: { type: 'si', name: 'pytorch', color: '#ee4c2c' },
  huggingface: { type: 'si', name: 'huggingface', color: '#ffd21e' },
  ollama: { type: 'si', name: 'ollama', color: '#ffffff' },
  opencv: { type: 'si', name: 'opencv', color: '#5c3ee8' },
  pandas: { type: 'si', name: 'pandas', color: '#150458' },
  numpy: { type: 'si', name: 'numpy', color: '#013243' },
  scikit_learn: { type: 'si', name: 'scikitlearn', color: '#f7931e' },
  qdrant: { type: 'si', name: 'qdrant', color: '#dc2626' },

  // Frontend & UI
  react: { type: 'si', name: 'react', color: '#61dafb' },
  vue: { type: 'si', name: 'vuedotjs', color: '#42b883' },
  svelte: { type: 'si', name: 'svelte', color: '#ff3e00' },
  angular: { type: 'si', name: 'angular', color: '#dd0031' },
  astro: { type: 'si', name: 'astro', color: '#bc52ee' },
  tailwind: { type: 'si', name: 'tailwindcss', color: '#06b6d4' },
  nextjs: { type: 'si', name: 'nextdotjs', color: '#ffffff' },
  nuxt: { type: 'si', name: 'nuxtdotjs', color: '#00dc82' },
  solidjs: { type: 'si', name: 'solid', color: '#2c4f7c' },
  playwright: { type: 'si', name: 'playwright', color: '#2eadd2' },
  base_ui: { type: 'si', name: 'baseui', color: '#007fff' },
  shadcn: { type: 'si', name: 'shadcnui', color: '#ffffff' },
  radix_ui: { type: 'si', name: 'radixui', color: '#161618' },
  lucide: { type: 'si', name: 'lucide', color: '#f56565' },

  // Backend & Cloud
  docker: { type: 'si', name: 'docker', color: '#2496ed' },
  kubernetes: { type: 'si', name: 'kubernetes', color: '#326ce5' },
  nginx: { type: 'si', name: 'nginx', color: '#009639' },
  caddy: { type: 'si', name: 'caddy', color: '#22b640' },
  ansible: { type: 'si', name: 'ansible', color: '#ee0000' },
  opentofu: { type: 'si', name: 'opentofu', color: '#ffda1a' },
  fastapi: { type: 'si', name: 'fastapi', color: '#009688' },
  express: { type: 'si', name: 'express', color: '#ffffff' },
  flask: { type: 'si', name: 'flask', color: '#ffffff' },
  django: { type: 'si', name: 'django', color: '#092e20' },
  nestjs: { type: 'si', name: 'nestjs', color: '#e0234e' },
  redis: { type: 'si', name: 'redis', color: '#dc382d' },
  postgresql: { type: 'si', name: 'postgresql', color: '#4169e1' },
  mysql: { type: 'si', name: 'mysql', color: '#4479a1' },
  mariadb: { type: 'si', name: 'mariadb', color: '#003545' },
  sqlite: { type: 'si', name: 'sqlite', color: '#003b57' },
  mongodb: { type: 'si', name: 'mongodb', color: '#47a248' },
  duckdb: { type: 'si', name: 'duckdb', color: '#fff000' },
  prisma: { type: 'si', name: 'prisma', color: '#2d3748' },
  drizzle: { type: 'si', name: 'drizzle', color: '#c5f74f' },
  git: { type: 'si', name: 'git', color: '#f05032' },
  cmake: { type: 'si', name: 'cmake', color: '#064f8c' },
  vite: { type: 'si', name: 'vite', color: '#646cff' },
  zod: { type: 'si', name: 'zod', color: '#3e67b1' }
};

console.log('Configured', Object.keys(iconMapping).length, 'key site mappings');
