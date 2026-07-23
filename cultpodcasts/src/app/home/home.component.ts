import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HomepageApiComponent } from '../homepage-api/homepage-api.component';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.sass'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HomepageApiComponent
    ]
})
export class HomeComponent { }
