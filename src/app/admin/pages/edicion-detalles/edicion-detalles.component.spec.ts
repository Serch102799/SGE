import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EdicionDetallesComponent } from './edicion-detalles.component';

describe('EdicionDetallesComponent', () => {
  let component: EdicionDetallesComponent;
  let fixture: ComponentFixture<EdicionDetallesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EdicionDetallesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EdicionDetallesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
