import { Injectable } from '@angular/core';
import { ISiteData } from './ISiteData';
import { BehaviorSubject } from 'rxjs';
 
@Injectable()
export class SiteService {
     private _siteData:ISiteData= {
        query: "",
        filter: null
    };

    setFilter(filter: string|null) {
        this._siteData.filter= filter;
    }
    
    private messageSource = new BehaviorSubject(this._siteData);
    currentSiteData = this.messageSource.asObservable();
 
    setQuery(query: string | null) {
        this._siteData.query= query;
        this.messageSource.next(this._siteData);
    }
 
    getSiteData(): ISiteData {
        return this._siteData;
    }
}