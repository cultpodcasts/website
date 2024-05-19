import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class JsonUrlInterceptor implements HttpInterceptor {

  private _urlFormat = /^https?\:\/\/.*$/;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(map((val: HttpEvent<any>) => {
      if (val instanceof HttpResponse) {
        const body = val.body;
        this.convert(body);
      }
      return val;
    }));
  }

  isUrl(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      if (this._urlFormat.test(value) && typeof(value)==="string") {
        try {
          new URL(value);
          return true;
        } catch (error) {
          return false;
        }
      }
    } return false;
  }
  
  convert(body: any) {
    if (body === null || body === undefined) {
      return body;
    }
    if (typeof body !== 'object') {
      return body;
    }
    for (const key of Object.keys(body)) {
      const value = body[key];
      if (this.isUrl(value)) {
        body[key] = new URL(value);
      } else if (typeof value === 'object') {
        this.convert(value);
      }
    }
  }
}