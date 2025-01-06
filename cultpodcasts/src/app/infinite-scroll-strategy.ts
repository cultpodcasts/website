export class InfiniteScrollStrategy {
    public getYThreshold(page: number): number {
        return 1000;
    }

    public getTake(page: number): number {
        if (page > 1) {
            return 100;
        }
        return 10;
    }

    public getSkip(page: number): number {
        let total = 0;
        for (let i = 1; i < page; i++) {
            total += this.getTake(i);
        }
        return total
    }
}
