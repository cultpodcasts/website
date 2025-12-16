export class BBCServiceResolver {
    static isIplayer(x: URL): boolean {
        return BBCServiceResolver.isBBC(x) && (x.pathname.startsWith("/iplayer/") || x.pathname.startsWith("/news/av-embeds/"));
    }

    static isBBC(x: URL): boolean {
        return x.host.endsWith("bbc.com") || x.host.endsWith("bbc.co.uk");
    }

    static isSounds(x: URL): boolean {
        return this.isBBC(x) && x.pathname.startsWith("/sounds/");
    }
}
