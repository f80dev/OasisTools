import {Component, inject, OnInit} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {get_headers} from '../../tools';

@Component({
  selector: 'app-searchtools',
  standalone: true,
  imports: [
    MatButton,
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: './searchtools.html',
  styleUrl: './searchtools.css',
})
export class Searchtools implements OnInit {

  async ngOnInit() {
    try {
      const permissionStatus = await navigator.permissions.query(
        { name: 'clipboard-read' as PermissionName }
      );

      permissionStatus.onchange = () => {
        console.log(`L'état de la permission du presse-papiers est passé à ${permissionStatus.state}`);
      };

      if (permissionStatus.state === 'denied') {
        alert('L\'accès au presse-papiers a été refusé. Veuillez l\'autoriser dans les paramètres de votre navigateur.');
      }

    } catch (err) {
      console.error('Impossible de demander la permission pour le presse-papiers : ', err);
    }
  }


  private http = inject(HttpClient);

  async pasteFromClipboard() {
    let text=""
    try {
      text = await navigator.clipboard.readText();
    } catch (err) {
      console.error('Impossible de lire le contenu du presse-papiers : ', err);
    }

    console.log("Initialisation de l'environneent OASIS")
    await firstValueFrom(this.http.get("http://localhost:5002/api/init?homolo=false", { headers:get_headers() }))
    console.log("Environnement initialisé")

    let rc=[]
    for(let line of text.split("\r\n")){
      let cols=line.split("\t")
      const body={FNAME:cols[0],LNAME:cols.length>1 ? cols[1] : ""}
      rc.push(await firstValueFrom(this.http.post("http://localhost:5002/search", body, { headers:get_headers() })))
    }
    await firstValueFrom(this.http.get("http://localhost:5002/api/quit", {  headers:get_headers() }))
  }


}
