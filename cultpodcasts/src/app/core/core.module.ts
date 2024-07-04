import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom, isObservable, Observable } from 'rxjs';

declare const Zone: any;

@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ]
})
export class CoreModule {

  async waitFor<T>(prom: Promise<T> | Observable<T>): Promise<T> {
    if (isObservable(prom)) {
      prom = firstValueFrom(prom);
    }
    const macroTask = Zone.current
      .scheduleMacroTask(
        `WAITFOR-${Math.random()}`,
        () => { },
        {},
        () => { }
      );
    return prom.then((p: T) => {
      macroTask.invoke();
      return p;
    });
  }
}
