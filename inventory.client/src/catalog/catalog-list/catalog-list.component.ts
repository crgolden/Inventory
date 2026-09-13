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
import { catchError, debounceTime, distinctUntilChanged, EMPTY, Subject, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogPage, CatalogService, CatalogSortColumn } from '../catalog.service';
import { CatalogProduct } from '../catalog-product.model';
import {
  CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_SORT,
  catalogOrderByFrom,
  catalogOrderDirFrom,
  catalogPageFrom,
  catalogQueryKey,
  catalogSearchFrom,
} from '../catalog-query';

const PAGE_SIZE = CATALOG_PAGE_SIZE;

@Component({
  selector: 'app-catalog-list',
  imports: [RouterLink, FormsModule],
  templateUrl: './catalog-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent implements OnInit {

  private readonly titleService = inject(Title);
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly items = signal<CatalogProduct[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly orderBy = signal<CatalogSortColumn>(DEFAULT_CATALOG_SORT);
  readonly orderDir = signal<'asc' | 'desc'>('asc');
  readonly page = signal(1);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly showingFrom = computed(() =>
    this.items().length === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1
  );
  readonly showingTo = computed(() => (this.page() - 1) * PAGE_SIZE + this.items().length);
  readonly hasPrevPage = computed(() => this.page() > 1);
  readonly hasNextPage = computed(() => this.page() < this.totalPages());

  private readonly search$ = new Subject<string>();
  private readonly load$ = new Subject<void>();
  private loadedKey = catalogQueryKey({});

  ngOnInit(): void {
    this.titleService.setTitle('Inventory | Catalog');

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.writeListStateToUrl({ q: term || null }, true);
    });

    this.load$.pipe(
      switchMap(() => {
        this.loading.set(true);
        this.error.set(null);
        return this.catalogService.getAll({
          search: this.searchTerm() || undefined,
          orderBy: this.orderBy(),
          orderDir: this.orderDir(),
          page: this.page(),
          pageSize: PAGE_SIZE,
        }).pipe(
          catchError((err: HttpErrorResponse) => {
            this.error.set(`Could not load the catalog (${err.status}). Please try again.`);
            this.items.set([]);
            this.total.set(0);
            this.loading.set(false);
            return EMPTY;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      this.items.set(result.items);
      this.total.set(result.total);
      this.loading.set(false);
    });

    this.loadedKey = catalogQueryKey(this.route.snapshot.queryParams);

    const resolved = (this.route.snapshot.data['catalog'] ?? null) as CatalogPage | null;
    if (resolved === null) {
      this.error.set('Could not load the catalog. Please try again.');
    } else {
      this.items.set(resolved.items);
      this.total.set(resolved.total);
    }

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.readControlsFrom(params);
      const key = catalogQueryKey(params);
      if (key === this.loadedKey) {
        return;
      }
      this.loadedKey = key;
      this.load$.next();
    });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  sortParams(column: CatalogSortColumn): Params {
    const orderDir = this.orderBy() === column && this.orderDir() === 'asc' ? 'desc' : 'asc';
    return {
      orderBy: column === DEFAULT_CATALOG_SORT ? null : column,
      orderDir: orderDir === 'asc' ? null : orderDir,
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
