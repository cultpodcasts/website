import { Pipe, PipeTransform } from '@angular/core';
import { formatSearchDescription, SearchEngine } from './search-description';

@Pipe({
  name: 'searchDescription',
  standalone: true
})
export class SearchDescriptionPipe implements PipeTransform {
  transform(value: string | null | undefined, engine?: SearchEngine | null): string {
    return formatSearchDescription(value, engine);
  }
}
