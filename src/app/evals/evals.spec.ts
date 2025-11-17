import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Evals } from './evals';

describe('Evals', () => {
  let component: Evals;
  let fixture: ComponentFixture<Evals>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Evals]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Evals);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
