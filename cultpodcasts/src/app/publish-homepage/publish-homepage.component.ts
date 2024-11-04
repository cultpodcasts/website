import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from './../../environments/environment';

@Component({
  selector: 'app-publish-homepage',
  standalone: true,
  imports: [MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './publish-homepage.component.html',
  styleUrl: './publish-homepage.component.sass'
})
export class PublishHomepageComponent {
  constructor(private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<PublishHomepageComponent>,
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
      const episodeEndpoint = new URL(`publish/homepage`, environment.api).toString();
      this.http.post<any>(episodeEndpoint, {}, { headers: headers })
        .subscribe(
          {
            next: resp => {
              this.close("Homepage published");
            },
            error: e => {
              console.error(e);
              this.close("Failed to publish homepage");
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
