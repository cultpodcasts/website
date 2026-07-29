export type PageDetailsImageAspect = "wide" | "square";

export interface IPageDetails {
    title?: string,
    description?: string,
    releaseDate?: string,
    duration?: string,
    /** Absolute HTTPS episode art for og:image / twitter:image. */
    image?: string,
    /** YouTube / BBC iPlayer / Internet Archive → wide; Spotify/Apple/BBC Sounds → square. */
    imageAspect?: PageDetailsImageAspect
}
