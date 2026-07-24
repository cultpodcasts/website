import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HomepageApiComponent } from '../homepage-api/homepage-api.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.sass'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HomepageApiComponent,
        SiteLoadingComponent
    ]
})
export class HomeComponent { }
