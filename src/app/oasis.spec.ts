import { TestBed } from '@angular/core/testing';

import { Oasis } from './oasis';

describe('Oasis', () => {
  let service: Oasis;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Oasis);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
