import { SubmitUrlOriginResponse } from "./submit-url-origin-response.interface"

export interface SubmitDialogResponse {
    submitted: boolean,
    originResponse: SubmitUrlOriginResponse | undefined
}