import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { environment } from './../environments/environment';
import { firstValueFrom } from 'rxjs';
import { PushSubscriptionService } from './push-subscription.service';

@Injectable({
  providedIn: 'root'
})
export class WebPushService {
  constructor(private swPush: SwPush,
    private notificationService: PushSubscriptionService
  ) {  }

  async subscribeToNotifications(): Promise<boolean> {
    var req = { name: "push", userVisibleOnly: true };
    var result = await navigator.permissions.query(req as PermissionDescriptor)
    if (result.state != "denied") {
      if (result.state == "granted") {
        await this.determineIfSubscriptionNeeded()
      } else if (result.state == "prompt") {
        return await this.requestSubscription();
      }
    }
    return true;
  }

  private async determineIfSubscriptionNeeded(): Promise<boolean> {
    let existingSubscription: PushSubscription | null = null;
    try {
      existingSubscription = await firstValueFrom(this.swPush.subscription);
    } catch (error) {
      console.error(error);
    }
    if (existingSubscription == null) {
      return await this.requestSubscription();
    }
    return true;
  }

  private async requestSubscription(): Promise<boolean> {
    try {
      const sub = await this.swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey
      })
      const res = await this.notificationService.addPushSubscriber(sub);
      if (!res) {
        console.error("Failed to register subscription")
        try {
          await this.swPush.unsubscribe();
        } catch (error) {
          console.error("Failure to unsubscribe subscription")
          console.error(error);
        }
      }
    } catch (error) {
      console.error("Could not request subscription");
      console.error(error);
      try {
        await this.swPush.unsubscribe();
        console.warn("subscription unsubscribed");
      } catch (unsubError) {
        console.error("unable to unsubscribe")
      }
      var req = await Notification.requestPermission();
      if (req == "default") {
        return false;
      }
    }
    return true;
  }
}
