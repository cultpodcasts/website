import { SubmitUrlOriginSuccessResponse } from "./submit-url-origin-success-response.interface";

export interface SubmitUrlOriginResponse {
    success?: SubmitUrlOriginSuccessResponse | undefined;
    error: string | undefined | null;
}
