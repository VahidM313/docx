import * as React from "react";
import { useApp, type BrowserTab } from "../lib/store";
import { Tauri } from "../lib/tauri";
import { getBrand, getEntryPath, EMBEDDED_SITE_IDS } from "../lib/catalog";
import { Loader2 } from "lucide-react";

/** Imperative API the titlebar/outside controls can call. */
export interface ReaderPanelsApi {
  zoomBy: (deltaPercent: number) => void; // 0 = reset
  toggleDark: (siteId: string) => void;
  bookmarkToggle: (tab: BrowserTab) => void;
  reload: () => void;
}

function tabTitle(tab: BrowserTab) {
  const b = getBrand(tab.siteId);
  if (tab.pathOrUrl && tab.pathOrUrl !== getEntryPath(tab.siteId)) {
    const seg = tab.pathOrUrl.split("/").filter(Boolean).pop() ?? "";
    return (
      seg
        .replace(/[-_]+/g, " ")
        .replace(/\.(html?)$/, "")
        .slice(0, 28) || b.name
    );
  }
  return b.name;
}

const IframePanel = React.forwardRef<
  HTMLIFrameElement,
  { tab: BrowserTab; url: string; active: boolean; onLoad: () => void }
>(({ tab, url, active, onLoad }, ref) => (
  <div className="absolute inset-0" style={{ display: active ? "block" : "none" }}>
    <iframe
      key={tab.id}
      ref={ref}
      title={tabTitle(tab)}
      src={url}
      onLoad={onLoad}
      className="h-full w-full border-0 bg-white"
      allow="clipboard-write"
    />
  </div>
));
IframePanel.displayName = "IframePanel";

/** Keep at most this many document renderers alive. Each one is a full
 *  cross-origin web renderer, so unbounded tab counts are a memory leak. */
const MAX_LIVE_IFRAMES = 3;

export function ReaderPanels(props: { apiRef: React.RefObject<ReaderPanelsApi | null> }) {
  const app = useApp();
  const urlsRef = React.useRef<Record<string, string>>({});
  const iframeRefs = React.useRef<Record<string, HTMLIFrameElement | null>>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [, force] = React.useState(0);
  const [mounted, setMounted] = React.useState<string[]>([]);

  const webTabs = app.tabs.filter((t) => t.siteId !== "home");
  const activeWeb = webTabs.find((t) => t.id === app.activeTabId) ?? null;

  /* Only load tabs once they are activated; evict the oldest beyond the cap. */
  const activeWebId = activeWeb?.id ?? null;
  React.useEffect(() => {
    if (!activeWebId) return;
    setMounted((prev) => {
      const next = prev.filter((id) => id !== activeWebId);
      next.push(activeWebId);
      return next.length > MAX_LIVE_IFRAMES ? next.slice(next.length - MAX_LIVE_IFRAMES) : next;
    });
  }, [activeWebId]);

  const liveTabs = React.useMemo(
    () => webTabs.filter((t) => mounted.includes(t.id)),
    [webTabs, mounted],
  );

  /* ---- resolve server ports & urls whenever tabs change ---- */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const t of webTabs) {
        if (urlsRef.current[`${t.id}|${t.pathOrUrl ?? ""}`]) continue;
        try {
          let port: number;
          if (EMBEDDED_SITE_IDS.includes(t.siteId)) {
            const st = app.servers ?? (await Tauri.checkServers());
            port = t.siteId === "tailwind" ? st.tailwind_port : st.shadcn_port;
          } else {
            port = await Tauri.ensureSiteServer(t.siteId);
          }
          if (cancelled) return;
          const url = `http://localhost:${port}${t.pathOrUrl ?? getEntryPath(t.siteId)}`;
          const prev = Object.keys(urlsRef.current).find((k) => k.startsWith(`${t.id}|`));
          if (prev !== `${t.id}|${t.pathOrUrl ?? ""}`) {
            urlsRef.current[`${t.id}|${t.pathOrUrl ?? ""}`] = url;
            if (prev) delete urlsRef.current[prev];
            setLoading((l) => ({ ...l, [t.id]: true }));
            force((n) => n + 1);
          }
        } catch {
          if (!cancelled) {
            urlsRef.current[`${t.id}|${t.pathOrUrl ?? ""}`] = "about:blank";
            force((n) => n + 1);
          }
        }
      }
      if (!app.servers) {
        try {
          const st = await Tauri.checkServers();
          !cancelled && window.document.dispatchEvent(new CustomEvent("docx:servers", { detail: st }));
        } catch {}
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.tabs]);

  /* ---- broadcast reader settings to live iframes ---- */
  const broadcast = React.useCallback(() => {
    if (!app.flags.themeSync && !app.flags.customFont) return;
    for (const t of liveTabs) {
      try {
        const prefs = app.getDocPrefs(t.siteId);
        iframeRefs.current[t.id]?.contentWindow?.postMessage(
          {
            type: "DOCX_READER_SETTINGS",
            siteId: t.siteId,
            zoom: app.readerZoom,
            darkMode: app.effectiveSiteDark(t.siteId),
            systemDark: app.isDark,
            themeEnabled: app.flags.themeSync,
            fontEnabled: app.flags.customFont,
            customFontEnabled: app.flags.customFont,
            fontSize: prefs.fontSize,
            fontFamily: prefs.fontFamily,
          },
          "*",
        );
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.readerZoom, app.effectiveSiteDark, app.flags, app.isDark, app.overrideDocTheme, app.docPrefs, liveTabs]);

  React.useEffect(broadcast, [app.readerZoom, app.effectiveSiteDark, app.flags.themeSync, app.flags.customFont, app.docPrefs, app.overrideDocTheme, app.isDark, liveTabs, broadcast]);

  /* ---- imperative api ---- */
  React.useImperativeHandle(props.apiRef, () => ({
    zoomBy: (delta) => {
      app.setReaderZoom(delta === 0 ? 100 : app.readerZoom + delta);
      broadcast();
    },
    toggleDark: (siteId) => {
      app.toggleSiteDark(siteId);
      // broadcast happens via effect after state change
    },
    bookmarkToggle: (tab) => {
      const b = getBrand(tab.siteId);
      app.toggleBookmark({ siteId: tab.siteId, title: tabTitle(tab), pathOrUrl: tab.pathOrUrl ?? getEntryPath(tab.siteId) });
      const wasSaved = app.bookmarks.some(
        (x) => x.siteId === tab.siteId && x.pathOrUrl === (tab.pathOrUrl ?? getEntryPath(tab.siteId)),
      );
      app.toast({
        kind: wasSaved ? "info" : "success",
        message: wasSaved ? `Bookmark removed — ${b.name}` : `Bookmark saved — ${b.name}`,
      });
    },
    reload: () => {
      if (!activeWebId) return;
      const activeIframe = iframeRefs.current[activeWebId];
      if (activeIframe) {
        try {
          activeIframe.contentWindow?.location.reload();
        } catch {
          activeIframe.src = activeIframe.src;
        }
      }
    },
  }));

  /* ---- window event: servers status refresh ---- */
  React.useEffect(() => {
    const h = (e: Event) => {
      const st = (e as CustomEvent).detail;
      if (st.site_ports) Object.assign(urlsRef.current, {}, st.site_ports);
      force((n) => n + 1);
    };
    window.document.addEventListener("docx:servers", h);
    return () => window.document.removeEventListener("docx:servers", h);
  }, []);

  return (
    <div className="absolute inset-0" id="reader-panels-root">
      {liveTabs.map((t) => {
        const url = urlsRef.current[`${t.id}|${t.pathOrUrl ?? ""}`] ?? undefined;
        return (
          <IframePanel
            key={t.id}
            ref={(el) => {
              iframeRefs.current[t.id] = el;
            }}
            tab={t}
            url={url ?? "about:blank"}
            active={t.id === app.activeTabId}
            onLoad={() => {
              window.setTimeout(() => setLoading((l) => ({ ...l, [t.id]: false })), 250);
              broadcast();
            }}
          />
        );
      })}
      {activeWeb && loading[activeWeb.id] && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-popover px-3 py-1.5 text-xs font-medium shadow-lift">
          <Loader2 className="animate-spin text-brand" size={13} />
          Loading {getBrand(activeWeb.siteId).name}…
        </div>
      )}
    </div>
  );
}

export { tabTitle };
