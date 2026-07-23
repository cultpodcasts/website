import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DiscoveryApiComponent } from '../discovery-api/discovery-api.component';

@Component({
    selector: 'app-discovery',
    templateUrl: './discovery.component.html',
    styleUrls: ['./discovery.component.sass'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DiscoveryApiComponent
    ]
})
export class DiscoveryComponent { }
