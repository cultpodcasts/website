import { Pipe, PipeTransform } from '@angular/core';
import { formatSearchDescription } from './search-description';
import type { SearchEngine } from './search-engine.enum';

@Pipe({
  name: 'searchDescription',
  standalone: true
})
export class SearchDescriptionPipe implements PipeTransform {
  transform(value: string | null | undefined, engine?: SearchEngine | null): string {
    return formatSearchDescription(value, engine);
  }
}
