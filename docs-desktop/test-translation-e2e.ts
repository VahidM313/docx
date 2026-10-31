import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

async function run() {
  console.log("=== Starting Comprehensive Playwright E2E Persian Tests (All 7 Sites) ===");

  const bridgeHtmlPath = path.resolve(__dirname, "src-tauri/src/bridge/reader-bridge.html");
  let bridgeScript = fs.readFileSync(bridgeHtmlPath, "utf-8");

  function getInjectedBridge(siteId: string) {
    return bridgeScript
      .replace(/__DOCX_SITE_ID__/g, siteId)
      .replace(/__DOCX_SITE_ORIGIN__/g, "http://localhost:49999");
  }

  // Parent container
  const parentContainerHtml = `<!DOCTYPE html>
<html>
<head><title>Docx Host</title></head>
<body>
  <iframe id="doc-frame" src="/tailwind.html" width="800" height="600"></iframe>
  <script>
    const frame = document.getElementById('doc-frame');
    window.translationRequestsCount = 0;

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'DOCX_REQUEST_TRANSLATION') {
        window.translationRequestsCount++;
        const items = e.data.items || [];
        const results = {};
        items.forEach((item) => {
          results[item.id] = {
            translated: "ترجمه: " + item.text,
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

  const server = http.createServer((req, res) => {
    const url = req.url?.split("?")[0] || "/";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

    // Tailwind
    if (url === "/tailwind.html") {
      res.end(`<!DOCTYPE html><html><body><h1 id="title">Tailwind English</h1>${getInjectedBridge("tailwind")}</body></html>`);
    }
    // React
    else if (url === "/learn") {
      res.end(`<!DOCTYPE html><html><body><h1 id="title">React Quick Start</h1>${getInjectedBridge("react")}</body></html>`);
    } else if (url === "/fa/learn") {
      res.end(`<!DOCTYPE html><html lang="fa" dir="rtl"><body><h1 id="title">شروع سریع ری‌اکت</h1>${getInjectedBridge("react")}</body></html>`);
    }
    // Vue
    else if (url === "/guide/introduction.html") {
      res.end(`<!DOCTYPE html><html><body><h1 id="title">Vue Introduction</h1>${getInjectedBridge("vue")}</body></html>`);
    } else if (url === "/fa/guide/introduction.html") {
      res.end(`<!DOCTYPE html><html lang="fa" dir="rtl"><body><h1 id="title">معرفی ویو</h1>${getInjectedBridge("vue")}</body></html>`);
    }
    // Kubernetes
    else if (url === "/docs/home/") {
      res.end(`<!DOCTYPE html><html><body><h1 id="title">Kubernetes Docs</h1>${getInjectedBridge("kubernetes")}</body></html>`);
    } else if (url === "/fa/docs/home/") {
      res.end(`<!DOCTYPE html><html lang="fa" dir="rtl"><body><h1 id="title">مستندات کوبرنتیز</h1>${getInjectedBridge("kubernetes")}</body></html>`);
    }
    // Gin
    else if (url === "/en/docs/") {
      res.end(`<!DOCTYPE html><html><body><h1 id="title">Gin Web Framework</h1>${getInjectedBridge("gin")}</body></html>`);
    } else if (url === "/fa/docs/") {
      res.end(`<!DOCTYPE html><html lang="fa" dir="rtl"><body><h1 id="title">فریم‌ورک جین</h1>${getInjectedBridge("gin")}</body></html>`);
    }
    // Python
    else if (url === "/3/") {
      res.end(`<!DOCTYPE html><html><body><h1 id="title">Python 3 Documentation</h1>${getInjectedBridge("python")}</body></html>`);
    } else if (url === "/fa/3.13/") {
      res.end(`<!DOCTYPE html><html lang="fa" dir="rtl"><body><h1 id="title">مستندات پایتون ۳</h1>${getInjectedBridge("python")}</body></html>`);
    }
    // Flask
    else if (url === "/flask-root") {
      res.end(`<!DOCTYPE html><html><body><h1 id="title">Flask Documentation</h1>${getInjectedBridge("flask")}</body></html>`);
    } else if (url === "/fa/") {
      res.end(`<!DOCTYPE html><html lang="fa" dir="rtl"><body><h1 id="title">مستندات فلسک</h1>${getInjectedBridge("flask")}</body></html>`);
    }
    // Git
    else if (url === "/docs/git") {
      res.end(`<!DOCTYPE html><html><body><h1 id="title">Git Reference</h1>${getInjectedBridge("git")}</body></html>`);
    } else if (url === "/book/fa/v2") {
      res.end(`<!DOCTYPE html><html lang="fa" dir="rtl"><body><h1 id="title">کتاب گیت</h1>${getInjectedBridge("git")}</body></html>`);
    } else {
      res.end(parentContainerHtml);
    }
  });

  await new Promise<void>((resolve) => server.listen(49999, resolve));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("http://localhost:49999", { waitUntil: "networkidle" });
    const frame = page.frameLocator("#doc-frame");

    const testCases = [
      { site: "react", initialUrl: "/learn", expectedFaUrl: "/fa/learn", expectedFaTitle: "شروع سریع ری‌اکت" },
      { site: "vue", initialUrl: "/guide/introduction.html", expectedFaUrl: "/fa/guide/introduction.html", expectedFaTitle: "معرفی ویو" },
      { site: "kubernetes", initialUrl: "/docs/home/", expectedFaUrl: "/fa/docs/home/", expectedFaTitle: "مستندات کوبرنتیز" },
      { site: "gin", initialUrl: "/en/docs/", expectedFaUrl: "/fa/docs/", expectedFaTitle: "فریم‌ورک جین" },
      { site: "python", initialUrl: "/3/", expectedFaUrl: "/fa/3.13/", expectedFaTitle: "مستندات پایتون ۳" },
      { site: "flask", initialUrl: "/flask-root", expectedFaUrl: "/fa/", expectedFaTitle: "مستندات فلسک" },
      { site: "git", initialUrl: "/docs/git", expectedFaUrl: "/book/fa/v2", expectedFaTitle: "کتاب گیت" },
    ];

    for (const tc of testCases) {
      console.log(`\nTesting Built-in Persian for: ${tc.site.toUpperCase()}...`);

      // Load initial English page
      await page.evaluate((u) => {
        const f = document.getElementById("doc-frame") as HTMLIFrameElement;
        f.src = u;
        (window as any).translationRequestsCount = 0;
      }, tc.initialUrl);
      await page.waitForTimeout(400);

      // Trigger translate to Persian
      await page.evaluate(() => (window as any).triggerTranslate());
      await page.waitForTimeout(500);

      // 1. Verify 0 machine translation requests
      const reqCount = await page.evaluate(() => (window as any).translationRequestsCount);
      if (reqCount !== 0) {
        throw new Error(`${tc.site} sent ${reqCount} machine translation requests to plugin! Expected 0.`);
      }

      // 2. Verify Persian page title
      const title = await frame.locator("#title").textContent();
      if (!title?.includes(tc.expectedFaTitle)) {
        throw new Error(`${tc.site} title expected '${tc.expectedFaTitle}', got '${title}'`);
      }

      // 3. Verify NO forced synthetic RTL class (docx-fa-active)
      const hasForcedRtl = await frame.locator("html").evaluate((el) => el.classList.contains("docx-fa-active"));
      if (hasForcedRtl) {
        throw new Error(`${tc.site} has synthetic docx-fa-active forced onto native Persian page!`);
      }

      console.log(`  ✓ ${tc.site}: Navigated to authentic Persian with 0 plugin requests and NO forced RTL class.`);

      // 4. Test English restoration
      await page.evaluate(() => (window as any).triggerRestore());
      await page.waitForTimeout(500);
      const restoredTitle = await frame.locator("#title").textContent();
      console.log(`  ✓ ${tc.site}: Restored English page title: '${restoredTitle}'`);
    }

    // Finally test that standard site (Tailwind) DOES use in-place machine translation
    console.log("\nTesting site WITHOUT built-in Persian (Tailwind CSS)...");
    await page.evaluate(() => {
      const f = document.getElementById("doc-frame") as HTMLIFrameElement;
      f.src = "/tailwind.html";
      (window as any).translationRequestsCount = 0;
    });
    await page.waitForTimeout(400);

    await page.evaluate(() => (window as any).triggerTranslate());
    await page.waitForTimeout(400);

    const twCount = await page.evaluate(() => (window as any).translationRequestsCount);
    if (twCount === 0) {
      throw new Error("Tailwind should use plugin machine translation, but sent 0 requests!");
    }
    const twHasRtl = await frame.locator("html").evaluate((el) => el.classList.contains("docx-fa-active"));
    if (!twHasRtl) {
      throw new Error("Tailwind should have docx-fa-active applied for machine translation!");
    }
    console.log(`  ✓ Tailwind: Sent ${twCount} translation requests and properly applied clean RTL layout.`);

    console.log("\n=======================================================");
    console.log("🌟 ALL 7 BUILT-IN PERSIAN DOCS + PLUGIN DOC VERIFIED 100%!");
    console.log("=======================================================");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
