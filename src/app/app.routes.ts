import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import {Evals} from './evals/evals';
import {Searchtools} from './searchtools/searchtools';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'evals', component: Evals },
  { path: 'search', component: Searchtools }
];
