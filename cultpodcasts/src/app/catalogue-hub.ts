import { CatalogueParentKind } from "./catalogue-parent-kind.enum";

/** The two parent hubs: /tv/{name} (TvShow) and /news/{name} (NewsOrganisation). */
export type CatalogueHub = "tv" | "news";

export function hubParentKind(hub: CatalogueHub): CatalogueParentKind {
  return hub === "news" ? CatalogueParentKind.NewsOrganisation : CatalogueParentKind.TvShow;
}

/** Menu / dialog noun: "News Outlet" or "TV Show". */
export function hubParentLabel(hub: CatalogueHub): string {
  return hub === "news" ? "News Outlet" : "TV Show";
}

/** Api Worker resource root for the parent: `/newsorganisation/…` or `/tvshow/…`. */
export function hubApiRoot(hub: CatalogueHub): "newsorganisation" | "tvshow" {
  return hub === "news" ? "newsorganisation" : "tvshow";
}

export function hubPathCommands(hub: CatalogueHub, name: string): string[] {
  return [`/${hub}`, name];
}
