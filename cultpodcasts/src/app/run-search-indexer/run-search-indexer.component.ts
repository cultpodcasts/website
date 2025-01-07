import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from './../../environments/environment';
import { IndexerState } from '../indexer-state.interface';

@Component({
  selector: 'app-run-search-indexer',
  imports: [MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './run-search-indexer.component.html',
  styleUrl: './run-search-indexer.component.sass'
})
export class RunSearchIndexerComponent {
  constructor(private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<RunSearchIndexerComponent>) {
  }

  ngOnInit() {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'admin'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const episodeEndpoint = new URL(`searchindex/run`, environment.api).toString();
      this.http.post<IndexerState>(episodeEndpoint, {}, { headers: headers })
        .subscribe(
          {
            next: resp => {
              console.log(resp);
              this.close({ indexerState: resp });
            },
            error: e => {
              console.error(e);
              const indexerState = e.error as IndexerState;
              if (indexerState?.state) {
                this.close({ indexerState: indexerState });
              } else {
                this.close({ message: "An error occurred running search-index" });
              }
            }
          }
        )
    }).catch(x => {
      console.error(x);
      this.close({ message: "An error occurred getting api-token" });
    });
  }

  close(res: { message?: string, indexerState?: IndexerState }) {
    this.dialogRef.close(res);
  }
}
