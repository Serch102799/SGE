import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecuperadosComponent } from './recuperados.component';

describe('RecuperadosComponent', () => {
  let component: RecuperadosComponent;
  let fixture: ComponentFixture<RecuperadosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RecuperadosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecuperadosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
