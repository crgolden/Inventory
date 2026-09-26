import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  ButtonGhostSmallDirective,
  ButtonPrimaryDirective,
  CardDirective,
  PageContainerDirective,
} from '@crgolden/modules/primitives';
import { CatalogProduct } from '../catalog-product.model';

@Component({
  selector: 'app-catalog-detail',
  imports: [RouterLink, ButtonGhostSmallDirective, ButtonPrimaryDirective, CardDirective, PageContainerDirective],
  templateUrl: './catalog-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailComponent implements OnInit {

  private readonly titleService = inject(Title);
  private readonly route = inject(ActivatedRoute);

  readonly product = signal<CatalogProduct | null>(null);

  ngOnInit(): void {
    const product = this.route.snapshot.data['product'] as CatalogProduct;
    this.titleService.setTitle(`Inventory | ${product.name ?? 'Product'}`);
    this.product.set(product);
  }
}
