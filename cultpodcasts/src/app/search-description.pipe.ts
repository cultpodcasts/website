import { Pipe, PipeTransform } from '@angular/core';
import { formatSearchDescription } from './search-description';

@Pipe({
  name: 'searchDescription',
  standalone: true
})
export class SearchDescriptionPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatSearchDescription(value);
  }
}
