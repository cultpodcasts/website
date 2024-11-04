import { SubmitDiscoveryItemResult } from "./SubmitDiscoveryItemResult";

export interface SubmitDiscoveryResponse {
    message: string;
    errorsOccurred: boolean;
    results: SubmitDiscoveryItemResult[];
}