import { Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthServiceWrapper {
    roles: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
    isSignedIn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

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