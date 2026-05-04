import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import {Evals} from './evals/evals';
import {Searchtools} from './searchtools/searchtools';
import {Docs} from './docs/docs';
import {Test} from './test/test';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'evals', component: Evals },
  { path: 'docs', component: Docs },
  { path: 'test', component: Test },
  { path: 'search', component: Searchtools }
];
