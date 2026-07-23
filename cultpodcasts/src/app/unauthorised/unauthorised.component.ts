import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
    selector: 'app-unauthorised',
    templateUrl: './unauthorised.component.html',
    styleUrls: ['./unauthorised.component.sass'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class UnauthorisedComponent { }
