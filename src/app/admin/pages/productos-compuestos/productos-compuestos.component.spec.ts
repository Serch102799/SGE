import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductosCompuestosComponent } from './productos-compuestos.component';

describe('ProductosCompuestosComponent', () => {
  let component: ProductosCompuestosComponent;
  let fixture: ComponentFixture<ProductosCompuestosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductosCompuestosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductosCompuestosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
