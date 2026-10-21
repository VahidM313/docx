import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = path.resolve(import.meta.dir, "..");
const DESKTOP_DIR = path.join(ROOT, "docs-desktop");
const DIST_INDEX = path.join(DESKTOP_DIR, "dist", "index.html");
const TAURI_MANIFEST = path.join(DESKTOP_DIR, "src-tauri", "Cargo.toml");
const RELEASE_EXE = path.join(DESKTOP_DIR, "src-tauri", "target", "release", "app.exe");
/** Real Desktop folder (handles OneDrive folder redirection without hardcoding it). */
function getDesktopDir(): string {
  try {
    const r = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "[Environment]::GetFolderPath('Desktop')"],
      { encoding: "utf8" },
    );
    const p = r.stdout?.trim();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  return path.join(process.env.USERPROFILE ?? "C:/Users/Public", "Desktop");
}
const DESKTOP_OUT_EXE = path.join(getDesktopDir(), "Docx.exe");

function getNewestMtimeMs(dirOrFile: string): number {
  if (!fs.existsSync(dirOrFile)) return 0;
  const stat = fs.statSync(dirOrFile);
  if (stat.isFile()) return stat.mtimeMs;
  let max = stat.mtimeMs;
  for (const entry of fs.readdirSync(dirOrFile, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "target") continue;
    const m = getNewestMtimeMs(path.join(dirOrFile, entry.name));
    if (m > max) max = m;
  }
  return max;
}

const t0 = performance.now();

// 1. Only run `bun install` if node_modules/vite is missing
const viteBin = path.join(DESKTOP_DIR, "node_modules", ".bin", "vite");
if (!fs.existsSync(viteBin) && !fs.existsSync(`${viteBin}.cmd`) && !fs.existsSync(`${viteBin}.exe`)) {
  console.log("📦 Installing frontend dependencies...");
  const inst = spawnSync("bun", ["install"], { cwd: DESKTOP_DIR, stdio: "inherit", shell: true });
  if (inst.status !== 0) process.exit(inst.status ?? 1);
}

// 2. Only run `vite build` if frontend sources changed since last dist/ build (prevents unnecessary Rust proc-macro re-embedding!)
const distMtime = fs.existsSync(DIST_INDEX) ? fs.statSync(DIST_INDEX).mtimeMs : 0;
const srcNewest = Math.max(
  getNewestMtimeMs(path.join(DESKTOP_DIR, "src")),
  getNewestMtimeMs(path.join(DESKTOP_DIR, "index.html")),
  getNewestMtimeMs(path.join(DESKTOP_DIR, "public"))
);

if (distMtime === 0 || srcNewest > distMtime || process.argv.includes("--force-fe")) {
  console.log("⚡ Building Vite frontend...");
  const fe = spawnSync("bun", ["run", "build"], { cwd: DESKTOP_DIR, stdio: "inherit", shell: true });
  if (fe.status !== 0) process.exit(fe.status ?? 1);
} else {
  console.log("✓ Frontend dist/ is up to date (skipping Vite rebuild to preserve Rust incremental cache)");
}

// 3. Compile Rust binary directly with cargo (skipping slow NSIS/MSI tauri bundler)
console.log("🦀 Compiling Rust release binary...");
const cargo = spawnSync(
  "cargo",
  ["build", "--release", "--manifest-path", TAURI_MANIFEST],
  { cwd: DESKTOP_DIR, stdio: "inherit" }
);
if (cargo.status !== 0) process.exit(cargo.status ?? 1);

// 4. Terminate any running Docx.exe instance so it never locks EBWebView or the output executable
spawnSync("taskkill", ["/F", "/IM", "Docx.exe"], { stdio: "ignore" });
spawnSync("taskkill", ["/F", "/IM", "app.exe"], { stdio: "ignore" });

// 5. Preserve any existing DOCXPACK trailer on Desktop\Docx.exe and write updated binary to Desktop
const coreBytes = fs.readFileSync(RELEASE_EXE);
let trailerAndFooter = Buffer.alloc(0);

if (fs.existsSync(DESKTOP_OUT_EXE)) {
  try {
    const prevBytes = fs.readFileSync(DESKTOP_OUT_EXE);
    if (prevBytes.length >= 20 && prevBytes.subarray(prevBytes.length - 8).toString("ascii") === "DOCXPACK") {
      const tLen = Number(prevBytes.readBigUInt64LE(prevBytes.length - 16));
      if (prevBytes.length >= 16 + tLen) {
        trailerAndFooter = prevBytes.subarray(prevBytes.length - 16 - tLen);
      }
    }
  } catch {}
}

const finalBytes = trailerAndFooter.length > 0 ? Buffer.concat([coreBytes, trailerAndFooter]) : coreBytes;

const desktopDirs = [
  getDesktopDir(),
  path.join(process.env.USERPROFILE ?? "", "Desktop"),
  path.join(process.env.USERPROFILE ?? "", "OneDrive", "Desktop"),
].filter((d) => fs.existsSync(d));

for (const dir of new Set(desktopDirs)) {
  try {
    fs.writeFileSync(path.join(dir, "Docx.exe"), finalBytes);
  } catch {}
}

const ROOT_OUT_EXE = path.join(ROOT, "Docx.exe");
try { fs.writeFileSync(ROOT_OUT_EXE, finalBytes); } catch {}

const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2);
console.log(
  `✅ Built & deployed to:\n   - ${DESKTOP_OUT_EXE}\n   - ${ROOT_OUT_EXE}\n   (${(finalBytes.length / (1024 * 1024)).toFixed(2)} MB in ${elapsedSec}s!)`
);
