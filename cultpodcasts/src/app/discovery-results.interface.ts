import { DiscoveryResult } from "./discovery-result.interface";
import { DiscoveryAwaitingReview } from "./discovery-supervision/discovery-supervision.models";

export interface DiscoveryResults {
    ids: string[];
    results: DiscoveryResult[];
    hiddenCount: number;
    /** Reports held for supervisor review (PendingSupervisor). Their results are excluded. */
    awaitingReview?: DiscoveryAwaitingReview[];
}