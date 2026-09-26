import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  ButtonGhostSmallDirective,
  ButtonPrimaryDirective,
  ButtonSecondaryDirective,
  CardDirective,
  PageContainerDirective,
} from '@crgolden/modules/primitives';
import { InventoryItemView } from '../inventory-item.model';
import { AppPaths } from '../../app/app-paths';

export const ProductDetailActionLabels = {
  edit: 'Edit',
  findManual: 'Find Manual',
} as const;

@Component({
  selector: 'app-product-detail',
  imports: [
    RouterLink,
    PageContainerDirective,
    CardDirective,
    ButtonPrimaryDirective,
    ButtonSecondaryDirective,
    ButtonGhostSmallDirective,
  ],
  templateUrl: './product-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailComponent implements OnInit {

  private readonly titleService = inject(Title);
  private readonly route = inject(ActivatedRoute);

  readonly product = signal<InventoryItemView | null>(null);
  protected readonly editSegment = AppPaths.edit;
  protected readonly actionLabels = ProductDetailActionLabels;

  ngOnInit(): void {
    const product = this.route.snapshot.data['product'] as InventoryItemView;
    this.titleService.setTitle(`Inventory | ${product.name ?? 'Product'}`);
    this.product.set(product);
  }
}
