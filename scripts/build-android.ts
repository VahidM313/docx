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
const DESKTOP_APK = "C:/Users/vahid/OneDrive/Desktop/Docx.apk";

const t0 = performance.now();

// 1. Prepare environment variables
const androidHome = process.env.ANDROID_HOME || "D:\\Android\\SDK";
const ndkHome = process.env.NDK_HOME || path.join(androidHome, "ndk", "30.0.16248370");
const javaHome = process.env.JAVA_HOME || "C:\\Program Files\\Microsoft\\jdk-21.0.12.101-hotspot";
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
