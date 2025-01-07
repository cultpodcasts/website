import { Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { ReplaySubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthServiceWrapper {
    roles: ReplaySubject<string[]> = new ReplaySubject<string[]>(1);
    isSignedIn: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);

    constructor(public authService: AuthService) {
        if (authService.user$) {
            let existingRoles: string[] = [];
            authService.user$.subscribe(user => {
                if (user && user["https://api.cultpodcasts.com/roles"]) {
                    var newRoles = user["https://api.cultpodcasts.com/roles"];
                    if (existingRoles.length != newRoles.length || !existingRoles.every(item => newRoles.includes(item))) {
                        existingRoles = newRoles;
                        this.roles.next(newRoles);
                        localStorage.setItem("hasLoggedIn", "true");
                    }
                }
            });
            authService.isAuthenticated$.subscribe(isAuthenticated => {
                this.isSignedIn.next(isAuthenticated);
            });
        }
    }
}