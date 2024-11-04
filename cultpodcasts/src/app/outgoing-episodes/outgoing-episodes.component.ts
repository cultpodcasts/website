import { Component } from '@angular/core';
import { OutgoingEpisodesApiComponent } from '../outgoing-episodes-api/outgoing-episodes-api.component';

@Component({
  selector: 'app-outgoing-episodes',
  standalone: true,
  imports: [
    OutgoingEpisodesApiComponent
  ],
  templateUrl: './outgoing-episodes.component.html',
  styleUrl: './outgoing-episodes.component.sass'
})
export class OutgoingEpisodesComponent { }
