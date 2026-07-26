export class InfiniteScrollStrategy {
    public getYThreshold(page: number): number {
        return 1000;
    }

    public getTake(page: number): number {
        if (page > 1) {
            return 100;
        }
        // First page must fill complete browse-grid rows (≈3–4 cols on desktop).
        // 10 left a short last row and could fail to fill a tall viewport (no scroll → no load-more).
        return 20;
    }

    public getSkip(page: number): number {
        let total = 0;
        for (let i = 1; i < page; i++) {
            total += this.getTake(i);
        }
        return total
    }
}
