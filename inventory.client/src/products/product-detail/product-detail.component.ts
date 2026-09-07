import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { InventoryItemView } from '../inventory-item.model';

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink],
  templateUrl: './product-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailComponent implements OnInit {

  private readonly titleService = inject(Title);
  private readonly route = inject(ActivatedRoute);

  readonly product = signal<InventoryItemView | null>(null);

  ngOnInit(): void {
    const product = this.route.snapshot.data['product'] as InventoryItemView;
    this.titleService.setTitle(`Inventory | ${product.name ?? 'Product'}`);
    this.product.set(product);
  }
}
