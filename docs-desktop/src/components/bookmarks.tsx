import * as React from "react";
import { useApp } from "../lib/store";
import { Dialog, DialogContent, DialogTitle, Button } from "../ui";
import { getSiteIconHtml, getBrand, getEntryPath } from "../lib/catalog";
import { Trash2, ExternalLink, Bookmark as BookmarkIcon } from "lucide-react";

export default function BookmarksDialog() {
  const app = useApp();
  const bookmarks = [...app.bookmarks].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Dialog open={app.bookmarksOpen} onOpenChange={app.setBookmarksOpen}>
      <DialogContent className="top-[10%] max-w-lg translate-y-0 -translate-x-1/2 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <BookmarkIcon size={15} className="text-brand" />
          <DialogTitle className="text-[13.5px]">Bookmarks</DialogTitle>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
            {bookmarks.length}
          </span>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-1.5">
          {!bookmarks.length && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-md border border-border bg-muted">
                <BookmarkIcon size={18} className="text-muted-foreground" />
              </span>
              <p className="text-[13px] font-medium">No bookmarks yet</p>
              <p className="text-[12px] text-muted-foreground">
                Use <span className="font-semibold text-foreground">Save</span> in the titlebar while reading.
              </p>
            </div>
          )}
          {bookmarks.map((b) => {
            const brand = getBrand(b.siteId);
            return (
              <div
                key={b.id}
                className="group flex w-full items-center gap-2.5 rounded px-2 py-2 transition-colors hover:bg-accent"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted"
                  dangerouslySetInnerHTML={{ __html: getSiteIconHtml(b.siteId) }}
                />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    app.setBookmarksOpen(false);
                    app.openSite(b.siteId, b.pathOrUrl);
                  }}
                >
                  <span className="block truncate text-[13px] font-medium">{b.title || b.pathOrUrl}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {brand.name} · {b.pathOrUrl || getEntryPath(b.siteId)}
                  </span>
                </button>
                <button
                  onClick={() => {
                    app.setBookmarksOpen(false);
                    app.openSite(b.siteId, b.pathOrUrl);
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
                  title="Open"
                >
                  <ExternalLink size={13} />
                </button>
                <Button
                  variant="ghost"
                  size="iconSm"
                  className="shrink-0 hover:bg-danger/10 hover:text-danger"
                  title="Remove"
                  onClick={() => app.removeBookmark(b.id)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
