import { Injectable } from '@angular/core';
import { SiteData } from './site-data.interface';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SiteService {
    private _siteData: SiteData = {
        query: "",
        filter: null,
        podcast: null,
        subject: null
    };

    setFilter(filter: string | null) {
        this._siteData.filter = filter;
    }

    private messageSource = new BehaviorSubject(this._siteData);
    currentSiteData = this.messageSource.asObservable();

    setQuery(query: string | null) {
        this._siteData.query = query;
        this.messageSource.next(this._siteData);
    }

    setPodcast(podcast: string | null) {
        this._siteData.podcast = podcast;
        this.messageSource.next(this._siteData);
    }

    setSubject(subject: string | null) {
        this._siteData.subject = subject;
        this.messageSource.next(this._siteData);
    }

    getSiteData(): SiteData {
        return this._siteData;
    }
}