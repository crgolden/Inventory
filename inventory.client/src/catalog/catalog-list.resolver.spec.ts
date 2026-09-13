import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { CATALOG_PAGE_SIZE, catalogListResolver } from './catalog-list.resolver';
import { CatalogPage, CatalogParams, CatalogService } from './catalog.service';

const PAGE = { items: [], total: 0 } as CatalogPage;

function run(
  service: Partial<CatalogService>,
  queryParams: Record<string, string> = {},
): Promise<CatalogPage | null> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: CatalogService, useValue: service }] });

  return new Promise((resolvePromise) => {
    TestBed.runInInjectionContext(() => {
      (
        catalogListResolver({ queryParams } as never, {} as never) as Observable<CatalogPage | null>
      ).subscribe(resolvePromise);
    });
  });
}

describe('catalogListResolver', () => {
  it('resolves the first page the catalog list renders', async () => {
    const result = await run({ getAll: () => of(PAGE) });

    expect(result).toBe(PAGE);
  });

  it('asks for the same page size the component pages by, so the two cannot drift', async () => {
    let received: CatalogParams | undefined;

    await run({
      getAll: (params: CatalogParams) => {
        received = params;
        return of(PAGE);
      },
    });

    expect(received?.pageSize).toBe(CATALOG_PAGE_SIZE);
    expect(received?.page).toBe(1);
  });

  it('server-renders the page the URL asks for, so a shared deep link is not page one', async () => {
    let received: CatalogParams | undefined;

    await run(
      {
        getAll: (params: CatalogParams) => {
          received = params;
          return of(PAGE);
        },
      },
      { page: '3', orderBy: 'Brand', orderDir: 'desc', q: 'dyson' },
    );

    expect(received?.page).toBe(3);
    expect(received?.orderBy).toBe('Brand');
    expect(received?.orderDir).toBe('desc');
    expect(received?.search).toBe('dyson');
  });

  it('ignores a page that is not a positive whole number', async () => {
    let received: CatalogParams | undefined;

    await run(
      {
        getAll: (params: CatalogParams) => {
          received = params;
          return of(PAGE);
        },
      },
      { page: '-4' },
    );

    expect(received?.page).toBe(1);
  });

  it('degrades to null so the route activates and the page reports the failure', async () => {
    const result = await run({ getAll: () => throwError(() => new Error('boom')) });

    expect(result).toBeNull();
  });
});
