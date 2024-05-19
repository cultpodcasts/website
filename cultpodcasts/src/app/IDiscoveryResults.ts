
export interface IDiscoveryResults {
    ids: string[];
    results: IDiscoveryResult[]
}


export interface IDiscoveryResult {
    url: URL|undefined;
    episodeName: string|undefined;
    showName: string|undefined;
    episodeDescription : string|undefined;
    released : Date;
    duration: string;
    subjects: string[];
    youTubeViews: number|undefined;
    youTubeChannelMembers: number|undefined;

}

