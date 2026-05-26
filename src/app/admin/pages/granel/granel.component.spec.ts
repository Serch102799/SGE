import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GranelComponent } from './granel.component';

describe('GranelComponent', () => {
  let component: GranelComponent;
  let fixture: ComponentFixture<GranelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GranelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GranelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
