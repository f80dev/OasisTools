import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import {MatIconButton} from '@angular/material/button';
import {MatButtonModule} from '@angular/material/button';
import {CommonModule} from "@angular/common";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatIconButton,
    MatButtonModule,
    CommonModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('OasisTools');
  public splash_image: string | undefined;
  public splash_visible = true;

  async ngOnInit() {
    const saved = localStorage.getItem("splash_image");
    if (saved) {
      this.splash_image = saved;
    }
  }

  on_splash_file_selected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        this.splash_image = reader.result as string;
        localStorage.setItem("splash_image", this.splash_image);
      };
    }
  }

  close_splash() {
    this.splash_visible = false;
  }

  clear_splash() {
    this.splash_image = undefined;
    localStorage.removeItem("splash_image");
  }
}
