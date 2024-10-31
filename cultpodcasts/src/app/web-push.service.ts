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

  async subscribeToNotifications(): Promise<boolean> {
    var req = { name: "push", userVisibleOnly: true };
    var result = await navigator.permissions.query(req as PermissionDescriptor)
    if (result.state != "denied") {
      if (result.state == "granted") {
        console.log("pre determineIfSubscriptionNeeded")
        await this.determineIfSubscriptionNeeded()
      } else if (result.state == "prompt") {
        // result.onchange = async () => {
        //   console.log("pre requestSubscription - 1")
        //   await this.determineIfSubscriptionNeeded();
        // }
        console.log("pre requestSubscription - 2")
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
      console.log(error);
    }
    if (existingSubscription == null) {
      console.log("pre requestSubscription - 3")
      return await this.requestSubscription();
    }
    return true;
  }

  private async requestSubscription(): Promise<boolean> {
    console.log("requestSubscription")
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
      console.error("Could not subscribe to notifications");
      console.log(error);
      try {
        await this.swPush.unsubscribe();
        console.log("subscription unsubscribed");
      } catch (unsubError) {
        console.log("unable to unsubscribe")
      }
      var req = await Notification.requestPermission();
      if (req == "default") {
        return false;
      }
    }
    return true;
  }
}
