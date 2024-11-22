import { Component } from '@angular/core';
import { HomepageApiComponent } from '../homepage-api/homepage-api.component';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.sass'],
    imports: [
        HomepageApiComponent
    ]
})
export class HomeComponent { }
