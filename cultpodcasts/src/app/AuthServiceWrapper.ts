import { Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Injectable({ providedIn: 'root' })
export class AuthServiceWrapper {
    constructor(public authService: AuthService) {
    }
}