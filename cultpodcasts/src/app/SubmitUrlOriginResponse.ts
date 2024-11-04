import { SubmitUrlOriginSuccessResponse } from "./SubmitUrlOriginSuccessResponse";

export interface SubmitUrlOriginResponse {
    success?: SubmitUrlOriginSuccessResponse | undefined;
    error: string | undefined | null;
}
