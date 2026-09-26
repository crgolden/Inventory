import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ButtonPrimaryDirective, PageContainerDirective } from '@crgolden/modules/primitives';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert } from '@ng-icons/lucide';

@Component({
  selector: 'app-catalog-not-found',
  imports: [RouterLink, NgIcon, ButtonPrimaryDirective, PageContainerDirective],
  templateUrl: './catalog-not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideCircleAlert })],
})
export class CatalogNotFoundComponent {

  constructor() {
    inject(Title).setTitle('Inventory | Product Not Found');
  }
}
