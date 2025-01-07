import { SubmitDiscoveryItemResult } from "./submit-discovery-item-result.interface";

export interface SubmitDiscoveryResponse {
    message: string;
    errorsOccurred: boolean;
    results: SubmitDiscoveryItemResult[];
}