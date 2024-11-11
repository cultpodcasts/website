import { Component, } from '@angular/core';
import { DiscoveryApiComponent } from '../discovery-api/discovery-api.component';

@Component({
  selector: 'app-discovery',
  templateUrl: './discovery.component.html',
  styleUrls: ['./discovery.component.sass'],
  standalone: true,
  imports: [
    DiscoveryApiComponent
  ],
  host: { ngSkipHydration: 'true' },
})
export class DiscoveryComponent { }
