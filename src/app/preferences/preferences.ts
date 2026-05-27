import {Component, signal, inject} from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {MatSnackBar, MatSnackBarModule} from "@angular/material/snack-bar";
import {HttpClient} from "@angular/common/http";

const SETTINGS_KEY = 'oasis_settings';

export interface OasisSettings {
  docApiUrl: string;
}

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './preferences.html',
  styleUrl: './preferences.css',
})
export class PreferencesComponent {
  private http = inject(HttpClient);
  private snackbar = inject(MatSnackBar);

  docApiUrl = signal('');
  testing = signal(false);
  testResult = signal<string | null>(null);

  constructor() {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings: OasisSettings = JSON.parse(stored);
      this.docApiUrl.set(settings.docApiUrl || '');
    }
  }

  save() {
    const settings: OasisSettings = {docApiUrl: this.docApiUrl()};
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    this.snackbar.open('Paramètres sauvegardés', 'OK', {duration: 2000});
  }

  reset() {
    this.docApiUrl.set('http://localhost:5002');
    this.save();
  }

  async testConnection() {
    const url = this.docApiUrl();
    if (!url) {
      this.testResult.set('URL non configurée');
      return;
    }
    this.testing.set(true);
    this.testResult.set(null);
    try {
      const health = await this.http.get(`${url}/health`, {responseType: 'text'}).toPromise();
      this.testResult.set(`✓ Connexion réussie : ${health}`);
    } catch (e: any) {
      this.testResult.set(`✗ Erreur : ${e.status} ${e.statusText}`);
    } finally {
      this.testing.set(false);
    }
  }
}