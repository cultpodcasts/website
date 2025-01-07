export interface IndexerState {
    state: "Executed" | "Failure" | "TooManyRequests" | "AlreadyRunning";
    nextRun?: string;
    lastRan?: string;
}