import { Pipe, PipeTransform } from '@angular/core';
import { DiscoveryResult } from "./discovery-result.interface";

@Pipe({
  name: 'discoveryItemFilter',
  pure: false,
  standalone: true
})

export class DiscoveryItemFilter implements PipeTransform {
  transform(items: DiscoveryResult[], filter: { isFocused: boolean }): any {
    if (!items || !filter) {
      return items;
    }
    if (filter.isFocused) { }
    return items.filter(item => item.isFocused == filter.isFocused);
  }
}
