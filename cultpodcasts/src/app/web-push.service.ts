import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { PushSubscriptiionService } from './PushSubscriptiionService';
import { environment } from './../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebPushService {
  constructor(private swPush: SwPush,
    private notificationService: PushSubscriptiionService
  ) { }

  async subscribeToNotifications() {

    this.swPush.requestSubscription({
      serverPublicKey: environment.vapidPublicKey
    })
      .then(async sub => (await this.notificationService.addPushSubscriber(sub)).subscribe())
      .catch(err => console.error("Could not subscribe to notifications", err));
  }
}
