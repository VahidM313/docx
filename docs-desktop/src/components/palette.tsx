import * as React from "react";
import { useApp } from "../lib/store";
import { ensureBaseIndex, search, ensureExtraEntries, highlight, indexedCount, type SearchEntry } from "../lib/search";
import { getBrand, getSiteIconHtml, SITE_MAP } from "../lib/catalog";
import { Dialog, DialogContent } from "../ui";
import { Search, Loader2 } from "lucide-react";

interface Hit {
  entry: SearchEntry;
  score: number;
}

export default function CommandPalette() {
  const app = useApp();
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState<string | null>(null);
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [cursor, setCursor] = React.useState(0);
  const [indexReady, setIndexReady] = React.useState(indexedCount() > 0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  /* The index is loaded only when search is actually opened, not at boot. */
  React.useEffect(() => {
    if (!app.paletteOpen) return;
    setQ("");
    setDebouncedQ("");
    setSiteFilter(null);
    setHits([]);
    setCursor(0);
    window.setTimeout(() => inputRef.current?.focus(), 40);
    if (!indexReady) {
      ensureBaseIndex().then(() => setIndexReady(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.paletteOpen]);

  /* debounce typing so the scoring pass never runs per keystroke */
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 130);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    if (!debouncedQ.trim() || !indexReady) {
      setHits([]);
      return;
    }
    const run = () => {
      const r = search(debouncedQ, siteFilter ?? undefined, 120);
      setHits(r);
      setCursor(0);
    };
    run();
    // make sure the first-hit site has its per-pack entries merged in, then rescore once
    const firstSite = search(debouncedQ, siteFilter ?? undefined, 4)[0]?.entry.site;
    if (firstSite) {
      ensureExtraEntries(firstSite).then(() => {
        if (SITE_MAP[firstSite]) run();
      });
    }
  }, [debouncedQ, siteFilter, indexReady]);

  React.useEffect(() => {
    if (!app.paletteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, hits.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (hits[cursor]) choose(hits[cursor].entry);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.paletteOpen, hits, cursor]);

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-cursor="1"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function choose(entry: SearchEntry) {
    app.setPaletteOpen(false);
    const installed = app.entries.find((e) => e.id === entry.site)?.installed;
    if (!installed) {
      app.toast({ kind: "info", message: `Installing ${getBrand(entry.site).name} first…` });
      app.installSite(entry.site).then((ok) => ok && app.openSite(entry.site, entry.path));
    } else {
      app.openSite(entry.site, entry.path);
    }
  }

  const grouped = React.useMemo(() => {
    const groups = new Map<string, Hit[]>();
    for (const h of hits) {
      const name = getBrand(h.entry.site).name;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(h);
    }
    return [...groups.entries()].slice(0, 20);
  }, [hits]);

  return (
    <Dialog open={app.paletteOpen} onOpenChange={app.setPaletteOpen}>
      <DialogContent className="top-[10%] max-w-2xl translate-y-0 -translate-x-1/2 p-0">
        <div className="relative border-b border-border p-2.5">
          <Search size={16} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={indexReady ? "Search your offline documentation" : "Loading search index…"}
            className="h-9 w-full rounded-md bg-input pl-9 pr-14 text-sm outline-none placeholder:text-muted-foreground"
            spellCheck={false}
          />
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-border-strong px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* site filter rail */}
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="All sites" active={!siteFilter} onClick={() => setSiteFilter(null)} />
          {app.entries
            .filter((e) => e.installed)
            .slice(0, 18)
            .map((e) => (
              <FilterChip
                key={e.id}
                label={e.brand.name}
                active={siteFilter === e.id}
                onClick={() => setSiteFilter(e.id)}
              />
            ))}
        </div>

        <div ref={listRef} className="max-h-[56vh] min-h-[120px] overflow-y-auto p-1.5">
          {!indexReady && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Loading index…
            </div>
          )}
          {indexReady && !q.trim() && <Empty text="Search titles across your installed documentation." />}
          {indexReady && q.trim() && !hits.length && <Empty text={`No results for “${q}”.`} />}
          {grouped.map(([site, list]) => (
            <div key={site} className="mb-1.5">
              <div className="flex items-center gap-2 px-2.5 py-1">
                <span
                  className="grid h-4 w-4 place-items-center rounded"
                  dangerouslySetInnerHTML={{ __html: getSiteIconHtml(list[0].entry.site) }}
                />
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{site}</span>
              </div>
              {list.slice(0, 7).map((h) => {
                const flatIndex = hits.indexOf(h);
                return (
                  <button
                    key={`${h.entry.site}|${h.entry.path}-${flatIndex}`}
                    onMouseEnter={() => setCursor(flatIndex)}
                    onClick={() => choose(h.entry)}
                    data-cursor={flatIndex === cursor ? "1" : undefined}
                    className={
                      "flex w-full items-center gap-3 rounded px-2.5 py-2 text-left transition-colors " +
                      (flatIndex === cursor ? "bg-accent" : "hover:bg-accent/60")
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[13.5px] font-medium [&_.hlq]:rounded [&_.hlq]:bg-brand/20 [&_.hlq]:px-0.5 [&_.hlq]:font-bold [&_.hlq]:text-brand"
                        dangerouslySetInnerHTML={{ __html: highlight(h.entry.title, debouncedQ) }}
                      />
                      <div className="truncate text-[11px] text-muted-foreground">{h.entry.path}</div>
                    </div>
                    <kbd className="hidden shrink-0 rounded border border-border-strong px-1.5 text-[10px] text-muted-foreground sm:block">
                      ↵
                    </kbd>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10.5px] text-muted-foreground">
          <span>
            {hits.length} results {siteFilter ? `· in ${getBrand(siteFilter).name}` : "· all sites"}
            {indexReady && indexedCount() > 0 ? ` · ${indexedCount().toLocaleString()} indexed` : ""}
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-border-strong px-1">↑↓</kbd> navigate
            <kbd className="rounded border border-border-strong px-1">↵</kbd> open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 rounded px-2.5 py-1 text-[11px] font-medium transition-colors " +
        (active ? "bg-brand text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">{text}</p>;
}
