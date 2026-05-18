import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import {Evals} from './evals/evals';
import {Searchtools} from './searchtools/searchtools';
import {Docs} from './docs/docs';
import {Test} from './test/test';
import {About} from './about/about';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'evals', component: Evals },
  { path: 'docs', component: Docs },
  { path: 'about', component: About },
  { path: 'test', component: Test },
  { path: 'search', component: Searchtools }
];
