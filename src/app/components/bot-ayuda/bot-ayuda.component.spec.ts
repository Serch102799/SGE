import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BotAyudaComponent } from './bot-ayuda.component';

describe('BotAyudaComponent', () => {
  let component: BotAyudaComponent;
  let fixture: ComponentFixture<BotAyudaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BotAyudaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BotAyudaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
