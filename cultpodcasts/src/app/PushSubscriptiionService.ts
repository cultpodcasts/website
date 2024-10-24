import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class PushSubscriptiionService {
    constructor() { }


    addPushSubscriber(sub: PushSubscription): Observable<any> {
    console.log(sub);
    throw new Error('Method not implemented.');
  }

}
