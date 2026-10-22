import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

async function run() {
  console.log("=== Starting Playwright End-to-End Persian Translation Verification ===");

  // 1. Read the injected reader bridge HTML
  const bridgeHtmlPath = path.resolve(__dirname, "src-tauri/src/bridge/reader-bridge.html");
  const bridgeScript = fs.readFileSync(bridgeHtmlPath, "utf-8");

  // 2. Create test doc pages:
  // a) Standard English page (without built-in Persian)
  const testPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>React Hooks Documentation</title>
  <style>
    body { font-family: sans-serif; padding: 24px; }
    .docx-fa-block { direction: rtl; text-align: right; }
  </style>
</head>
<body>
  <div id="content">
    <h1 id="title">Getting Started</h1>
    <p id="p1">Hooks let you use state and other React features without writing a class. For example, <code>useState</code> is a Hook.</p>
    <p id="p2">Read the <a href="/docs/intro" id="link1">Introduction Guide</a> to learn more about components.</p>
    <pre><code class="language-jsx">const [count, setCount] = useState(0);</code></pre>
  </div>
  ${bridgeScript}
</body>
</html>`;

  // b) Page with built-in native Persian translation link
  const nativePersianOriginHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FastAPI Tutorial</title>
  <link rel="alternate" hreflang="fa" href="/doc-native-fa.html" />
</head>
<body>
  <h1 id="native-title">FastAPI Introduction</h1>
  <p>Learn how to build high performance APIs.</p>
  ${bridgeScript}
</body>
</html>`;

  const nativePersianPageHtml = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>آموزش سریع فست‌ای‌پی‌آی</title>
</head>
<body>
  <h1 id="native-title">معرفی فست‌ای‌پی‌آی</h1>
  <p>آموزش ساخت وب‌سرویس‌های سریع و امن.</p>
  ${bridgeScript}
</body>
</html>`;

  // 3. Parent container mock page
  const parentContainerHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Docx Parent Host</title>
</head>
<body>
  <div id="status-container">
    <span id="active-fa">false</span>
  </div>
  <iframe id="doc-frame" src="/doc.html" width="800" height="600"></iframe>

  <script>
    const frame = document.getElementById('doc-frame');
    window.translationRequestsCount = 0;

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'DOCX_REQUEST_TRANSLATION') {
        window.translationRequestsCount++;
        const items = e.data.items || [];
        const dict = {
          "Getting Started": "شروع به کار",
          "Hooks let you use state and other React features without writing a class. For example, ⟦CODE_0⟧ is a Hook.": "قلاب‌ها به شما اجازه می‌دهند بدون نوشتن کلاس از وضعیت و سایر امکانات ری‌اکت استفاده کنید. برای مثال، ⟦CODE_0⟧ یک هوک است.",
          "Read the ⟦LINK_0⟧ to learn more about components.": "راهنمای ⟦LINK_0⟧ را بخوانید تا درباره مؤلفه‌ها بیشتر بدانید."
        };

        const results = {};
        items.forEach((item) => {
          results[item.id] = {
            translated: dict[item.text] || ("ترجمه شده: " + item.text),
            hash: item.hash
          };
        });

        frame.contentWindow.postMessage({
          type: 'DOCX_TRANSLATIONS_READY',
          translations: results
        }, '*');
      }
    });

    window.triggerTranslate = () => {
      frame.contentWindow.postMessage({ type: 'DOCX_TRANSLATE_FA' }, '*');
    };

    window.triggerRestore = () => {
      frame.contentWindow.postMessage({ type: 'DOCX_RESTORE_EN' }, '*');
    };
  </script>
</body>
</html>`;

  // 4. Start ephemeral test server
  const server = http.createServer((req, res) => {
    if (req.url === "/doc.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(testPageHtml);
    } else if (req.url === "/doc-with-native.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(nativePersianOriginHtml);
    } else if (req.url === "/doc-native-fa.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(nativePersianPageHtml);
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(parentContainerHtml);
    }
  });

  await new Promise<void>((resolve) => server.listen(49999, resolve));

  // 5. Launch Playwright
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // --- Test 1: TWP in-place translation for site without built-in Persian ---
    console.log("TEST 1: In-place translation for site without native Persian...");
    await page.goto("http://localhost:49999", { waitUntil: "networkidle" });

    const frameElement = page.frameLocator("#doc-frame");
    const h1TextBefore = await frameElement.locator("#title").textContent();
    if (h1TextBefore?.trim() !== "Getting Started") {
      throw new Error("Failed to load original English title");
    }

    await page.evaluate(() => (window as unknown as { triggerTranslate: () => void }).triggerTranslate());

    await page.waitForTimeout(400);
    const h1TextAfter = await frameElement.locator("#title").textContent();
    console.log("Translated Heading 1:", h1TextAfter);
    if (!h1TextAfter?.includes("شروع به کار")) {
      throw new Error(`Expected 'شروع به کار', got: ${h1TextAfter}`);
    }

    // Verify code block preservation
    const p1Html = await frameElement.locator("#p1").innerHTML();
    if (!p1Html.includes("useState") || !p1Html.includes("docx-fa-inline-code")) {
      throw new Error("Code tag preservation failed");
    }

    // --- Test 2: Native built-in Persian navigation (No plugin used) ---
    console.log("TEST 2: Built-in Persian support detection and navigation...");
    await page.evaluate(() => {
      const frame = document.getElementById("doc-frame") as HTMLIFrameElement;
      frame.src = "/doc-with-native.html";
    });

    await page.waitForTimeout(400);
    const nativeFrame = page.frameLocator("#doc-frame");
    const nativeTitleBefore = await nativeFrame.locator("#native-title").textContent();
    if (nativeTitleBefore?.trim() !== "FastAPI Introduction") {
      throw new Error("Failed to load native doc origin page");
    }

    // Reset translation request counter
    await page.evaluate(() => {
      (window as unknown as { translationRequestsCount: number }).translationRequestsCount = 0;
    });

    // Trigger Persian
    await page.evaluate(() => (window as unknown as { triggerTranslate: () => void }).triggerTranslate());
    await page.waitForTimeout(500);

    // Verify that NO plugin translation request was sent, because it navigated directly to the native Persian page!
    const requestsCount = await page.evaluate(
      () => (window as unknown as { translationRequestsCount: number }).translationRequestsCount
    );
    console.log("Plugin translation requests sent for native Persian site:", requestsCount);
    if (requestsCount !== 0) {
      throw new Error("Plugin should not be called when site has built-in Persian support!");
    }

    const nativeTitleAfter = await nativeFrame.locator("#native-title").textContent();
    console.log("Native Persian Page Title:", nativeTitleAfter);
    if (!nativeTitleAfter?.includes("معرفی فست‌ای‌پی‌آی")) {
      throw new Error("Failed to navigate to built-in native Persian doc");
    }

    console.log("✅ All Playwright E2E checks PASSED (TWP Translation + Builtin Persian Navigation)!");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
