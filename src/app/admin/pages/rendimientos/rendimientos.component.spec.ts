import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RendimientosComponent } from './rendimientos.component';

describe('RendimientosComponent', () => {
  let component: RendimientosComponent;
  let fixture: ComponentFixture<RendimientosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RendimientosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RendimientosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
