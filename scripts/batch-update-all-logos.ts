import fs from 'fs';
import path from 'path';

const dir = path.resolve('docs-desktop/sites.d');

// Direct mapping of site IDs to Simple Icons slugs
const siteToSiSlug: Record<string, { slug: string; color?: string }> = {
  // AI & ML
  tensorflow: { slug: 'tensorflow', color: '#ff6f00' },
  keras: { slug: 'keras', color: '#d00000' },
  pytorch: { slug: 'pytorch', color: '#ee4c2c' },
  huggingface: { slug: 'huggingface', color: '#ffd21e' },
  ollama: { slug: 'ollama', color: '#ffffff' },
  opencv: { slug: 'opencv', color: '#5c3ee8' },
  pandas: { slug: 'pandas', color: '#150458' },
  numpy: { slug: 'numpy', color: '#013243' },
  scikit_learn: { slug: 'scikitlearn', color: '#f7931e' },
  qdrant: { slug: 'qdrant', color: '#dc2626' },
  celery: { slug: 'celery', color: '#37814a' },
  pydantic: { slug: 'pydantic', color: '#e92063' },

  // Graphics & Game APIs
  vulkan: { slug: 'vulkan', color: '#bd002c' },
  webgpu: { slug: 'webgpu', color: '#005a9c' },
  raylib: { slug: 'raylib', color: '#ffffff' },
  threejs: { slug: 'threedotjs', color: '#ffffff' },
  sfml: { slug: 'sfml', color: '#8ec342' },
  cuda: { slug: 'nvidia', color: '#76b900' },

  // GUI Frameworks
  qt: { slug: 'qt', color: '#41cd52' },

  // Languages & Compilers
  python: { slug: 'python', color: '#38bdf8' },
  rust: { slug: 'rust', color: '#f97316' },
  go: { slug: 'go', color: '#00add8' },
  typescript: { slug: 'typescript', color: '#3178c6' },
  kotlin: { slug: 'kotlin', color: '#7f52ff' },
  csharp: { slug: 'csharp', color: '#9333ea' },
  julia: { slug: 'julia', color: '#9558b2' },
  odin: { slug: 'odin', color: '#1c698c' },
  zig: { slug: 'zig', color: '#f7a41d' },
  lua: { slug: 'lua', color: '#000080' },
  llvm: { slug: 'llvm', color: '#f97316' },
  bun: { slug: 'bun', color: '#fbf0df' },
  nodejs: { slug: 'nodedotjs', color: '#5fa04e' },
  clap: { slug: 'rust', color: '#d97706' },
  serde: { slug: 'rust', color: '#f97316' },

  // Frontend & UI
  react: { slug: 'react', color: '#61dafb' },
  vue: { slug: 'vuedotjs', color: '#42b883' },
  svelte: { slug: 'svelte', color: '#ff3e00' },
  angular: { slug: 'angular', color: '#dd0031' },
  astro: { slug: 'astro', color: '#bc52ee' },
  tailwind: { slug: 'tailwindcss', color: '#06b6d4' },
  nextjs: { slug: 'nextdotjs', color: '#ffffff' },
  nuxt: { slug: 'nuxtdotjs', color: '#00dc82' },
  solidjs: { slug: 'solid', color: '#2c4f7c' },
  playwright: { slug: 'playwright', color: '#2eadd2' },
  base_ui: { slug: 'baseui', color: '#007fff' },
  shadcn: { slug: 'shadcnui', color: '#ffffff' },
  radix_ui: { slug: 'radixui', color: '#ffffff' },
  lucide: { slug: 'lucide', color: '#f56565' },
  pinia: { slug: 'vuedotjs', color: '#ffd859' },
  vue_router: { slug: 'vuedotjs', color: '#42b883' },
  vueuse: { slug: 'vuedotjs', color: '#41b883' },
  react_hook_form: { slug: 'reacthookform', color: '#ec5990' },
  motion: { slug: 'framer', color: '#0055ff' },
  htmx: { slug: 'htmx', color: '#3366cc' },
  material_design: { slug: 'materialdesign', color: '#757575' },

  // TanStack
  tanstack_query: { slug: 'reactquery', color: '#ef4444' },
  tanstack_router: { slug: 'reactrouter', color: '#10b981' },
  tanstack_table: { slug: 'reacttable', color: '#3b82f6' },

  // Backend & Cloud
  docker: { slug: 'docker', color: '#2496ed' },
  kubernetes: { slug: 'kubernetes', color: '#326ce5' },
  nginx: { slug: 'nginx', color: '#009639' },
  caddy: { slug: 'caddy', color: '#22b640' },
  ansible: { slug: 'ansible', color: '#ee0000' },
  opentofu: { slug: 'opentofu', color: '#ffda1a' },
  fastapi: { slug: 'fastapi', color: '#009688' },
  express: { slug: 'express', color: '#ffffff' },
  flask: { slug: 'flask', color: '#ffffff' },
  django: { slug: 'django', color: '#092e20' },
  nestjs: { slug: 'nestjs', color: '#e0234e' },
  hono: { slug: 'hono', color: '#ff5c13' },
  redis: { slug: 'redis', color: '#dc382d' },
  postgresql: { slug: 'postgresql', color: '#4169e1' },
  mysql: { slug: 'mysql', color: '#4479a1' },
  mariadb: { slug: 'mariadb', color: '#003545' },
  sqlite: { slug: 'sqlite', color: '#003b57' },
  mongodb: { slug: 'mongodb', color: '#47a248' },
  duckdb: { slug: 'duckdb', color: '#fff000' },
  prisma: { slug: 'prisma', color: '#2d3748' },
  drizzle: { slug: 'drizzle', color: '#c5f74f' },
  git: { slug: 'git', color: '#f05032' },
  cmake: { slug: 'cmake', color: '#064f8c' },
  vite: { slug: 'vite', color: '#646cff' },
  zod: { slug: 'zod', color: '#3e67b1' },
  curl: { slug: 'curl', color: '#38bdf8' }
};

async function batchUpdate() {
  console.log(`Starting batch update for ${Object.keys(siteToSiSlug).length} sites...`);
  let successCount = 0;

  for (const [siteId, meta] of Object.entries(siteToSiSlug)) {
    const filePath = path.join(dir, `${siteId}.json`);
    if (!fs.existsSync(filePath)) continue;

    // Skip sites that already have special multi-colored hand-crafted SVGs (like Java, MATLAB, OpenGL)
    if (['java', 'matlab', 'opengl'].includes(siteId)) {
      console.log(`Keeping dedicated crafted vector for ${siteId}`);
      continue;
    }

    try {
      const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${meta.slug}.svg`);
      if (!res.ok) {
        console.warn(`Could not fetch SI for ${siteId} (${meta.slug}): ${res.status}`);
        continue;
      }
      const rawSvg = await res.text();
      const pathMatch = rawSvg.match(/<path\s+d="([^"]+)"/i);
      if (!pathMatch) {
        console.warn(`No path in SVG for ${siteId}`);
        continue;
      }

      const d = pathMatch[1];
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const color = meta.color || json.color || '#38bdf8';

      // Clean neon styling with path
      json.svg = `<svg viewBox="0 0 24 24" fill="none"><path d="${d}" fill="${color}"/></svg>`;
      if (meta.color) json.color = meta.color;

      fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
      successCount++;
      console.log(`[OK] Updated ${siteId} with official ${meta.slug} mark`);
    } catch (e) {
      console.error(`Error updating ${siteId}:`, e);
    }
  }

  console.log(`\nSuccessfully batch updated ${successCount} sites with official Simple Icons brand marks!`);
}

batchUpdate();
