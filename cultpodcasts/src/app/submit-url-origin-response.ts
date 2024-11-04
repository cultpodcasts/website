import { SubmitUrlOriginResponse } from "./SubmitUrlOriginResponse"

export interface SubmitDialogResponse {
    submitted: boolean,
    originResponse: SubmitUrlOriginResponse | undefined
}