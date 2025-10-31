import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConteoInventarioComponent } from './conteo-inventario.component';

describe('ConteoInventarioComponent', () => {
  let component: ConteoInventarioComponent;
  let fixture: ComponentFixture<ConteoInventarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConteoInventarioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConteoInventarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
