// Typed wrappers around the Tauri IPC surface.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ServerStatus {
  tailwind: boolean;
  shadcn: boolean;
  tailwind_port: number;
  shadcn_port: number;
  site_ports?: Record<string, number>;
}

export interface PackStatusInfo {
  id: string;
  name: string;
  version: string;
  commit: string;
  route_count: number;
  chunk_count: number;
  size_mb: number;
  source: string;
  port: number;
}

export interface RemoteRegistryItem {
  id: string;
  name: string;
  version: string;
  commit: string;
  updatedAt?: string;
  sizeBytes: number;
  routeCount: number;
  chunkCount: number;
  installed: boolean;
  local_commit: string;
  update_available: boolean;
  iconFile?: string;
  iconETag?: string;
}

export interface DownloadProgressPayload {
  site_id: string;
  phase: string;
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
  detail: string;
}

export const Tauri = {
  windowShowReady: () => invoke("window_show_ready").catch(() => {}),
  windowMinimize: () => invoke("window_minimize"),
  windowToggleMaximize: () => invoke("window_toggle_maximize"),
  windowToggleFullscreen: () => invoke("window_toggle_fullscreen"),
  windowClose: () => invoke("window_close"),
  windowStartDragging: () => invoke("window_start_dragging"),

  checkServers: () => invoke<ServerStatus>("check_servers"),
  getInstalledPacks: () => invoke<PackStatusInfo[]>("get_installed_packs"),
  getRemoteRegistry: () => invoke<RemoteRegistryItem[]>("fetch_remote_registry"),
  ensureSiteServer: (siteId: string) => invoke<number>("ensure_site_server_cmd", { siteId }),
  getExtraSearchEntries: (siteId: string) =>
    invoke<{ site: string; title: string; path: string; category?: string; preview?: string }[]>(
      "get_extra_search_entries",
      { siteId },
    ),
  installOrUpdate: (args: { siteId: string }) =>
    invoke<{ status: string; site_id: string; commit?: string; message?: string }>(
      "install_or_update_from_github",
      { siteId: args.siteId },
    ),
  deleteDocpack: (siteId: string) => invoke<string>("delete_docpack", { siteId }),
  checkAppUpdate: () =>
    invoke<{
      current_version?: string;
      target_version?: string;
      update_available?: boolean;
      notes?: string;
      asset?: string;
    } | null>("check_app_update"),
  selfUpdateApp: () => invoke<string>("self_update_app"),
  getSystemTheme: () => invoke<"light" | "dark">("get_system_theme"),
  downloadProgress: (handler: (p: DownloadProgressPayload) => void) =>
    listen<DownloadProgressPayload>("docpack-progress", (e) => handler(e.payload)),
  themeChanged: (handler: (t: "light" | "dark") => void) =>
    listen<string>("tauri://theme-changed", (e) =>
      handler(String(e.payload).toLowerCase() === "dark" ? "dark" : "light"),
    ),
};
