import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule, MatMenuItem } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, isPlatformBrowser, NgClass, NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { Title } from '@angular/platform-browser';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { SiteService } from '../SiteService';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { SetNumberOfDaysComponent } from '../set-number-of-days/set-number-of-days.component';
import { DeleteEpisodeDialogComponent } from '../delete-episode-dialog/delete-episode-dialog.component';
import { OutgoingEpisodesApiComponent } from '../outgoing-episodes-api/outgoing-episodes-api.component';


@Component({
  selector: 'app-episodes',
  standalone: true,
  imports: [
    OutgoingEpisodesApiComponent
  ],
  templateUrl: './outgoing-episodes.component.html',
  styleUrl: './outgoing-episodes.component.sass'
})
export class OutgoingEpisodesComponent {

}
