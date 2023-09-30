import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {Router} from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})

export class AppComponent {
  constructor(private http: HttpClient, private router: Router) {}

  search= (input:HTMLInputElement) => {
    input.blur();
    this.router.navigate(['/search/'+input.value]);
    input.value="";
  };
}
