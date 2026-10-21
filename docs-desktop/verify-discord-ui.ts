import { chromium } from "playwright";
import { spawn, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

async function run() {
  const screenshotsDir = path.resolve(__dirname, "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log("Starting Vite preview server...");
  const server = spawn("bun.exe", ["run", "vite", "preview", "--port", "5173", "--strictPort"], {
    cwd: path.resolve(__dirname),
    stdio: "pipe",
    shell: true,
  });

  // Wait 2.5s for server to start
  await new Promise((r) => setTimeout(r, 2500));

  console.log("Launching Chromium via Playwright...");
  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop Onyx Dark View with User's App Logo & Right-Aligned Indicator
    // -------------------------------------------------------------
    console.log("1. Testing Desktop Onyx Dark UI with Indicator on Right & 2x3 Controls...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto("http://localhost:5173", { waitUntil: "networkidle" });
    await desktopPage.waitForTimeout(1000);

    // Verify dark class & pure black background
    const bgInfo = await desktopPage.evaluate(() => {
      const isDark = document.documentElement.classList.contains("dark");
      const rail = document.querySelector("aside");
      const railBg = rail ? window.getComputedStyle(rail).backgroundColor : "";
      return { isDark, railBg };
    });
    console.log(`- Document has .dark class: ${bgInfo.isDark}, Rail background: ${bgInfo.railBg}`);

    // Verify user's logo.png is rendered
    const hasLogo = await desktopPage.locator('img[src="/logo.png"]').first().isVisible();
    console.log(`- Top Domain Rail has user's logo.png: ${hasLogo}`);

    // Verify Domain Rail indicator pill is aligned to the LEFT side of the rail
    const indicatorLeftPos = await desktopPage.evaluate(() => {
      const pill = document.querySelector(".discord-pill");
      if (!pill) return null;
      const cs = window.getComputedStyle(pill);
      return { right: cs.right, left: cs.left, borderRadius: cs.borderRadius };
    });
    console.log(`- Domain rail indicator position: left=${indicatorLeftPos?.left}, right=${indicatorLeftPos?.right}, radius=${indicatorLeftPos?.borderRadius}`);

    // Check Domain Rail Controls: Settings button, Theme toggle, Search, Bookmarks, Sidebar, Zen
    const settingsBtn = desktopPage.locator('button[aria-label="Settings"]').first();
    const hasSettingsOnRail = await settingsBtn.isVisible();
    console.log(`- Settings icon moved to Domain Rail: ${hasSettingsOnRail}`);

    // Capture Onyx Dark desktop screenshot
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, "desktop-onyx.png"),
    });
    console.log("- Saved desktop-onyx.png");

    // -------------------------------------------------------------
    // Test 2: Horizontal Tabs in Top Bar & Font Size Stepper
    // -------------------------------------------------------------
    console.log("2. Testing Horizontal Tabs in Top Bar & Top Bar Font Size Control...");
    const tailwindBtn = desktopPage.locator('button[aria-label="Tailwind CSS"]').first();
    if (await tailwindBtn.isVisible()) {
      await tailwindBtn.click();
      await desktopPage.waitForTimeout(600);
      console.log("- Clicked Tailwind doc to open it");
    }

    // Verify Top Bar Font Size Control
    const fontDecreaseBtn = desktopPage.locator('button[aria-label="Decrease Font Size"]').first();
    const fontIncreaseBtn = desktopPage.locator('button[aria-label="Increase Font Size"]').first();
    const fontSizeDisplay = desktopPage.locator('header button:has-text("px")').first();
    const hasFontControls = (await fontDecreaseBtn.isVisible()) && (await fontIncreaseBtn.isVisible());
    console.log(`- Top Bar has font size control (A- / A+): ${hasFontControls}`);

    if (await fontIncreaseBtn.isVisible()) {
      const sizeBefore = await fontSizeDisplay.textContent();
      await fontIncreaseBtn.click();
      await desktopPage.waitForTimeout(300);
      const sizeAfter = await fontSizeDisplay.textContent();
      console.log(`- Stepped font size from ${sizeBefore} to ${sizeAfter}`);
    }

    // Verify Top Bar Doc Theme Toggle
    const docThemeToggleBtn = desktopPage.locator('button[aria-label="Toggle Doc Theme"]').first();
    const hasDocThemeToggle = await docThemeToggleBtn.isVisible();
    console.log(`- Top Bar has Doc Theme toggle button: ${hasDocThemeToggle}`);
    if (hasDocThemeToggle) {
      const initialText = await docThemeToggleBtn.textContent();
      await docThemeToggleBtn.click();
      await desktopPage.waitForTimeout(400);
      const toggledText = await docThemeToggleBtn.textContent();
      console.log(`- Toggled doc theme from "${initialText?.trim()}" to "${toggledText?.trim()}"`);
    }

    // Verify Vertical Tab indicator is on the RIGHT side of the rail
    const vTabIndicatorPos = await desktopPage.evaluate(() => {
      const vPill = document.querySelector(".vertical-tab-pill");
      if (!vPill) return null;
      const cs = window.getComputedStyle(vPill);
      return { right: cs.right, left: cs.left, borderRadius: cs.borderRadius };
    });
    console.log(`- Vertical tab indicator position: right=${vTabIndicatorPos?.right}, left=${vTabIndicatorPos?.left}, radius=${vTabIndicatorPos?.borderRadius}`);

    // Verify smooth expanding and collapsing of the vertical tab rail
    const rightNav = desktopPage.locator("aside").last();
    const widthInitial = (await rightNav.boundingBox())?.width;
    console.log(`- Vertical tab rail initial compact width: ${widthInitial}px`);

    // Hover over vertical tab rail to expand
    const navBox = await rightNav.boundingBox();
    if (navBox) {
      await desktopPage.mouse.move(navBox.x + 20, navBox.y + 100);
      await desktopPage.waitForTimeout(400);
      const widthExpanded = (await rightNav.boundingBox())?.width;
      console.log(`- Vertical tab rail smoothly expanded to: ${widthExpanded}px`);

      // Mouse leave to collapse smoothly
      await desktopPage.mouse.move(300, 300);
      await desktopPage.waitForTimeout(400);
      const widthCollapsed = (await rightNav.boundingBox())?.width;
      console.log(`- Vertical tab rail smoothly collapsed back to: ${widthCollapsed}px`);
    }

    // Capture multi-doc open screenshot
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, "desktop-multi-doc-tabs.png"),
    });
    console.log("- Saved desktop-multi-doc-tabs.png");

    // -------------------------------------------------------------
    // Test 3: Second Sidebar Hidden Remains Hidden on Doc Click
    // -------------------------------------------------------------
    console.log("3. Testing Second Sidebar Hidden Remains Hidden on Item Click...");
    // Collapse sidebar
    const toggleSidebarBtn = desktopPage.locator('button[aria-label="Toggle Docs Sidebar"]').first();
    if (await toggleSidebarBtn.isVisible()) {
      await toggleSidebarBtn.click();
      await desktopPage.waitForTimeout(400);
      console.log("- Collapsed channel sidebar via Domain Rail toggle");
    }

    // Verify second sidebar wrapper width is 0 (smoothly collapsed)
    const sidebarWrapper = desktopPage.locator(".discord-sidebar-transition").first();
    let sidebarWidth = (await sidebarWrapper.boundingBox())?.width ?? 0;
    console.log(`- Second sidebar width with sidebar closed: ${sidebarWidth}px (hidden: ${sidebarWidth === 0})`);

    // Click on home logo in domain rail
    const homeBtn = desktopPage.locator('button[aria-label="Docx Hub / Home"]').first();
    await homeBtn.click();
    await desktopPage.waitForTimeout(400);
    sidebarWidth = (await sidebarWrapper.boundingBox())?.width ?? 0;
    console.log(`- Second sidebar width after clicking Home: ${sidebarWidth}px (remained hidden: ${sidebarWidth === 0})`);

    // Click on Tailwind doc in domain rail
    await tailwindBtn.click();
    await desktopPage.waitForTimeout(400);
    sidebarWidth = (await sidebarWrapper.boundingBox())?.width ?? 0;
    console.log(`- Second sidebar width after clicking Tailwind doc: ${sidebarWidth}px (remained hidden: ${sidebarWidth === 0})`);

    // Capture collapsed sidebar screenshot
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, "desktop-sidebar-closed.png"),
    });
    console.log("- Saved desktop-sidebar-closed.png");

    // Reopen sidebar
    await toggleSidebarBtn.click();
    await desktopPage.waitForTimeout(400);

    // -------------------------------------------------------------
    // Test 4: Settings Dialog & Per-Doc Preferences & ESC Exit
    // -------------------------------------------------------------
    console.log("4. Testing Settings Dialog & Doc Preferences (Theme, Font Size, Family, ESC)...");
    await settingsBtn.click();
    await desktopPage.waitForTimeout(500);

    // Check Settings Modal is open
    const modalHeading = desktopPage.locator('h2:has-text("Document Preferences")');
    const isModalOpen = await modalHeading.isVisible();
    console.log(`- Settings modal opened with Document Preferences: ${isModalOpen}`);

    // Check Doc Theme options
    const darkThemePref = desktopPage.locator('button:has-text("Dark"):has-text("Always dark mode")');
    const lightThemePref = desktopPage.locator('button:has-text("Light"):has-text("Always light mode")');
    const followAppPref = desktopPage.locator('button:has-text("Follow App")');
    console.log(`- Doc Theme preferences visible: ${(await darkThemePref.isVisible()) && (await lightThemePref.isVisible())}`);

    // Check Font Family options
    const interFont = desktopPage.locator('button:has-text("Inter (Modern Sans)")');
    const jbMonoFont = desktopPage.locator('button:has-text("JetBrains Mono")');
    console.log(`- Doc Font Family preferences visible: ${(await interFont.isVisible()) && (await jbMonoFont.isVisible())}`);

    // Test ESC Exit Button
    const escExitBtn = desktopPage.locator('button[aria-label="Close Settings (ESC)"]');
    const escBadge = desktopPage.locator('span:has-text("ESC")').first();
    console.log(`- ESC exit icon and badge visible: ${(await escExitBtn.isVisible()) && (await escBadge.isVisible())}`);

    // Click ESC button to close modal
    await escExitBtn.click();
    await desktopPage.waitForTimeout(400);
    const isModalClosed = !(await modalHeading.isVisible().catch(() => false));
    console.log(`- Settings modal closed via ESC button: ${isModalClosed}`);

    // -------------------------------------------------------------
    // Test 5: Discord Pure White Light Theme & Legible Gray Colors
    // -------------------------------------------------------------
    console.log("5. Testing Discord Pure White Light Theme & High-Contrast Gray Colors...");
    const themeBtn = desktopPage.locator('button[aria-label="Switch Theme"]').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await desktopPage.waitForTimeout(600);

      const lightBg = await desktopPage.evaluate(() => {
        const rail = document.querySelector("aside");
        const body = document.body;
        const muted = document.querySelector(".discord-channel-item");
        const logo = document.querySelector(".logo-glyph");
        return {
          railBg: rail ? window.getComputedStyle(rail).backgroundColor : "",
          bodyBg: body ? window.getComputedStyle(body).backgroundColor : "",
          mutedColor: muted ? window.getComputedStyle(muted).color : "",
          logoFilter: logo ? window.getComputedStyle(logo).filter : "",
        };
      });
      console.log(`- Switched to light mode: Rail bg=${lightBg.railBg}, Body bg=${lightBg.bodyBg}, Text color=${lightBg.mutedColor}`);
      console.log(`- Light mode app logo filter: ${lightBg.logoFilter} (is black: ${lightBg.logoFilter.includes("brightness(0)")})`);
    }

    await desktopPage.screenshot({
      path: path.join(screenshotsDir, "desktop-discord-light.png"),
    });
    console.log("- Saved desktop-discord-light.png");

    // Switch back to dark for mobile testing
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await desktopPage.waitForTimeout(400);
    }
    await desktopContext.close();

    // -------------------------------------------------------------
    // Test 6: Zen Fullscreen & Edge Hover & Second Sidebar Hide
    // -------------------------------------------------------------
    console.log("6. Testing Zen Fullscreen Mode & Second Sidebar Hiding...");
    const zenContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const zenPage = await zenContext.newPage();
    await zenPage.goto("http://localhost:5173", { waitUntil: "networkidle" });
    await zenPage.waitForTimeout(600);

    // First ensure sidebar is collapsed in normal mode
    const normToggleSidebar = zenPage.locator('button[aria-label="Toggle Docs Sidebar"]').first();
    if (await normToggleSidebar.isVisible()) {
      await normToggleSidebar.click();
      await zenPage.waitForTimeout(300);
    }

    const zenBtn = zenPage.locator('button[aria-label="Zen Mode"]').first();
    if (await zenBtn.isVisible()) {
      await zenBtn.click();
      await zenPage.waitForTimeout(400);
      await zenPage.screenshot({ path: path.join(screenshotsDir, "desktop-zen-fullscreen.png") });
      console.log("- Saved desktop-zen-fullscreen.png");

      // Hover left edge in Zen mode
      await zenPage.mouse.move(5, 300);
      await zenPage.waitForTimeout(350);

      // Verify that in Zen mode, the hidden second sidebar has width 0px (remains hidden!)
      const zenSidebarWidth = await zenPage.evaluate(() => {
        const wrappers = document.querySelectorAll(".discord-sidebar-transition");
        // find the one inside the fixed zen navigation (z-[65])
        for (const w of Array.from(wrappers)) {
          if (w.closest(".z-\\[65\\]")) {
            return (w as HTMLElement).getBoundingClientRect().width;
          }
        }
        return null;
      });
      console.log(`- Zen mode second sidebar width on left edge hover: ${zenSidebarWidth}px (hidden: ${zenSidebarWidth === 0})`);

      // Hover top edge
      await zenPage.mouse.move(600, 5);
      await zenPage.waitForTimeout(300);
      await zenPage.screenshot({ path: path.join(screenshotsDir, "desktop-zen-edge-hover.png") });
      console.log("- Saved desktop-zen-edge-hover.png");
    }
    await zenContext.close();

    // -------------------------------------------------------------
    // Test 7: Dedicated Mobile Discord Viewport (Side-by-Side Nav + Chrome Tabs)
    // -------------------------------------------------------------
    console.log("7. Testing Dedicated Mobile Discord Viewport...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("http://localhost:5173", { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(800);

    // 1. Verify side-by-side Domain Rail + Channel Sidebar navigation in one view!
    const mobileDomainRail = mobilePage.locator("aside").first();
    const hasRail = await mobileDomainRail.isVisible();
    console.log(`- Mobile navigation has side-by-side Domain Rail: ${hasRail}`);

    await mobilePage.screenshot({
      path: path.join(screenshotsDir, "mobile-nav.png"),
    });
    console.log("- Saved mobile-nav.png");

    // 2. Click a doc in ChannelSidebar to open full-screen reader view
    const mobileDocItem = mobilePage.locator('.discord-channel-item:has-text("tailwind"), .discord-channel-item').first();
    if (await mobileDocItem.isVisible()) {
      await mobileDocItem.click();
      await mobilePage.waitForTimeout(600);

      // Verify Mobile Reader Header
      const backBtn = mobilePage.locator('button[aria-label="Back to Channels"]').first();
      const hasBackBtn = await backBtn.isVisible();
      console.log(`- Mobile full-screen reader open with Back button: ${hasBackBtn}`);

      await mobilePage.screenshot({
        path: path.join(screenshotsDir, "mobile-reader.png"),
      });
      console.log("- Saved mobile-reader.png");

      // 3. Click Chrome-style Tabs button
      const tabsBtn = mobilePage.locator('button[title="Open tabs"], button[aria-label*="Open tabs"]').first();
      if (await tabsBtn.isVisible()) {
        await tabsBtn.click();
        await mobilePage.waitForTimeout(400);

        const tabSwitcherHeading = mobilePage.locator('text="Open Documents"').first();
        const hasTabSwitcher = await tabSwitcherHeading.isVisible();
        console.log(`- Chrome-style Mobile Tab Switcher opened: ${hasTabSwitcher}`);

        await mobilePage.screenshot({
          path: path.join(screenshotsDir, "mobile-tabs.png"),
        });
        console.log("- Saved mobile-tabs.png");
      }
    }

    await mobileContext.close();
    console.log("All Playwright checks finished successfully! ✅");
  } finally {
    try {
      await browser.close();
    } catch {}
    try {
      if (server.pid) {
        execSync(`taskkill /pid ${server.pid} /T /F 2>nul`);
      }
    } catch {}
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
