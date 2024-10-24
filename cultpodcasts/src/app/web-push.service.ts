import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { PushSubscriptiionService } from './PushSubscriptiionService';

@Injectable({
  providedIn: 'root'
})
export class WebPushService {
readonly VAPID_PUBLIC_KEY = "BKx7EI56y8biaGTAo_bagpNPTR9f4AkHqtuUoHaRM7nNduX5ExbAHO74-YAKa6_c9wLVYWHZklhrpPl6Bbx_3Is"
  constructor(private swPush: SwPush,
    private notificationService: PushSubscriptiionService
  ) { }

  subscribeToNotifications() {

    this.swPush.requestSubscription({
        serverPublicKey: this.VAPID_PUBLIC_KEY
    })
    .then(sub => this.notificationService.addPushSubscriber(sub).subscribe())
    .catch(err => console.error("Could not subscribe to notifications", err));
}
}
