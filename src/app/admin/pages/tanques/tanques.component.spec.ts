import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TanquesComponent } from './tanques.component';

describe('TanquesComponent', () => {
  let component: TanquesComponent;
  let fixture: ComponentFixture<TanquesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TanquesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TanquesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
