import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/store";
import { search, ensureExtraEntries, highlight, type SearchEntry } from "../lib/search";
import { getBrand, getSiteIconHtml } from "../lib/catalog";
import { Dialog, DialogContent } from "../ui";

interface Hit {
  entry: SearchEntry;
  score: number;
}

export default function CommandPalette() {
  const app = useApp();
  const [q, setQ] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState<string | null>(null);
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (app.paletteOpen) {
      setQ("");
      setSiteFilter(null);
      setHits([]);
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [app.paletteOpen]);

  React.useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const r = search(q, siteFilter ?? undefined, 60);
    setHits(r);
    setCursor(0);
    if (r.length && r[0].entry.site) ensureExtraEntries(r[0].entry.site).then(() => setHits(search(q, siteFilter ?? undefined, 60)));
  }, [q, siteFilter]);

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
    return [...groups.entries()].slice(0, 12);
  }, [hits]);

  return (
    <Dialog open={app.paletteOpen} onOpenChange={app.setPaletteOpen}>
      <DialogContent className="top-[14%] translate-y-0 -translate-x-1/2 p-0 animate-rise max-w-2xl">
        <div className="relative border-b border-border p-2.5">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 12,400+ pages across every installed site…"
            className="h-10 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            spellCheck={false}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
                color={e.brand.color}
                onClick={() => setSiteFilter(e.id)}
              />
            ))}
        </div>

        <div ref={listRef} className="max-h-[52vh] min-h-[120px] overflow-y-auto p-1.5">
          {!q.trim() && <Empty text="Type to search titles across your offline library." />}
          {q.trim() && !hits.length && <Empty text={`No results for “${q}”.`} />}
          {grouped.map(([site, list]) => (
            <div key={site} className="mb-1.5">
              <div className="flex items-center gap-2 px-2.5 py-1">
                <span
                  className="grid h-4 w-4 place-items-center rounded text-[var(--c)]"
                  style={{ ["--c" as string]: getBrand(list[0].entry.site).color }}
                  dangerouslySetInnerHTML={{ __html: getSiteIconHtml(list[0].entry.site) }}
                />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{site}</span>
              </div>
              {list.slice(0, 6).map((h) => {
                const flatIndex = hits.indexOf(h);
                return (
                  <motion.button
                    key={`${h.entry.site}|${h.entry.path}-${flatIndex}`}
                    initial={false}
                    onMouseEnter={() => setCursor(flatIndex)}
                    onClick={() => choose(h.entry)}
                    data-cursor={flatIndex === cursor ? "1" : undefined}
                    className={
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors " +
                      (flatIndex === cursor ? "bg-accent" : "hover:bg-accent/60")
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[13.5px] font-medium [&_.hlq]:bg-[var(--grad-b)]/20 [&_.hlq]:rounded [&_.hlq]:px-0.5 [&_.hlq]:font-bold [&_.hlq]:text-[var(--grad-b)]" 
                        dangerouslySetInnerHTML={{ __html: highlight(h.entry.title, q) }}
                      />
                      <div className="truncate text-[11px] text-muted-foreground">
                        {h.entry.path}
                      </div>
                    </div>
                    <kbd className="hidden shrink-0 rounded border border-border px-1.5 text-[10px] text-muted-foreground sm:block">
                      ↵
                    </kbd>
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10.5px] text-muted-foreground">
          <span>
            {hits.length} results {siteFilter ? `· in ${getBrand(siteFilter).name}` : "· all sites"}
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-border px-1">↑↓</kbd> navigate
            <kbd className="rounded border border-border px-1">↵</kbd> open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active?: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all " +
        (active ? "grad-bg border-0 text-white shadow-soft" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")
      }
      style={active && color ? undefined : color ? { ["--chip" as string]: color } : undefined}
    >
      {label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">{text}</p>;
}
