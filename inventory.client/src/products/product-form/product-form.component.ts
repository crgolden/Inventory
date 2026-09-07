import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { catchError, EMPTY, forkJoin, Observable, of } from 'rxjs';
import { ProductService } from '../product.service';
import {
  AddToInventoryRequest,
  CatalogProductEdit,
  InventoryItemEdit,
  InventoryItemView,
} from '../inventory-item.model';
import { ManualChatPanelComponent } from '../manual-chat/manual-chat-panel.component';
import { ProductContext } from '../manual-chat/chat.model';
import {
  dateTimeLocalInputToUtcInstant,
  utcInstantToDateTimeLocalInput,
} from '../../datetime-local';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink, ManualChatPanelComponent],
  templateUrl: './product-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductFormComponent implements OnInit {

  private readonly titleService = inject(Title);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly editId = signal<string | null>(null);
  readonly editCatalogProductId = signal<string | null>(null);
  readonly isEdit = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    name: [null as string | null, Validators.required],
    brand: [null as string | null, Validators.required],
    modelNumber: [null as string | null, Validators.required],
    msrpPrice: [null as number | null],
    pricePaid: [null as number | null],
    serialNumber: [null as string | null],
    purchaseDate: [null as string | null],
    category: [null as string | null],
    description: [null as string | null],
    manualUrl: [null as string | null],
  });

  private readonly formSignal = signal(this.form.getRawValue());

  readonly productContext = computed<ProductContext>(() => {
    const v = this.formSignal();
    return {
      id: this.editId(),
      name: v.name,
      brand: v.brand,
      modelNumber: v.modelNumber,
    };
  });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formSignal.set(this.form.getRawValue()));
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.isEdit.set(true);
      this.titleService.setTitle('Inventory | Edit Product');
      const item = this.route.snapshot.data['product'] as InventoryItemView | undefined;
      if (item) {
        this.editCatalogProductId.set(item.catalogProductId);
        this.form.patchValue({
          ...item,
          purchaseDate: utcInstantToDateTimeLocalInput(item.purchaseDate),
        });
      }
    } else {
      this.titleService.setTitle('Inventory | New Product');
    }
  }

  onManualUrlSelected(url: string): void {
    this.form.controls.manualUrl.setValue(url);
    this.form.controls.manualUrl.markAsDirty();
  }

  submit(): void {
    if (this.form.invalid) return;

    const id = this.editId();
    if (id === null) {
      this.createItem();
      return;
    }

    this.saveEdits(id);
  }

  private createItem(): void {
    const request: AddToInventoryRequest = {
      ...this.form.getRawValue(),
      purchaseDate: dateTimeLocalInputToUtcInstant(this.form.controls.purchaseDate.value),
    };

    this.productService.create(request).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error.set(`Save failed (${err.status}). Please try again.`);
        return EMPTY;
      })
    ).subscribe(newId => {
      if (newId === null) {
        this.error.set('Saved, but the new product could not be opened. Find it in your list.');
        return;
      }

      void this.router.navigate(['/products', newId]);
    });
  }

  private saveEdits(id: string): void {
    const itemChanges = this.dirtyInventoryFields();
    const catalogChanges = this.dirtyCatalogFields();
    const catalogProductId = this.editCatalogProductId();

    const item$: Observable<unknown> = Object.keys(itemChanges).length === 0
      ? of(null)
      : this.productService.patch(id, itemChanges).pipe(
        catchError((err: HttpErrorResponse) => {
          this.error.set(`Could not save your own details (${err.status}). Nothing was saved.`);
          return EMPTY;
        })
      );

    const catalog$: Observable<unknown> =
      Object.keys(catalogChanges).length === 0 || catalogProductId === null
        ? of(null)
        : this.productService.patchCatalogProduct(catalogProductId, catalogChanges).pipe(
          catchError((err: HttpErrorResponse) => {
            this.error.set(
              `Your own details were saved, but the shared product facts were not (${err.status}).`
            );
            return EMPTY;
          })
        );

    forkJoin([item$, catalog$]).subscribe(() => {
      void this.router.navigate(['/products', id]);
    });
  }

  private dirtyInventoryFields(): Partial<InventoryItemEdit> {
    const controls = this.form.controls;
    const changes: Partial<InventoryItemEdit> = {};

    if (controls.serialNumber.dirty) {
      changes.serialNumber = controls.serialNumber.value;
    }

    if (controls.purchaseDate.dirty) {
      changes.purchaseDate = dateTimeLocalInputToUtcInstant(controls.purchaseDate.value);
    }

    if (controls.pricePaid.dirty) {
      changes.pricePaid = controls.pricePaid.value;
    }

    if (controls.description.dirty) {
      changes.description = controls.description.value;
    }

    return changes;
  }

  private dirtyCatalogFields(): Partial<CatalogProductEdit> {
    const controls = this.form.controls;
    const changes: Partial<CatalogProductEdit> = {};

    if (controls.name.dirty) {
      changes.name = controls.name.value;
    }

    if (controls.brand.dirty) {
      changes.brand = controls.brand.value;
    }

    if (controls.modelNumber.dirty) {
      changes.modelNumber = controls.modelNumber.value;
    }

    if (controls.category.dirty) {
      changes.category = controls.category.value;
    }

    if (controls.manualUrl.dirty) {
      changes.manualUrl = controls.manualUrl.value;
    }

    if (controls.msrpPrice.dirty) {
      changes.msrpPrice = controls.msrpPrice.value;
    }

    return changes;
  }
}
