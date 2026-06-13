import { Pipe, PipeTransform } from '@angular/core';
import { DiscoveryResult } from "./discovery-result.interface";

@Pipe({
  name: 'discoveryItemFilter',
  pure: false,
  standalone: true
})

export class DiscoveryItemFilter implements PipeTransform {
  transform(items: DiscoveryResult[], filter: { isFocused?: boolean; autoHidden?: boolean }): DiscoveryResult[] {
    if (!items || !filter) {
      return items;
    }
    return items.filter(item => {
      if (filter.autoHidden !== undefined && item.autoHidden !== filter.autoHidden) {
        return false;
      }
      if (filter.isFocused !== undefined && item.isFocused !== filter.isFocused) {
        return false;
      }
      return true;
    });
  }
}
