import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HerramientaFusionComponent } from './herramienta-fusion.component';

describe('HerramientaFusionComponent', () => {
  let component: HerramientaFusionComponent;
  let fixture: ComponentFixture<HerramientaFusionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HerramientaFusionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HerramientaFusionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
