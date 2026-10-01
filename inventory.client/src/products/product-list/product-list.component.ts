import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationStart, Params, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import {
  ButtonDangerDirective,
  ButtonGhostDangerSmallDirective,
  ButtonGhostSmallDirective,
  ButtonPrimaryDirective,
  ButtonSecondaryDirective,
  PageContainerDirective,
} from '@crgolden/modules/primitives';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePackage, lucideSearch } from '@ng-icons/lucide';
import { distinctUntilChanged, filter, map, Subject, switchMap, takeUntil, timer } from 'rxjs';
import { ProductService } from '../product.service';
import { InventoryItemView } from '../inventory-item.model';
import { PRODUCT_SEARCH_PARAM, productSearchFrom } from '../product-query';
import { AppPaths } from '../../app/app-paths';
import { viewProductId } from '../../view-product-ids';
import { confirmDeleteProductId, deleteProductId, editProductId, productNameId, productRowId } from '../../product-row-ids';

export const PRODUCT_LIST_LOAD_ERROR = 'Could not load your products. Please try again.';

@Component({
  selector: 'app-product-list',
  imports: [
    RouterLink,
    FormsModule,
    NgIcon,
    PageContainerDirective,
    ButtonPrimaryDirective,
    ButtonSecondaryDirective,
    ButtonGhostSmallDirective,
    ButtonGhostDangerSmallDirective,
    ButtonDangerDirective,
  ],
  templateUrl: './product-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePackage, lucideSearch })],
})
export class ProductListComponent implements OnInit {

  private readonly titleService = inject(Title);
  private readonly productService = inject(ProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly products = signal<InventoryItemView[]>([]);
  readonly confirmingDeleteId = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly error = signal<string | null>(null);
  protected readonly editSegment = AppPaths.edit;
  protected readonly viewProductId = viewProductId;
  protected readonly productRowId = productRowId;
  protected readonly productNameId = productNameId;
  protected readonly editProductId = editProductId;
  protected readonly deleteProductId = deleteProductId;
  protected readonly confirmDeleteProductId = confirmDeleteProductId;

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.titleService.setTitle('Inventory | My Products');

    const navigationStarts$ = this.router.events.pipe(filter(event => event instanceof NavigationStart));
    this.search$.pipe(
      switchMap(term => timer(300).pipe(takeUntil(navigationStarts$), map(() => term))),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.writeListStateToUrl({ [PRODUCT_SEARCH_PARAM]: term || null });
    });

    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      const resolved = (data['products'] ?? null) as InventoryItemView[] | null;
      this.error.set(resolved === null ? PRODUCT_LIST_LOAD_ERROR : null);
      this.products.set(resolved ?? []);
    });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const term = productSearchFrom(params);
      if (this.searchTerm() !== term) {
        this.searchTerm.set(term);
      }
    });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  private writeListStateToUrl(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  confirmDelete(id: string): void {
    this.confirmingDeleteId.set(id);
  }

  cancelDelete(): void {
    this.confirmingDeleteId.set(null);
  }

  delete(id: string): void {
    this.error.set(null);
    this.productService.delete(id).subscribe({
      next: () => {
        this.products.update(list => list.filter(p => p.id !== id));
        this.confirmingDeleteId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(`Delete failed (${err.status}). The product is still in your list.`);
        this.confirmingDeleteId.set(null);
      },
    });
  }
}
