import fs from "fs";
import path from "path";

interface SearchEntry {
  id: string;
  site: "tailwind" | "shadcn";
  siteName: "Tailwind CSS" | "shadcn/ui";
  title: string;
  category: string;
  description: string;
  path: string;
  url: string;
  keywords: string[];
}

// Source workspace checkout — required; point it at the checked-out crawl workspace.
const CRAWL_ROOT = process.env.CRAWL_ROOT ?? "";
if (!CRAWL_ROOT) {
  console.error("✗ CRAWL_ROOT is not set. Point it at the workspace containing tailwindcss-site/ and shadcn-site/.");
  process.exit(1);
}
const tailwindDocsDir = path.join(CRAWL_ROOT, "tailwindcss-site", "src", "docs");
const shadcnDocsDir = path.join(CRAWL_ROOT, "shadcn-site", "apps", "v4", "content", "docs");

const searchIndex: SearchEntry[] = [];

// 1. Index Tailwind CSS Docs
if (fs.existsSync(tailwindDocsDir)) {
  const files = fs.readdirSync(tailwindDocsDir).filter(f => f.endsWith(".mdx"));
  
  for (const file of files) {
    const filePath = path.join(tailwindDocsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const slug = file.replace(/\.mdx$/, "");

    let title = slug.replace(/-/g, " ");
    let description = "";

    const titleMatch = content.match(/export const title\s*=\s*["'`](.*?)["'`]/);
    if (titleMatch) title = titleMatch[1];

    const descMatch = content.match(/export const description\s*=\s*["'`](.*?)["'`]/);
    if (descMatch) description = descMatch[1];

    // Find headings
    const headings: string[] = [];
    const headingMatches = content.matchAll(/^#{2,4}\s+(.*)$/gm);
    for (const m of headingMatches) {
      headings.push(m[1].trim());
    }

    // Find utility classes or keywords from api table rows
    const utilityKeywords: string[] = [];
    const tableRows = content.match(/rows\s*=\s*\{\[\s*([\s\S]*?)\]\}/);
    if (tableRows) {
      const rowMatches = tableRows[1].matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g);
      for (const rm of rowMatches) {
        utilityKeywords.push(rm[1], rm[2]);
      }
    }

    // Determine category based on slug / topics
    let category = "Utilities";
    if (["upgrade-guide", "functions-and-directives", "theme", "responsive-design", "hover-focus-and-other-states", "styling-with-utility-classes", "compatibility"].includes(slug)) {
      category = "Core Concepts";
    } else if (slug.includes("installation") || slug.includes("using-")) {
      category = "Installation";
    } else if (["flex", "grid", "gap", "justify-content", "align-items", "order"].some(k => slug.includes(k))) {
      category = "Flexbox & Grid";
    } else if (["padding", "margin", "space-between"].some(k => slug.includes(k))) {
      category = "Spacing";
    } else if (["width", "height", "size"].some(k => slug.includes(k))) {
      category = "Sizing";
    } else if (["font-", "text-", "line-", "letter-"].some(k => slug.includes(k))) {
      category = "Typography";
    } else if (["bg-", "background"].some(k => slug.includes(k))) {
      category = "Backgrounds";
    } else if (["border", "divide", "ring", "outline"].some(k => slug.includes(k))) {
      category = "Borders";
    } else if (["shadow", "opacity", "mix-blend"].some(k => slug.includes(k))) {
      category = "Effects";
    } else if (["transition", "animation", "animate"].some(k => slug.includes(k))) {
      category = "Transitions & Animation";
    } else if (["scale", "rotate", "translate", "skew", "transform"].some(k => slug.includes(k))) {
      category = "Transforms";
    }

    searchIndex.push({
      id: `tw:${slug}`,
      site: "tailwind",
      siteName: "Tailwind CSS",
      title: title.charAt(0).toUpperCase() + title.slice(1),
      category,
      description,
      path: `/docs/${slug}`,
      url: `http://localhost:3001/docs/${slug}`,
      keywords: Array.from(new Set([slug, ...headings, ...utilityKeywords])).slice(0, 30)
    });
  }
}

// 2. Index shadcn/ui Docs
function indexShadcnDir(dir: string, baseRelative = "") {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const rel = path.join(baseRelative, entry.name).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      indexShadcnDir(fullPath, rel);
    } else if (entry.name.endsWith(".mdx") && entry.name !== "meta.json") {
      const content = fs.readFileSync(fullPath, "utf-8");
      const slug = entry.name.replace(/\.mdx$/, "");

      // Parse YAML frontmatter
      let title = slug.replace(/-/g, " ");
      let description = "";
      let category = "General";

      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (frontmatterMatch) {
        const fm = frontmatterMatch[1];
        const tMatch = fm.match(/^title:\s*(.*)$/m);
        if (tMatch) title = tMatch[1].trim().replace(/^["']|["']$/g, "");
        const dMatch = fm.match(/^description:\s*(.*)$/m);
        if (dMatch) description = dMatch[1].trim().replace(/^["']|["']$/g, "");
      }

      // Heading matches
      const headings: string[] = [];
      const headingMatches = content.matchAll(/^#{2,4}\s+(.*)$/gm);
      for (const m of headingMatches) {
        headings.push(m[1].trim());
      }

      // Determine category and route
      let cleanRel = rel.replace(/\.mdx$/, "").replace(/\(root\)\//, "");
      let docPath = `/docs/${cleanRel}`;
      if (rel.startsWith("components/radix/")) {
        category = "Components (Radix)";
        docPath = `/docs/components/${slug}`;
      } else if (rel.startsWith("components/base/")) {
        category = "Components (Base UI)";
        docPath = `/docs/components/${slug}`;
      } else if (rel.startsWith("components/aria/")) {
        category = "Components (React Aria)";
        docPath = `/docs/components/${slug}`;
      } else if (rel.startsWith("installation/")) {
        category = "Installation";
        docPath = `/docs/installation/${slug}`;
      } else if (rel.startsWith("dark-mode/")) {
        category = "Dark Mode";
        docPath = `/docs/dark-mode/${slug}`;
      } else if (rel.startsWith("forms/")) {
        category = "Forms";
        docPath = `/docs/forms/${slug}`;
      } else if (rel.startsWith("registry/")) {
        category = "Registry";
        docPath = `/docs/registry/${slug}`;
      } else if (rel.startsWith("utils/")) {
        category = "Utilities";
        docPath = `/docs/utils/${slug}`;
      } else if (rel.startsWith("changelog/")) {
        category = "Changelog";
        docPath = `/docs/changelog/${slug}`;
      } else if (slug === "index") {
        docPath = "/docs";
        category = "Getting Started";
      }

      searchIndex.push({
        id: `shadcn:${rel.replace(/\.mdx$/, "")}`,
        site: "shadcn",
        siteName: "shadcn/ui",
        title: title.charAt(0).toUpperCase() + title.slice(1),
        category,
        description,
        path: docPath,
        url: `http://localhost:4000${docPath}`,
        keywords: Array.from(new Set([slug, title.toLowerCase(), ...headings])).slice(0, 20)
      });
    }
  }
}

indexShadcnDir(shadcnDocsDir);

const outputPath = path.join(CRAWL_ROOT, "search-index.json");
fs.writeFileSync(outputPath, JSON.stringify(searchIndex, null, 2), "utf-8");
console.log(`Generated search index with ${searchIndex.length} items to ${outputPath}`);
