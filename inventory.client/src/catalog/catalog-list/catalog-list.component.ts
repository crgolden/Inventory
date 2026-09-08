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
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, Subject, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService, CatalogSortColumn } from '../catalog.service';
import { CatalogProduct } from '../catalog-product.model';

const PAGE_SIZE = 20;

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

  readonly items = signal<CatalogProduct[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly orderBy = signal<CatalogSortColumn>('Name');
  readonly orderDir = signal<'asc' | 'desc'>('asc');
  readonly page = signal(1);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly showingFrom = computed(() =>
    this.items().length === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1
  );
  readonly showingTo = computed(() => (this.page() - 1) * PAGE_SIZE + this.items().length);

  private readonly search$ = new Subject<string>();
  private readonly load$ = new Subject<void>();

  ngOnInit(): void {
    this.titleService.setTitle('Inventory | Catalog');

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.page.set(1);
      this.load$.next();
    });

    this.load$.pipe(
      switchMap(() => {
        this.loading.set(true);
        this.error.set(null);
        return this.catalogService.getAll({
          search: this.searchTerm(),
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

    this.load$.next();
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  sortBy(column: CatalogSortColumn): void {
    if (this.orderBy() === column) {
      this.orderDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.orderBy.set(column);
      this.orderDir.set('asc');
    }
    this.page.set(1);
    this.load$.next();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.load$.next();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.load$.next();
    }
  }
}
