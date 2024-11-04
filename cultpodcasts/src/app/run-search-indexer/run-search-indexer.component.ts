import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from './../../environments/environment';

@Component({
  selector: 'app-run-search-indexer',
  standalone: true,
  imports: [MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './run-search-indexer.component.html',
  styleUrl: './run-search-indexer.component.sass'
})
export class RunSearchIndexerComponent {
  constructor(private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<RunSearchIndexerComponent>,
    @Inject(MAT_DIALOG_DATA) data: any) {
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
      this.http.post<any>(episodeEndpoint, {}, { headers: headers })
        .subscribe(
          {
            next: resp => {
              console.log(resp);
              if (resp.status) {
                this.close(resp.status);
              } else {
                this.close("Unknown state");
              }
            },
            error: e => {
              console.error(e);
              if (e.error.status) {
                this.close(e.error.status);
              } else {
                this.close("An error occurred running search-index");
              }
            }
          }
        )
    }).catch(x => {
      console.error(x);
      this.close("An error occurred getting api-token");
    });
  }

  close(message: string) {
    this.dialogRef.close(message);
  }
}
