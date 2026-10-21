import * as React from "react";
import { useApp } from "../lib/store";
import { SITES, SITE_MAP, getAdaptiveBrandColor, getAdaptiveSiteSvg } from "../lib/catalog";
import { Switch, Button } from "../ui";
import {
  X,
  Palette,
  HardDrive,
  ZoomIn,
  Info,
  Check,
  RefreshCw,
  Sun,
  Moon,
  Laptop,
  BookOpen,
  Type,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const FONT_FAMILIES = [
  { id: "default", name: "Doc Native", desc: "Default doc stylesheet font", sample: "const code = true;" },
  { id: "inter", name: "Inter (Modern Sans)", desc: "Clean modern grotesque sans-serif", sample: "The quick brown fox jumps" },
  { id: "jetbrains-mono", name: "JetBrains Mono", desc: "Developer-focused monospace font", sample: "fn main() -> Result<()>" },
  { id: "fira-code", name: "Fira Code", desc: "Monospace with programming ligatures", sample: "const arrow = () => true;" },
  { id: "system", name: "System Native", desc: "Platform OS UI font (Segoe / SF)", sample: "Accessible, native styling" },
  { id: "serif", name: "Editorial Serif", desc: "Georgia / Merriweather serif typeface", sample: "Literary, relaxed reading" },
];

export function SettingsModal() {
  const app = useApp();
  const [activeTab, setActiveTab] = React.useState<"doc-prefs" | "appearance" | "display" | "packs" | "about">(
    "doc-prefs",
  );

  // Determine currently selected site for doc preferences
  const activeSiteId = app.activeTab?.siteId && app.activeTab.siteId !== "home"
    ? app.activeTab.siteId
    : (app.entries.find((e) => e.installed)?.id || "tailwind");

  const [selectedSiteId, setSelectedSiteId] = React.useState<string>(activeSiteId);

  // Sync selected site if activeTab changes and user opens modal
  React.useEffect(() => {
    if (app.activeTab?.siteId && app.activeTab.siteId !== "home") {
      setSelectedSiteId(app.activeTab.siteId);
    }
  }, [app.activeTab?.siteId, app.settingsOpen]);

  // Global ESC key listener for modal
  React.useEffect(() => {
    if (!app.settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        app.setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [app]);

  if (!app.settingsOpen) return null;

  const currentDocPrefs = app.getDocPrefs(selectedSiteId);
  const currentBrand = SITE_MAP[selectedSiteId];
  const outdated = app.entries.filter((e) => e.updateAvailable && e.installed);

  const fontPreviewFamily =
    currentDocPrefs.fontFamily === "inter"
      ? "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      : currentDocPrefs.fontFamily === "jetbrains-mono"
      ? "'JetBrains Mono', Consolas, monospace"
      : currentDocPrefs.fontFamily === "fira-code"
      ? "'Fira Code', Consolas, monospace"
      : currentDocPrefs.fontFamily === "serif"
      ? "Georgia, Cambria, 'Times New Roman', serif"
      : currentDocPrefs.fontFamily === "system"
      ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      : "inherit";

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-black/75 backdrop-blur-xs animate-fade-in select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) app.setSettingsOpen(false);
      }}
    >
      <div className="relative flex h-full w-full max-w-5xl mx-auto bg-background text-foreground shadow-lift overflow-hidden md:my-auto md:h-[86vh] md:rounded-xl md:border md:border-border">
        {/* Discord-style ESC close button - Fixed & Highly Visible */}
        <div className="absolute top-4 right-4 md:top-5 md:right-7 z-40 flex flex-col items-center">
          <button
            type="button"
            onClick={() => app.setSettingsOpen(false)}
            className="group flex h-9 w-9 items-center justify-center rounded-full border-2 border-zinc-400 dark:border-zinc-600 bg-surface text-foreground hover:border-danger hover:bg-danger/10 hover:text-danger active:scale-95 transition-all shadow-sm cursor-pointer"
            aria-label="Close Settings (ESC)"
            title="Close Settings (Esc)"
          >
            <X className="h-4.5 w-4.5 transition-transform duration-150 group-hover:rotate-90" />
          </button>
          <span className="text-[10px] font-bold tracking-wider text-zinc-600 dark:text-zinc-400 mt-1 uppercase">
            ESC
          </span>
        </div>

        {/* Left Sidebar Menu */}
        <aside className="w-60 bg-surface border-r border-border p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              User Settings
            </div>

            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab("doc-prefs")}
                className={
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer " +
                  (activeTab === "doc-prefs"
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                }
              >
                <BookOpen className="h-4 w-4 text-brand" />
                <span>Doc Preferences</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("appearance")}
                className={
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer " +
                  (activeTab === "appearance"
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                }
              >
                <Palette className="h-4 w-4" />
                <span>App Appearance</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("display")}
                className={
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer " +
                  (activeTab === "display"
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                }
              >
                <ZoomIn className="h-4 w-4" />
                <span>Display & Zoom</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("packs")}
                className={
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer " +
                  (activeTab === "packs"
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                }
              >
                <HardDrive className="h-4 w-4" />
                <span>Packs & Storage</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("about")}
                className={
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer " +
                  (activeTab === "about"
                    ? "bg-accent text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                }
              >
                <Info className="h-4 w-4" />
                <span>About Docx</span>
              </button>
            </nav>
          </div>

          <div className="px-2 text-[11px] text-muted-foreground">
            Docx v1.0 • Discord Onyx UI
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="relative flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* ========================================================= */}
          {/* TAB 1: DOCUMENT PREFERENCES (Saved separately for each doc) */}
          {/* ========================================================= */}
          {activeTab === "doc-prefs" && (
            <div className="space-y-6 max-w-2xl pr-12">
              <div>
                <h2 className="text-lg font-bold text-foreground">Document Preferences</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Customize theme, font size, and font family preferences for each document individually. Preferences save automatically and persist each time the doc is opened.
                </p>
              </div>

              {/* Doc Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Select Document to Configure
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-xs focus:border-brand focus:outline-hidden cursor-pointer"
                  >
                    {SITES.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name} ({brand.category})
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      app.setDocPrefs(selectedSiteId, {
                        theme: "system",
                        fontSize: 16,
                        fontFamily: "default",
                      })
                    }
                    className="gap-1.5 shrink-0"
                    title="Reset to default settings for this doc"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </Button>
                </div>
              </div>

              {/* Selected Doc Identity Pill */}
              {currentBrand && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card/70 p-3 shadow-xs">
                  <div
                    className="h-7 w-7 shrink-0 flex items-center justify-center [&_svg]:h-6 [&_svg]:w-6"
                    style={{ color: getAdaptiveBrandColor(currentBrand.color, app.isDark) }}
                    dangerouslySetInnerHTML={{ __html: getAdaptiveSiteSvg(currentBrand, app.isDark) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-foreground truncate">{currentBrand.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{currentBrand.description}</div>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent text-foreground shrink-0">
                    {currentDocPrefs.fontSize}px • {currentDocPrefs.fontFamily} • {currentDocPrefs.theme}
                  </span>
                </div>
              )}

              {/* Match App Theme Override Banner / Switch */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5 shadow-xs">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand" />
                    <span className="text-xs font-bold text-foreground">Match Application Theme</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Override individual doc theme preferences so all documentation pages automatically match the app theme ({app.isDark ? "Dark" : "Light"}).
                  </div>
                </div>
                <Switch
                  checked={app.overrideDocTheme}
                  onCheckedChange={() => app.toggleOverrideDocTheme()}
                />
              </div>

              {/* Feature 1: Doc Themes Preference */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Document Theme Preference
                </label>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Dark Option */}
                  <button
                    type="button"
                    onClick={() => app.setDocPrefs(selectedSiteId, { theme: "dark" })}
                    className={
                      "relative rounded-lg border-2 p-3 text-left transition-all cursor-pointer " +
                      (currentDocPrefs.theme === "dark"
                        ? "border-brand bg-accent/40 shadow-xs"
                        : "border-border bg-card hover:border-border-strong")
                    }
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Moon className="h-4 w-4 text-brand" />
                        <span className="font-bold text-xs text-foreground">Dark</span>
                      </div>
                      {currentDocPrefs.theme === "dark" && (
                        <Check className="h-3.5 w-3.5 text-brand stroke-[3]" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Always dark mode for this doc.
                    </p>
                  </button>

                  {/* Light Option */}
                  <button
                    type="button"
                    onClick={() => app.setDocPrefs(selectedSiteId, { theme: "light" })}
                    className={
                      "relative rounded-lg border-2 p-3 text-left transition-all cursor-pointer " +
                      (currentDocPrefs.theme === "light"
                        ? "border-brand bg-accent/40 shadow-xs"
                        : "border-border bg-card hover:border-border-strong")
                    }
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sun className="h-4 w-4 text-warning" />
                        <span className="font-bold text-xs text-foreground">Light</span>
                      </div>
                      {currentDocPrefs.theme === "light" && (
                        <Check className="h-3.5 w-3.5 text-brand stroke-[3]" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Always light mode for this doc.
                    </p>
                  </button>

                  {/* System / Follow App Option */}
                  <button
                    type="button"
                    onClick={() => app.setDocPrefs(selectedSiteId, { theme: "system" })}
                    className={
                      "relative rounded-lg border-2 p-3 text-left transition-all cursor-pointer " +
                      (currentDocPrefs.theme === "system"
                        ? "border-brand bg-accent/40 shadow-xs"
                        : "border-border bg-card hover:border-border-strong")
                    }
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Laptop className="h-4 w-4 text-brand" />
                        <span className="font-bold text-xs text-foreground">Follow App</span>
                      </div>
                      {currentDocPrefs.theme === "system" && (
                        <Check className="h-3.5 w-3.5 text-brand stroke-[3]" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Matches application theme.
                    </p>
                  </button>
                </div>
              </div>

              {/* Feature 2: Doc Font Size Preference */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Document Font Size ({currentDocPrefs.fontSize}px)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => app.stepDocFontSize(selectedSiteId, -1)}
                      className="px-2 py-0.5 rounded border border-border bg-card hover:bg-accent text-xs font-bold transition-colors cursor-pointer"
                    >
                      A-
                    </button>
                    <button
                      type="button"
                      onClick={() => app.setDocPrefs(selectedSiteId, { fontSize: 16 })}
                      className="px-2 py-0.5 rounded border border-border bg-card hover:bg-accent text-xs font-mono transition-colors cursor-pointer"
                    >
                      16px (Default)
                    </button>
                    <button
                      type="button"
                      onClick={() => app.stepDocFontSize(selectedSiteId, 1)}
                      className="px-2 py-0.5 rounded border border-border bg-card hover:bg-accent text-xs font-bold transition-colors cursor-pointer"
                    >
                      A+
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  value={currentDocPrefs.fontSize}
                  onChange={(e) =>
                    app.setDocPrefs(selectedSiteId, { fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-brand cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>12px (Compact)</span>
                  <span>16px (Standard)</span>
                  <span>20px (Large)</span>
                  <span>24px (Huge)</span>
                </div>
              </div>

              {/* Feature 3: Doc Font Family Preference */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Document Font Family Preference
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  {FONT_FAMILIES.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => app.setDocPrefs(selectedSiteId, { fontFamily: font.id })}
                      className={
                        "relative rounded-lg border-2 p-3 text-left transition-all cursor-pointer " +
                        (currentDocPrefs.fontFamily === font.id
                          ? "border-brand bg-accent/40 shadow-xs"
                          : "border-border bg-card hover:border-border-strong")
                      }
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-foreground">{font.name}</span>
                        {currentDocPrefs.fontFamily === font.id && (
                          <Check className="h-3.5 w-3.5 text-brand stroke-[3]" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-1.5">{font.desc}</p>
                      <div
                        className="text-xs font-medium p-1.5 rounded bg-background border border-border/80 truncate text-foreground"
                        style={{
                          fontFamily:
                            font.id === "inter"
                              ? "'Inter', sans-serif"
                              : font.id === "jetbrains-mono"
                              ? "'JetBrains Mono', monospace"
                              : font.id === "fira-code"
                              ? "'Fira Code', monospace"
                              : font.id === "serif"
                              ? "Georgia, serif"
                              : font.id === "system"
                              ? "system-ui, sans-serif"
                              : "inherit",
                        }}
                      >
                        {font.sample}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Typography Preview Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Live Typography Preview for {currentBrand?.name}
                </label>
                <div
                  className="rounded-lg border border-border bg-card p-4 space-y-2 shadow-xs"
                  style={{
                    fontFamily: fontPreviewFamily,
                    fontSize: `${currentDocPrefs.fontSize}px`,
                  }}
                >
                  <div className="font-bold" style={{ fontSize: `${currentDocPrefs.fontSize + 4}px` }}>
                    Quickstart Guide & API Reference
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    This offline documentation reader optimizes typography, legibility, and contrast. Every preference is persisted separately for {currentBrand?.name}.
                  </p>
                  <pre
                    className="p-2 rounded bg-background border border-border text-brand overflow-x-auto"
                    style={{ fontSize: `${Math.max(11, currentDocPrefs.fontSize - 2)}px` }}
                  >
                    <code>{`import { createApp } from "${selectedSiteId}";\nconst app = createApp({ theme: "${currentDocPrefs.theme}" });`}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: APP APPEARANCE                                     */}
          {/* ========================================================= */}
          {activeTab === "appearance" && (
            <div className="space-y-6 max-w-xl pr-12">
              <div>
                <h2 className="text-lg font-bold text-foreground">App Appearance</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Customize your global Discord UI theme experience.
                </p>
              </div>

              {/* Theme Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Application Theme
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {/* Onyx Dark Card */}
                  <button
                    type="button"
                    onClick={() => app.setThemeMode("dark")}
                    className={
                      "relative rounded-lg border-2 p-4 text-left transition-all cursor-pointer " +
                      (app.themeMode === "dark"
                        ? "border-brand bg-accent/40 shadow-sm"
                        : "border-border bg-card hover:border-border-strong")
                    }
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Moon className="h-5 w-5 text-brand" />
                        <span className="font-bold text-sm text-foreground">Dark (Onyx)</span>
                      </div>
                      {app.themeMode === "dark" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    {/* Visual Preview */}
                    <div className="h-10 rounded bg-black border border-border flex items-center px-3 gap-2">
                      <div className="h-4 w-4 rounded-full bg-[#111214]" />
                      <div className="h-2 w-16 rounded bg-[#1e1f22]" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Pure midnight black (AMOLED Onyx) layout with crisp Discord accents.
                    </p>
                  </button>

                  {/* Discord Light Card */}
                  <button
                    type="button"
                    onClick={() => app.setThemeMode("light")}
                    className={
                      "relative rounded-lg border-2 p-4 text-left transition-all cursor-pointer " +
                      (app.themeMode === "light"
                        ? "border-brand bg-accent/40 shadow-sm"
                        : "border-border bg-card hover:border-border-strong")
                    }
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sun className="h-5 w-5 text-warning" />
                        <span className="font-bold text-sm text-foreground">Light (Pure White)</span>
                      </div>
                      {app.themeMode === "light" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    {/* Visual Preview */}
                    <div className="h-10 rounded bg-[#ffffff] border border-border flex items-center px-3 gap-2">
                      <div className="h-4 w-4 rounded-full bg-[#f4f4f5]" />
                      <div className="h-2 w-16 rounded bg-[#e4e4e7]" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Pure white AMOLED-inverted light theme with high-contrast text.
                    </p>
                  </button>
                </div>

                {/* System Sync option */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5 mt-2">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-foreground">Sync with computer</div>
                    <div className="text-[11px] text-muted-foreground">
                      Automatically switch between Onyx Dark and Pure White Light based on your system.
                    </div>
                  </div>
                  <Switch
                    checked={app.themeMode === "system"}
                    onCheckedChange={(c) => app.setThemeMode(c ? "system" : app.isDark ? "dark" : "light")}
                  />
                </div>

                {/* Match App Theme for Docs */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5 mt-2">
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-brand" />
                      <span className="text-xs font-semibold text-foreground">Match App Theme for Docs</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Override individual doc theme preferences to keep all documentation pages synced with the active app theme.
                    </div>
                  </div>
                  <Switch
                    checked={app.overrideDocTheme}
                    onCheckedChange={() => app.toggleOverrideDocTheme()}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: DISPLAY & ZOOM                                     */}
          {/* ========================================================= */}
          {activeTab === "display" && (
            <div className="space-y-6 max-w-xl pr-12">
              <div>
                <h2 className="text-lg font-bold text-foreground">Display & Zoom</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Adjust reader scale and UI preferences.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Global Reader Zoom ({app.readerZoom}%)
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => app.setReaderZoom(100)}
                    disabled={app.readerZoom === 100}
                  >
                    Reset (100%)
                  </Button>
                </div>
                <input
                  type="range"
                  min="75"
                  max="150"
                  step="5"
                  value={app.readerZoom}
                  onChange={(e) => app.setReaderZoom(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  UI Features
                </label>
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-foreground">Theme Sync with Embedded Docs</div>
                    <div className="text-[11px] text-muted-foreground">
                      Inject dark/light styling directly into loaded documentation pages.
                    </div>
                  </div>
                  <Switch
                    checked={app.flags.themeSync}
                    onCheckedChange={(c) => app.setFlag("themeSync", c)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: PACKS & STORAGE                                    */}
          {/* ========================================================= */}
          {activeTab === "packs" && (
            <div className="space-y-6 max-w-xl pr-12">
              <div>
                <h2 className="text-lg font-bold text-foreground">Packs & Storage</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage offline docpacks and updates.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {app.entries.filter((e) => e.installed).length} packs installed offline
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {outdated.length} packs have newer updates available
                    </div>
                  </div>
                  {outdated.length > 0 && (() => {
                    const outdatedSizeMb = outdated.reduce((a, e) => a + (e.remote?.sizeBytes ?? 0) / (1024 * 1024), 0);
                    const outdatedSizeStr = outdatedSizeMb < 1 ? `${Math.round(outdatedSizeMb * 1024)} KB` : `${outdatedSizeMb.toFixed(1)} MB`;
                    return (
                      <Button
                        variant="gradient"
                        size="sm"
                        onClick={() => app.batchUpdateOutdated()}
                        className="gap-1.5"
                        title={`Update all ${outdated.length} packs (${outdatedSizeStr})`}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Update All ({outdated.length} · {outdatedSizeStr})</span>
                      </Button>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: ABOUT DOCX                                         */}
          {/* ========================================================= */}
          {activeTab === "about" && (
            <div className="space-y-6 max-w-xl pr-12">
              <div>
                <h2 className="text-lg font-bold text-foreground">About Docx</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Offline Developer Documentation with Discord UI
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <div className="font-semibold text-foreground">Discord Clone UI</div>
                <p>
                  Engineered with an installed-only Domain Rail, Channel Sidebar with doc categories, single-tab-bar toggle, per-doc typography & theme preferences, and pure AMOLED Onyx and Pure White light modes.
                </p>
                <div className="pt-2 text-[11px] border-t border-border">
                  Desktop & Mobile Responsive • Automated Playwright Verification
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
