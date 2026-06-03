import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Docsfromexcel } from './docsfromexcel';

describe('Docsfromexcel', () => {
  let component: Docsfromexcel;
  let fixture: ComponentFixture<Docsfromexcel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Docsfromexcel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Docsfromexcel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
