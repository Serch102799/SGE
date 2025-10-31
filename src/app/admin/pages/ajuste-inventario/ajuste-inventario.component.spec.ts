import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AjusteInventarioComponent } from './ajuste-inventario.component';

describe('AjusteInventarioComponent', () => {
  let component: AjusteInventarioComponent;
  let fixture: ComponentFixture<AjusteInventarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AjusteInventarioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AjusteInventarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
