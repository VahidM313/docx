import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

async function run() {
  console.log("=== Starting Playwright End-to-End Persian Translation Verification ===");

  // 1. Read the injected reader bridge HTML
  const bridgeHtmlPath = path.resolve(__dirname, "src-tauri/src/bridge/reader-bridge.html");
  const bridgeScript = fs.readFileSync(bridgeHtmlPath, "utf-8");

  // 2. Create a test doc page containing sample English content with inline code, links, and pre tags
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

  // 3. Create a parent container mock page that simulates the Docx Desktop reader
  const parentContainerHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Docx Parent Host</title>
</head>
<body>
  <div id="status-container">
    <span id="progress-text">Idle</span>
    <span id="active-fa">false</span>
  </div>
  <iframe id="doc-frame" src="/doc.html" width="800" height="600"></iframe>

  <script>
    const frame = document.getElementById('doc-frame');
    window.eventsLog = [];

    window.addEventListener('message', (e) => {
      window.eventsLog.push(e.data);

      if (e.data && e.data.type === 'DOCX_REQUEST_TRANSLATION') {
        document.getElementById('progress-text').innerText = 'Translating 0%';
        const items = e.data.items || [];

        // Simulate dictionary & streaming progress translation
        const dict = {
          "Getting Started": "شروع به کار",
          "Hooks let you use state and other React features without writing a class. For example, ⟦CODE_0⟧ is a Hook.": "قلاب‌ها به شما اجازه می‌دهند بدون نوشتن کلاس از وضعیت و سایر امکانات ری‌اکت استفاده کنید. برای مثال، ⟦CODE_0⟧ یک هوک است.",
          "Read the ⟦LINK_0⟧ to learn more about components.": "راهنمای ⟦LINK_0⟧ را بخوانید تا درباره مؤلفه‌ها بیشتر بدانید."
        };

        let completed = 0;
        items.forEach((item, idx) => {
          setTimeout(() => {
            completed++;
            const translatedText = dict[item.text] || ("ترجمه شده: " + item.text);
            const chunk = {
              [item.id]: {
                translated: translatedText,
                hash: item.hash
              }
            };

            const pct = Math.round((completed / items.length) * 100);
            document.getElementById('progress-text').innerText = 'Translating ' + pct + '%';

            // Post chunk back to iframe
            frame.contentWindow.postMessage({
              type: 'DOCX_TRANSLATIONS_READY',
              translations: chunk
            }, '*');
          }, (idx + 1) * 60);
        });
      }
    });

    window.triggerTranslate = () => {
      document.getElementById('active-fa').innerText = 'true';
      frame.contentWindow.postMessage({ type: 'DOCX_TRANSLATE_FA' }, '*');
    };

    window.triggerRestore = () => {
      document.getElementById('active-fa').innerText = 'false';
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
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(parentContainerHtml);
    }
  });

  await new Promise<void>((resolve) => server.listen(49999, resolve));
  console.log("Mock documentation server running on http://localhost:49999");

  // 5. Launch Playwright
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("http://localhost:49999", { waitUntil: "networkidle" });

    const frameElement = page.frameLocator("#doc-frame");
    const h1TextBefore = await frameElement.locator("#title").textContent();
    console.log("Original Heading 1:", h1TextBefore);
    if (h1TextBefore?.trim() !== "Getting Started") {
      throw new Error("Failed to load original English title");
    }

    // Trigger Persian translation
    console.log("Triggering Persian translation via DOCX_TRANSLATE_FA...");
    await page.evaluate(() => (window as unknown as { triggerTranslate: () => void }).triggerTranslate());

    // Wait for streaming translation to reach 100%
    await page.waitForFunction(
      () => document.getElementById("progress-text")?.innerText === "Translating 100%",
      { timeout: 8000 }
    );
    console.log("Progress tracker reached 100% successfully!");

    // Verify translated Persian text inside iframe DOM
    const h1TextAfter = await frameElement.locator("#title").textContent();
    console.log("Translated Heading 1:", h1TextAfter);
    if (!h1TextAfter?.includes("شروع به کار")) {
      throw new Error(`Expected 'شروع به کار', got: ${h1TextAfter}`);
    }

    // Verify code block preservation: <code>useState</code> must remain inside <bdi dir="ltr">
    const p1Html = await frameElement.locator("#p1").innerHTML();
    console.log("Translated Paragraph 1 HTML:", p1Html);
    if (!p1Html.includes("useState") || !p1Html.includes("docx-fa-inline-code")) {
      throw new Error("Code tag preservation failed in translated paragraph");
    }

    // Verify link preservation
    const linkText = await frameElement.locator("#link1").textContent();
    console.log("Child link text preserved:", linkText);
    if (linkText?.trim() !== "Introduction Guide") {
      throw new Error("Child link preservation failed");
    }

    // Test Restore English functionality
    console.log("Triggering DOCX_RESTORE_EN...");
    await page.evaluate(() => (window as unknown as { triggerRestore: () => void }).triggerRestore());

    await page.waitForTimeout(300);
    const restoredTitle = await frameElement.locator("#title").textContent();
    console.log("Restored Heading 1:", restoredTitle);
    if (restoredTitle?.trim() !== "Getting Started") {
      throw new Error("Failed to restore original English title");
    }

    console.log("✅ All Playwright E2E checks PASSED!");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
