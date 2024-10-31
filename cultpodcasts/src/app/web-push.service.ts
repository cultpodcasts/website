import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { PushSubscriptiionService } from './PushSubscriptiionService';
import { environment } from './../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebPushService {
  constructor(private swPush: SwPush,
    private notificationService: PushSubscriptiionService
  ) {
  }

  async subscribeToNotifications() {
    var req = { name: "push", userVisibleOnly: true };
    var result = await navigator.permissions.query(req as PermissionDescriptor)
    if (result.state != "denied") {
      if (result.state == "granted") {
        await this.determineIfSubscriptionNeeded()
      } else if (result.state == "prompt") {
        result.onchange = async () => {
          await this.requestSubscription();
        }
        await this.requestSubscription();
      }
    }
  }

  private async determineIfSubscriptionNeeded() {
    var existingSubscription = await firstValueFrom(this.swPush.subscription);
    if (existingSubscription == null) {
      await this.requestSubscription();
    }
  }

  private async requestSubscription() {
    try {
      const sub = await this.swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey
      })
      const res = await this.notificationService.addPushSubscriber(sub);
      if (!res) {
        try {
          await this.swPush.unsubscribe();
        } catch (error) {
          console.error("failure to unsubscribe subscription")
          console.error(error);
        }
      }
    } catch (error) {
      console.error("Could not subscribe to notifications", error);
      await this.swPush.unsubscribe();
      console.log("subscription unsubscribed");
    }
  }
}
