import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = path.resolve(import.meta.dir, "..");
const DESKTOP_DIR = path.join(ROOT, "docs-desktop");
const APK_OUT_SRC = path.join(
  DESKTOP_DIR,
  "src-tauri",
  "gen",
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "universal",
  "release",
  "app-universal-release.apk"
);
const ROOT_APK_ARM = path.join(ROOT, "Docx-arm64-v8a-release.apk");
const ROOT_APK = path.join(ROOT, "Docx.apk");
const DESKTOP_APK = desktopOutDir("Docx.apk");

/** Real Desktop folder (handles OneDrive folder redirection without hardcoding it). */
function desktopOutDir(...p: string[]): string {
  try {
    const r = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "[Environment]::GetFolderPath('Desktop')"],
      { encoding: "utf8" },
    );
    const out = r.stdout?.trim();
    if (out && fs.existsSync(out)) return path.join(out, ...p);
  } catch {}
  return path.join(process.env.USERPROFILE ?? "C:/Users/Public", "Desktop", ...p);
}

const t0 = performance.now();

// 1. Prepare environment variables
// All tool paths are overridable via env. Defaults match standard Android Studio installs.
const androidHome =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const ndkVersionsDir = path.join(androidHome, "ndk");
if (!fs.existsSync(ndkVersionsDir)) {
  console.error(`✗ Android SDK/NDK not found at ${androidHome}`);
  console.error("  Install Android Studio (or set ANDROID_HOME to your SDK path) and retry.");
  process.exit(1);
}
const ndkHome =
  process.env.NDK_HOME || path.join(ndkVersionsDir, fs.readdirSync(ndkVersionsDir).sort().pop() ?? "");

// Locate a JDK: JAVA_HOME first, then standard install roots (no personal paths).
let javaHome = process.env.JAVA_HOME || "";
if (!javaHome) {
  const jdkRoots = ["C:\\Program Files\\Java", "C:\\Program Files\\Eclipse Adoptium", "C:\\Program Files\\Microsoft"]
    .filter((d) => fs.existsSync(d));
  for (const root of jdkRoots) {
    const candidates = fs
      .readdirSync(root)
      .filter((d) => /jdk/i.test(d))
      .sort()
      .reverse();
    if (candidates.length) {
      javaHome = path.join(root, candidates[0]);
      break;
    }
  }
}
if (!javaHome) {
  console.error("✗ No JDK found. Install Java 17+ (or set JAVA_HOME) and retry.");
  process.exit(1);
}
const llvmBin = path.join(ndkHome, "toolchains", "llvm", "prebuilt", "windows-x86_64", "bin");
const platformTools = path.join(androidHome, "platform-tools");
const cmdlineTools = path.join(androidHome, "cmdline-tools", "latest", "bin");

const env = {
  ...process.env,
  ANDROID_HOME: androidHome,
  NDK_HOME: ndkHome,
  JAVA_HOME: javaHome,
  Path: `${path.join(javaHome, "bin")};${llvmBin};${platformTools};${cmdlineTools};${process.env.Path || ""}`,
};

console.log("📱 Building Android ARMv8 (aarch64) Release APK...");

// 2. Build frontend if needed
const fe = spawnSync("bun", ["run", "build"], { cwd: DESKTOP_DIR, stdio: "inherit", shell: true, env });
if (fe.status !== 0) {
  console.error("❌ Frontend build failed");
  process.exit(fe.status ?? 1);
}

// 3. Build Android release APK
const build = spawnSync("bun", ["run", "tauri", "android", "build", "-t", "aarch64", "--apk", "--ci"], {
  cwd: DESKTOP_DIR,
  stdio: "inherit",
  shell: true,
  env,
});

if (build.status !== 0) {
  console.error("❌ Android build failed");
  process.exit(build.status ?? 1);
}

if (!fs.existsSync(APK_OUT_SRC)) {
  console.error(`❌ Expected APK not found at ${APK_OUT_SRC}`);
  process.exit(1);
}

// 4. Deploy APK to repository root and Desktop
const apkBytes = fs.readFileSync(APK_OUT_SRC);
fs.writeFileSync(ROOT_APK_ARM, apkBytes);
fs.writeFileSync(ROOT_APK, apkBytes);
try {
  if (fs.existsSync(path.dirname(DESKTOP_APK))) {
    fs.writeFileSync(DESKTOP_APK, apkBytes);
  }
} catch {}

const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2);
const sizeMB = (apkBytes.length / (1024 * 1024)).toFixed(2);
console.log(`✅ Android ARMv8 Release APK built & deployed:`);
console.log(`   - ${ROOT_APK_ARM} (${sizeMB} MB)`);
console.log(`   - ${ROOT_APK}`);
console.log(`   - Completed in ${elapsedSec}s!`);
