import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import {Evals} from './evals/evals';
import {Searchtools} from './searchtools/searchtools';
import {Docs} from './docs/docs';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'evals', component: Evals },
  { path: 'docs', component: Docs },
  { path: 'search', component: Searchtools }
];
