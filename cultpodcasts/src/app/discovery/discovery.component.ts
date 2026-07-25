import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DiscoveryApiComponent } from '../discovery-api/discovery-api.component';

@Component({
    selector: 'app-discovery',
    templateUrl: './discovery.component.html',
    styleUrls: ['./discovery.component.sass'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    // Auth-gated + client-fetched: skip hydration so FakeAuth SSR shells cannot
    // mismatch the post-Auth0 client tree (hasAttribute-on-null crashes).
    host: { ngSkipHydration: 'true' },
    imports: [
        DiscoveryApiComponent
    ]
})
export class DiscoveryComponent { }
