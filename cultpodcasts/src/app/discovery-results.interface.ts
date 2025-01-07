import { DiscoveryResult } from "./discovery-result.interface";

export interface DiscoveryResults {
    ids: string[];
    results: DiscoveryResult[]
}