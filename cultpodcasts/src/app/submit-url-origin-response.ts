export interface SubmitDialogResponse {
    submitted: boolean,
    originResponse: SubmitUrlOriginResponse | undefined
}

export interface SubmitUrlOriginResponse {
    success?: SubmitUrlOriginSuccessResponse | undefined,
    error: string | undefined | null
}

export interface SubmitUrlOriginSuccessResponse {
    episode: string,
    episodeId?: string | undefined,
    podcast: string
}

