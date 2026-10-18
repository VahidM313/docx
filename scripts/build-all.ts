import path from "path";
import { spawnSync } from "child_process";

const ROOT = path.resolve(import.meta.dir, "..");
const t0 = performance.now();

console.log("==================================================");
console.log("🚀 DOCX UNIFIED BUILD: Windows Desktop + Android");
console.log("==================================================");

console.log("\n[1/2] Building Windows Desktop App...");
const desktop = spawnSync("bun", ["run", "scripts/build-desktop.ts"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});
if (desktop.status !== 0) {
  console.error("❌ Desktop build failed");
  process.exit(desktop.status ?? 1);
}

console.log("\n[2/2] Building Android App...");
const android = spawnSync("bun", ["run", "scripts/build-android.ts"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});
if (android.status !== 0) {
  console.error("❌ Android build failed");
  process.exit(android.status ?? 1);
}

const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2);
console.log("\n==================================================");
console.log(`🎉 ALL BUILDS SUCCEEDED in ${elapsedSec}s!`);
console.log("   - Windows Desktop: Docx.exe");
console.log("   - Android ARMv8:   Docx-arm64-v8a-release.apk (Docx.apk)");
console.log("==================================================");
