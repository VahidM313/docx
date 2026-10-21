import fs from 'fs';

const openglJson = JSON.parse(fs.readFileSync('docs-desktop/sites.d/opengl.json', 'utf8'));
const svg = openglJson.svg;
const dMatch = svg.match(/d="([^"]+)"/);
if (!dMatch) {
  console.log('No d attribute found');
  process.exit(1);
}

const fullD = dMatch[1];
// Paths often start with M or m
// Split by "M" or "m"
const subpaths = fullD.split(/(?=[Mm])/);
console.log('Total subpaths:', subpaths.length);
for (let i = 0; i < subpaths.length; i++) {
  console.log(`Subpath ${i}: length=${subpaths[i].length}, start=${subpaths[i].slice(0, 40)}`);
}
