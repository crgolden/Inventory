import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { CatalogProduct } from '../catalog-product.model';

@Component({
  selector: 'app-catalog-detail',
  imports: [RouterLink],
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
