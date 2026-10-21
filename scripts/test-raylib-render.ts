import fs from "fs";
import zlib from "zlib";

function checkPack(packPath: string) {
  if (!fs.existsSync(packPath)) {
    throw new Error(`Pack file not found at ${packPath}`);
  }
  const buf = fs.readFileSync(packPath);
  const magic = buf.subarray(0, 4).toString("ascii");
  if (magic !== "DOCP") {
    throw new Error(`Invalid pack magic: ${magic}`);
  }
  const mLen = buf.readUInt32LE(8);
  const dataStart = 16 + mLen;
  const manifest = JSON.parse(buf.subarray(16, dataStart).toString("utf-8"));
  const route = manifest.routes["/cheatsheet/cheatsheet.html"];
  if (!route) {
    throw new Error("Missing /cheatsheet/cheatsheet.html route in manifest");
  }
  const chunk = buf.subarray(dataStart + route.offset, dataStart + route.offset + route.length);
  const html = route.encoding === "br" ? zlib.brotliDecompressSync(chunk).toString("utf-8") : zlib.gunzipSync(chunk).toString("utf-8");

  // Check if core pre code is empty
  const coreMatch = html.match(/<div id="core"><pre><code class="cpp">([\s\S]*?)<\/code><\/pre><\/div>/);
  if (!coreMatch) {
    throw new Error("Could not find #core code container in HTML");
  }
  const coreCode = coreMatch[1].trim();
  if (coreCode.length === 0) {
    throw new Error("FAIL: Code block #core pre code is empty (0 characters) - user cannot see anything!");
  }
  console.log(`PASS: Code block #core pre code is populated with ${coreCode.length} characters.`);
}

const targetPath = fs.existsSync("C:/Users/vahid/AppData/Local/docx/raylib.docpack")
  ? "C:/Users/vahid/AppData/Local/docx/raylib.docpack"
  : "packs/raylib.docpack";

checkPack(targetPath);
