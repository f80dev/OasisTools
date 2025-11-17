import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Searchtools } from './searchtools';

describe('Searchtools', () => {
  let component: Searchtools;
  let fixture: ComponentFixture<Searchtools>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Searchtools]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Searchtools);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
