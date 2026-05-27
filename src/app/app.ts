import {Component, OnInit, signal, inject} from '@angular/core';
import {RouterOutlet, RouterLink, RouterLinkActive} from '@angular/router';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatIconButton} from '@angular/material/button';
import {MatButtonModule} from '@angular/material/button';
import {CommonModule} from "@angular/common";

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
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
export class App implements OnInit {
  protected readonly title = signal('OASIS Tools');
  public splash_image: string = "splash.png";

  navItems: NavItem[] = [
    {label: 'Accueil', route: '/', icon: 'home'},
    {label: 'Évaluer des disciplines', route: '/evals', icon: 'assignment'},
    {label: 'Recherche des profils', route: '/search', icon: 'person_search'},
    {label: 'Imprimer des documents', route: '/docs', icon: 'description'},
    {label: 'À propos', route: '/about', icon: 'info'},
  ];

  async ngOnInit() {
    setTimeout(() => {
      this.splash_image = "";
    }, 2000);
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
}
