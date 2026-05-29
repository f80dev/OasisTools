import {Component, inject} from '@angular/core';
import {CommonModule} from "@angular/common";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {FormsModule} from "@angular/forms";
import {MatSnackBar} from '@angular/material/snack-bar';
import {setSecureItem, getSecureItem} from '../../tools';

interface PdfDocument {
  id: string;
  name: string;
  data: string; // base64 encoded PDF
  dateAdded: string;
}

@Component({
  selector: 'app-faqs',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    FormsModule,
  ],
  templateUrl: './faqs.html',
  styleUrl: './faqs.css',
})
export class Faqs {
  snackbar = inject(MatSnackBar);

  public pdfs: PdfDocument[] = [];
  public selectedPdf: PdfDocument | null = null;
  public isDragging = false;
  private storageKey = 'faqs_pdfs';

  constructor() {
    this.loadPdfs();
  }

  loadPdfs() {
    const stored = getSecureItem(this.storageKey);
    if (stored) {
      this.pdfs = stored as PdfDocument[];
    }
  }

  savePdfs() {
    setSecureItem(this.storageKey, this.pdfs);
  }

  async on_file_selected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      for (let i = 0; i < input.files.length; i++) {
        await this.processFile(input.files[i]);
      }
    }
    input.value = '';
  }

  on_drag_over(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  on_drag_leave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  async on_drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        await this.processFile(files[i]);
      }
    }
  }

  async processFile(file: File) {
    if (!file.type.includes('pdf')) {
      this.snackbar.open('Seuls les fichiers PDF sont acceptés', 'Ok');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.snackbar.open('Le fichier ne doit pas dépasser 10 Mo', 'Ok');
      return;
    }

    try {
      const base64 = await this.fileToBase64(file);
      const pdf: PdfDocument = {
        id: this.generateId(),
        name: file.name,
        data: base64,
        dateAdded: new Date().toISOString()
      };

      this.pdfs.push(pdf);
      this.savePdfs();
      this.snackbar.open(`"${file.name}" ajouté avec succès`, 'Ok');
    } catch (error) {
      console.error('Error processing PDF:', error);
      this.snackbar.open('Erreur lors de l\'import du fichier', 'Ok');
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  private generateId(): string {
    return 'pdf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  viewPdf(pdf: PdfDocument) {
    this.selectedPdf = pdf;
  }

  closeViewer() {
    this.selectedPdf = null;
  }

  openPdfInNewWindow(pdf: PdfDocument) {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>${pdf.name}</title>
            <style>
              body { margin: 0; padding: 20px; display: flex; justify-content: center; background: #333; }
              embed { width: 100%; height: 100vh; }
            </style>
          </head>
          <body>
            <embed src="${pdf.data}" type="application/pdf">
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  }

  deletePdf(pdf: PdfDocument) {
    const index = this.pdfs.findIndex(p => p.id === pdf.id);
    if (index > -1) {
      this.pdfs.splice(index, 1);
      this.savePdfs();
      if (this.selectedPdf?.id === pdf.id) {
        this.selectedPdf = null;
      }
      this.snackbar.open(`"${pdf.name}" supprimé`, 'Ok');
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getFileSize(base64: string): string {
    const bytes = Math.round((base64.length - base64.indexOf(',base64,')) * 0.75);
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }
}
