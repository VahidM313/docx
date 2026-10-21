import fs from 'fs';

const openglJson = JSON.parse(fs.readFileSync('docs-desktop/sites.d/opengl.json', 'utf8'));
const fullD = openglJson.svg.match(/d="([^"]+)"/)[1];
const subpaths = fullD.split(/(?=[Mm])/);

// Subpath 0 is the sweeping ribbon
const ribbonD = subpaths[0];
// Subpaths 1 through 8 are the OpenGL lettering
const lettersD = subpaths.slice(1, 9).join('');
// Subpaths 9 to 12 are the trademark symbol
const tmD = subpaths.slice(9).join('');

const newSvg = `<svg viewBox="0 0 24 24" fill="none"><path d="${ribbonD}" fill="#ef4444"/><path d="${lettersD}" fill="#38bdf8"/><path d="${tmD}" fill="#94a3b8"/></svg>`;

console.log('Generated two-color neon OpenGL SVG:');
console.log(newSvg);
fs.writeFileSync('temp_test_opengl.svg', newSvg);
