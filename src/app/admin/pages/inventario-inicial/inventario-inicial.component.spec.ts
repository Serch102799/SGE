import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InventarioInicialComponent } from './inventario-inicial.component';

describe('InventarioInicialComponent', () => {
  let component: InventarioInicialComponent;
  let fixture: ComponentFixture<InventarioInicialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InventarioInicialComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InventarioInicialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
