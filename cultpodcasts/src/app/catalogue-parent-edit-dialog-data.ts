import { CatalogueHub } from "./catalogue-hub";

/** Target for the news outlet / TV show editor. The opener picks the dialog from `hub`. */
export interface EditCatalogueParentDialogData {
  hub: CatalogueHub;
  name: string;
  highlightDefaultLanguage?: boolean;
}

export interface EditCatalogueParentDialogResponse {
  updated?: boolean;
  noChange?: boolean;
  closed?: boolean;
}
