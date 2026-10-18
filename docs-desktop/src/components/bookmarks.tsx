import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/store";
import { Dialog, DialogContent, DialogTitle, Button } from "../ui";
import { getSiteIconHtml, getBrand, getEntryPath } from "../lib/catalog";
import { Trash2, ExternalLink, Bookmark as BookmarkIcon } from "lucide-react";

export default function BookmarksDialog() {
  const app = useApp();
  const bookmarks = [...app.bookmarks].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Dialog open={app.bookmarksOpen} onOpenChange={app.setBookmarksOpen}>
      <DialogContent className="top-[12%] translate-y-0 -translate-x-1/2 max-w-lg p-0 animate-rise">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BookmarkIcon size={15} className="grad-text" />
          <DialogTitle>Bookmarks</DialogTitle>
          <Badgeish count={bookmarks.length} />
        </div>
        <div className="max-h-[58vh] overflow-y-auto p-1.5">
          {!bookmarks.length && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <motion.span
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-muted"
              >
                <BookmarkIcon size={20} className="text-muted-foreground" />
              </motion.span>
              <p className="text-[13px] font-medium">No bookmarks yet</p>
              <p className="text-[12px] text-muted-foreground">
                While reading, tap <span className="font-semibold">Save</span> in the titlebar to keep a page here.
              </p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {bookmarks.map((b) => {
              const brand = getBrand(b.siteId);
              return (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-accent"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--c)]"
                    style={{ ["--c" as string]: brand.color, background: brand.bgTint }}
                    dangerouslySetInnerHTML={{ __html: getSiteIconHtml(b.siteId) }}
                  />
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      app.setBookmarksOpen(false);
                      app.openSite(b.siteId, b.pathOrUrl);
                    }}
                  >
                    <span className="block truncate text-[13.5px] font-medium">{b.title || b.pathOrUrl}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {brand.name} · {b.pathOrUrl || getEntryPath(b.siteId)}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      app.setBookmarksOpen(false);
                      app.openSite(b.siteId, b.pathOrUrl);
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-surface hover:text-foreground group-hover:opacity-100"
                    title="Open"
                  >
                    <ExternalLink size={13} />
                  </button>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className="shrink-0 hover:bg-red-500/10 hover:text-red-500"
                    title="Remove"
                    onClick={() => app.removeBookmark(b.id)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Badgeish({ count }: { count: number }) {
  return <span className="grad-bg ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white">{count}</span>;
}
