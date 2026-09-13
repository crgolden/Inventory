import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { productListResolver } from './product-list.resolver';
import { InventoryItemView } from './inventory-item.model';
import { ProductService } from './product.service';

const ITEMS = [] as InventoryItemView[];

function run(
  service: Partial<ProductService>,
  queryParams: Record<string, string> = {}
): Promise<InventoryItemView[] | null> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: ProductService, useValue: service }] });

  return new Promise(resolvePromise => {
    TestBed.runInInjectionContext(() => {
      (
        productListResolver({ queryParams } as never, {} as never) as Observable<InventoryItemView[] | null>
      ).subscribe(resolvePromise);
    });
  });
}

describe('productListResolver', () => {
  it('resolves the list the products page renders', async () => {
    const result = await run({ getAll: () => of(ITEMS) });

    expect(result).toBe(ITEMS);
  });

  it('asks for the whole list when the URL names no search term', async () => {
    let received: string | undefined = 'not-called';

    await run({
      getAll: (search?: string) => {
        received = search;
        return of(ITEMS);
      }
    });

    expect(received).toBeUndefined();
  });

  it('resolves the filtered list a shared link asks for, rather than the unfiltered one', async () => {
    let received: string | undefined = 'not-called';

    await run(
      {
        getAll: (search?: string) => {
          received = search;
          return of(ITEMS);
        }
      },
      { q: 'dyson' }
    );

    expect(received).toBe('dyson');
  });

  it('degrades to null so the route activates and the page reports the failure', async () => {
    const result = await run({ getAll: () => throwError(() => new Error('boom')) });

    expect(result).toBeNull();
  });
});
