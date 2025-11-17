import {Component, inject, OnInit} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {firstValueFrom} from 'rxjs';
import {get_header} from '../../tools';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-searchtools',
  standalone: true,
  imports: [
    MatButton
  ],
  templateUrl: './searchtools.html',
  styleUrl: './searchtools.css',
})
export class Searchtools implements OnInit {


  async ngOnInit() {
    try {
      // La permission 'clipboard-read' peut nécessiter une assertion de type
      const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });

      // Gérer les changements de permission
      permissionStatus.onchange = () => {
        console.log(`L'état de la permission du presse-papiers est passé à ${permissionStatus.state}`);
      };

      // Vérifier l'état initial
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

    await firstValueFrom(this.http.get("http://localhost:5002/api/init?homolo=false", { headers:get_header() }))

    let rc=[]
    for(let line of text.split("\r\n")){
      let cols=line.split("\t")
      const body={FNAME:cols[0],LNAME:cols.length>1 ? cols[1] : ""}
      rc.push(await firstValueFrom(this.http.post("http://localhost:5002/search", body, { headers:get_header() })))
    }
  }
}
