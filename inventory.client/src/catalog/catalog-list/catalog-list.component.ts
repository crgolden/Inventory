import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ButtonGhostSmallDirective, ButtonSecondaryDirective, PageContainerDirective } from '@crgolden/modules/primitives';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLayoutGrid, lucideSearch } from '@ng-icons/lucide';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { CatalogPage } from '../catalog.service';
import { CatalogSortColumn, CatalogSortColumns } from '../catalog-api';
import { CatalogSortDirection, CatalogSortDirections } from '../catalog-sort-directions';
import { CatalogProduct } from '../catalog-product.model';
import { viewProductId } from '../../view-product-ids';
import { catalogNameId, catalogRowId } from '../../catalog-row-ids';
import {
  CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_SORT,
  catalogOrderByFrom,
  catalogOrderDirFrom,
  catalogPageFrom,
  catalogSearchFrom,
} from '../catalog-query';

const PAGE_SIZE = CATALOG_PAGE_SIZE;

export const CATALOG_LOAD_ERROR = 'Could not load the catalog. Please try again.';

@Component({
  selector: 'app-catalog-list',
  imports: [RouterLink, FormsModule, NgIcon, ButtonGhostSmallDirective, ButtonSecondaryDirective, PageContainerDirective],
  templateUrl: './catalog-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideLayoutGrid, lucideSearch })],
})
export class CatalogListComponent implements OnInit {

  private readonly titleService = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly items = signal<CatalogProduct[]>([]);
  readonly total = signal(0);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly orderBy = signal<CatalogSortColumn>(DEFAULT_CATALOG_SORT);
  readonly orderDir = signal<CatalogSortDirection>(CatalogSortDirections.asc);
  readonly page = signal(1);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly showingFrom = computed(() =>
    this.items().length === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1
  );
  readonly showingTo = computed(() => (this.page() - 1) * PAGE_SIZE + this.items().length);
  readonly hasPrevPage = computed(() => this.page() > 1);
  readonly hasNextPage = computed(() => this.page() < this.totalPages());
  protected readonly sortColumns = CatalogSortColumns;
  protected readonly sortDirections = CatalogSortDirections;
  readonly prevPageId = 'catalog-prev-page';
  protected readonly viewProductId = viewProductId;
  protected readonly catalogRowId = catalogRowId;
  protected readonly catalogNameId = catalogNameId;
  readonly nextPageId = 'catalog-next-page';

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.titleService.setTitle('Inventory | Catalog');

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.writeListStateToUrl({ q: term || null }, true);
    });

    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      const resolved = (data['catalog'] ?? null) as CatalogPage | null;
      if (resolved === null) {
        this.error.set(CATALOG_LOAD_ERROR);
        this.items.set([]);
        this.total.set(0);
        return;
      }
      this.error.set(null);
      this.items.set(resolved.items);
      this.total.set(resolved.total);
    });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.readControlsFrom(params);
    });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  sortParams(column: CatalogSortColumn): Params {
    const orderDir = this.orderBy() === column && this.orderDir() === CatalogSortDirections.asc
      ? CatalogSortDirections.desc
      : CatalogSortDirections.asc;
    return {
      orderBy: column === DEFAULT_CATALOG_SORT ? null : column,
      orderDir: orderDir === CatalogSortDirections.asc ? null : orderDir,
      page: null,
    };
  }

  pageParams(page: number): Params {
    return { page: page <= 1 ? null : page };
  }

  private readControlsFrom(params: Params): void {
    const search = catalogSearchFrom(params);
    if (this.searchTerm() !== search) {
      this.searchTerm.set(search);
    }
    this.orderBy.set(catalogOrderByFrom(params));
    this.orderDir.set(catalogOrderDirFrom(params));
    this.page.set(catalogPageFrom(params));
  }

  private writeListStateToUrl(queryParams: Params, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...queryParams, page: null },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
