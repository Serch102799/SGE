import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashConsumoComponent } from './dash-consumo.component';

describe('DashConsumoComponent', () => {
  let component: DashConsumoComponent;
  let fixture: ComponentFixture<DashConsumoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DashConsumoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashConsumoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
