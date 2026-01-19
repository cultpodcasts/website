export enum SearchIndexerState {
    EpisodeNotFound = "EpisodeNotFound",
    EpisodeIdConflict= "EpisodeIdConflict",
    NoDocuments= "NoDocuments",
    Executed = "Executed",
    Failure = "Failure",
    TooManyRequests = "TooManyRequests",
    AlreadyRunning = "AlreadyRunning",
    Unknown = "Unknown"
}