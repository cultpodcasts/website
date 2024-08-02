import { Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Injectable({ providedIn: 'root' })
export class AuthServiceWrapper {
    roles: string[] = [];

    constructor(public authService: AuthService) {
        if (authService.user$) {
            authService.user$.subscribe(user => {
                if (user && user["https://api.cultpodcasts.com/roles"]) {
                    this.roles = user["https://api.cultpodcasts.com/roles"]
                    localStorage.setItem("hasLoggedIn", "true");
                }
                else {
                    this.roles = [];
                }
            })
        }
    }
}