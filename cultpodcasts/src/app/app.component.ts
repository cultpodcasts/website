import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {MatAccordion, MatExpansionModule} from '@angular/material/expansion';
import { Observable, catchError, map, of } from 'rxjs';
import { Injectable } from '@angular/core';
import { UrlTree } from '@angular/router';
import { IEpisode } from './IEpisode';
import { ILatest } from './ILatest';

export const initializeAppFactory = (comp: AppComponent, httpClient: HttpClient): (() => Observable<any>) => {
  return () => comp.loadLatest();
};

@Injectable({
  providedIn: 'root',
})

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {
  constructor(private http: HttpClient) {}

  Latest: Observable<ILatest>= new Observable<ILatest>();
  Results: Observable<IEpisode[]> = new Observable<IEpisode[]>();

  private _createLatest(latest: any): ILatest {
    // cast all keys as are
    const _latest = { ...(<ILatest>latest) };
    return _latest;
  }
  private _createEpisodes(latest: any): Array<IEpisode> {
    // cast all keys as are
    const _latest = { ...(<IEpisode[]>latest) };
    return _latest;
  }

  loadLatest():Observable<boolean> {
    return this.http.get("https://api.cultpodcasts.com/api/latest").pipe(
      map((response) => {
        // do something to reflect into local model
        const _latest= this._createLatest(response);
        this.Latest = of(_latest);
        //this.Results= of(_latest.latest);
        return true;
      }),
      catchError((error) => {
        // if in error, set default fall back from environment
        return of(false);
      })
    );
  }

  title = 'cultpodcasts';

  search= (searchTerm:string) => {
    let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(searchTerm);
    this.http.get(url)
      .subscribe(data => {
        this.Results= of(this._createEpisodes(data));
      });
  };
}
