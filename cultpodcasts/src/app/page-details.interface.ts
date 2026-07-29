export type PageDetailsImageAspect = "wide" | "square";

export interface IPageDetails {
    title?: string,
    description?: string,
    releaseDate?: string,
    duration?: string,
    /** Absolute HTTPS URL for og:image (Api `/og-image` with logo overlay when share art exists). */
    image?: string,
    /** YouTube / BBC iPlayer / Internet Archive → wide; Spotify/Apple/BBC Sounds → square. */
    imageAspect?: PageDetailsImageAspect
}
