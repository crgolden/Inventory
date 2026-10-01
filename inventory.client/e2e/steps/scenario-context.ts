import type { Request } from '@playwright/test';
import type { CreatedProduct } from '../ci-products';
import type { ListedProduct } from '../product-list';

export class ScenarioContext {
  private ownedProductValue: ListedProduct | null = null;
  private catalogProductValue: CreatedProduct | null = null;
  private absentIdValue: string | null = null;
  private loginRequestValue: Promise<Request> | null = null;
  private readerPositionValue: number | null = null;

  get ownedProduct(): ListedProduct {
    if (this.ownedProductValue === null) {
      throw new Error('The scenario reads the product it owns before a Given created one.');
    }
    return this.ownedProductValue;
  }

  set ownedProduct(product: ListedProduct) {
    this.ownedProductValue = product;
  }

  get productLeftBehind(): ListedProduct | null {
    return this.ownedProductValue;
  }

  forgetOwnedProduct(): void {
    this.ownedProductValue = null;
  }

  get catalogProduct(): CreatedProduct {
    if (this.catalogProductValue === null) {
      throw new Error('The scenario reads the catalog product before a Given added one.');
    }
    return this.catalogProductValue;
  }

  set catalogProduct(product: CreatedProduct) {
    this.catalogProductValue = product;
    this.ownedProductValue = product;
  }

  get absentId(): string {
    if (this.absentIdValue === null) {
      throw new Error('The scenario opens a missing item before a Given chose its id.');
    }
    return this.absentIdValue;
  }

  set absentId(id: string) {
    this.absentIdValue = id;
  }

  get loginRequest(): Promise<Request> {
    if (this.loginRequestValue === null) {
      throw new Error('The scenario checks the sign-in redirect before a When started waiting for it.');
    }
    return this.loginRequestValue;
  }

  set loginRequest(request: Promise<Request>) {
    this.loginRequestValue = request;
  }

  get readerPosition(): number {
    if (this.readerPositionValue === null) {
      throw new Error("The scenario checks the reader's place before a Given scrolled the catalog.");
    }
    return this.readerPositionValue;
  }

  set readerPosition(position: number) {
    this.readerPositionValue = position;
  }
}
