import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ObscureCult } from '../obscure-cults';
import { displayCatalogName } from '../display-catalog-name';

@Component({
  selector: 'app-homepage-discover-rail',
  imports: [RouterLink],
  templateUrl: './homepage-discover-rail.component.html',
  styleUrl: './homepage-discover-rail.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomepageDiscoverRailComponent {
  readonly cults = input.required<ObscureCult[]>();

  protected readonly displayCatalogName = displayCatalogName;
}
