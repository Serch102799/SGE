import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistroEntradaComponent } from './registro-entrada.component';

describe('RegistroEntradaComponent', () => {
  let component: RegistroEntradaComponent;
  let fixture: ComponentFixture<RegistroEntradaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegistroEntradaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistroEntradaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
