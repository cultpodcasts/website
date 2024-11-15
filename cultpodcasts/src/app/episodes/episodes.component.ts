import { Component } from '@angular/core';
import { EpisodesApiComponent } from '../episodes-api/episodes-api.component';

@Component({
  selector: 'app-episodes',
  standalone: true,
  imports: [
    EpisodesApiComponent
  ],
  templateUrl: './episodes.component.html',
  styleUrl: './episodes.component.sass'
})
export class EpisodesComponent { }
