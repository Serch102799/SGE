import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistorialCombustibleComponent } from './historial-combustible.component';

describe('HistorialCombustibleComponent', () => {
  let component: HistorialCombustibleComponent;
  let fixture: ComponentFixture<HistorialCombustibleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HistorialCombustibleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistorialCombustibleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
