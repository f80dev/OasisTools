import {Component, inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {CommonModule} from "@angular/common";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatIconModule} from "@angular/material/icon";
import {FormsModule} from "@angular/forms";
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatCheckboxModule} from '@angular/material/checkbox';
import * as XLSX from 'xlsx';
import * as JSZip from 'jszip';
import {clear_text, readfile, translate_to_openxml} from '../../tools';

@Component({
  selector: 'app-docsfromexcel',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
    FormsModule,
    MatCheckboxModule,
  ],
  templateUrl: './docsfromexcel.html',
  styleUrl: './docsfromexcel.css',
})
export class Docsfromexcel {
  snackbar = inject(MatSnackBar);
  http = inject(HttpClient);

  public excelData: any[] = [];
  public excelHeaders: string[] = [];
  public excelFileName: string = "";
  public template: any;
  public templateFile: File | null = null;
  public template_name: string = "";
  protected message = "";
  public skipSecondRow: boolean = true;
  public isExcelFile: boolean = false;
  public missingPlaceholders: string[] = [];

  async onExcelFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.readExcelFile(input.files[0]);
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText("{{ "+text+" }}").then(() => {
      this.snackbar.open('Copié: ' + text, 'Fermer', { duration: 2000 });
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  onExcelDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        this.readExcelFile(file);
      }
    }
  }

  private removeAccents(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }


  async readExcelFile(file: File) {
    this.message = "Lecture du fichier...";
    try {
      const arrayBuffer = await file.arrayBuffer();

      let jsonData: any[];

      if (file.name.endsWith('.csv')) {
        // CSV file - use XLSX to parse
        const workbook = XLSX.read(arrayBuffer, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        this.isExcelFile=false
      } else {
        // Excel file
        const workbook = XLSX.read(arrayBuffer, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        this.isExcelFile=true
      }

      this.excelData = jsonData;
      this.excelFileName = file.name;

      if (jsonData.length > 0) {
        // Helper function to remove accents from string

    // Transform headers to uppercase with underscores (remove accents, ' and other special chars)
        this.excelHeaders = Object.keys(jsonData[0]).map(key =>
          this.removeAccents(key).replace(/[^a-zA-Z0-9_\s]/g, '').replace(/\s+/g, '_').toUpperCase()
        );

        // Transform data keys as well (remove accents, ' and special chars, replace spaces with underscore)
        const transformedData: any[] = [];
        for (const row of jsonData) {
          const newRow: any = {};
          for (const key in row) {
            const newKey = this.removeAccents(key).replace(/[^a-zA-Z0-9_\s]/g, '').replace(/\s+/g, '_').toUpperCase();
            newRow[newKey] = row[key];
          }
          transformedData.push(newRow);
        }
        this.excelData = transformedData;
      }

      this.message = "";
    } catch (error) {
      this.message = "";
      this.snackbar.open("Erreur lors de la lecture du fichier", "Ok");
      console.error("Error reading file:", error);
    }
  }

  clearExcel() {
    this.excelData = [];
    this.excelHeaders = [];
    this.excelFileName = "";
    this.isExcelFile = false;
  }

  async onTemplateFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.readTemplateFile(input.files[0]);
    }
  }

  onTemplateDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.name.endsWith('.docx')) {
        this.readTemplateFile(file);
      }
    }
  }

  async readTemplateFile(file: File) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = async () => {
        this.template = (reader.result as ArrayBuffer);
        this.templateFile = file;  // Store the File object for later use
        this.template_name = file.name.replace(".docx", "");

        // Analyze template for placeholders
        await this.analyzeTemplatePlaceholders();

        resolve(true);
      }
    });
  }

  async analyzeTemplatePlaceholders() {
    try {
      const arrayBuffer = this.template as ArrayBuffer;
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Read the main document content
      const docXml = await zip.file("word/document.xml")?.async("string");
      if (!docXml) return;

      // Extract all text content from XML by removing tags
      const textContent = docXml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x[a-fA-F0-9]+;/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      console.log("Extracted text:", textContent);

      // Extract text between {{ and }} with surrounding spaces
      const placeholderRegex = /\{\{\s+([^}]+?)\s+\}\}/g;
      const foundPlaceholders = new Set<string>();
      let match;

      while ((match = placeholderRegex.exec(textContent)) !== null) {
        foundPlaceholders.add(match[1].trim());
      }

      console.log("Found placeholders:", Array.from(foundPlaceholders));

      // Normalize placeholders like excelHeaders (remove accents, uppercase)
      const normalizedFound = Array.from(foundPlaceholders).map(p =>
        this.removeAccents(p).replace(/[^a-zA-Z0-9_\s]/g, '').replace(/\s+/g, '_').toUpperCase()
      );

      console.log("Normalized placeholders:", normalizedFound);

      // Find placeholders not in excelHeaders
      this.missingPlaceholders = normalizedFound.filter(p => !this.excelHeaders.includes(p));

      if (this.missingPlaceholders.length > 0) {
        this.snackbar.open(
          `${this.missingPlaceholders.length} champ(s) du modèle absents des colonnes: ${this.missingPlaceholders.join(", ")}`,
          "Ok",
          { duration: 5000 }
        );
      }
    } catch (e) {
      console.error("Error analyzing template:", e);
    }
  }

  clearTemplate() {
    this.template = undefined;
    this.templateFile = null;
    this.template_name = "";
    this.missingPlaceholders = [];
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  async get_doc(url: string, data: any, message = "") {
    url = `/doc${url}`;
    console.log('[get_doc] Full URL:', url);
    this.message = message;
    return await firstValueFrom(this.http.post(url, data));
  }

  saveBase64AsDocx(base64Data: string, fileName: string) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      console.error('Invalid base64 input detected');
      return;
    }
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
      link.click();

      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Error saving DOCX:', e);
    }
  }

  async generate_doc() {
    if (!this.template || !this.excelData || this.excelData.length === 0) {
      this.snackbar.open("Veuillez sélectionner un fichier Excel et un modèle", "Ok");
      return;
    }

    // Convert ArrayBuffer to base64 for the API
    if (this.templateFile) {
      const result = await readfile(this.templateFile);
      this.template = result.template;
      this.template_name = result.template_name || this.template_name;
    }

    // Determine which rows to process
    const startIndex = this.skipSecondRow ? 1 : 0;
    const rowsToProcess = this.excelData.slice(startIndex);

    this.message = `Traitement de ${rowsToProcess.length} lignes...`;

    // Build data object with all rows included
    const data: any[] = [];

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      const originalIndex = startIndex + i;
      const rowData: any = {};
      for (let key in row) {
        rowData[key] = translate_to_openxml(clear_text(row[key]));
      }
      rowData["DATE_NOW"] = new Date().toLocaleDateString();
      rowData["NOW"] = new Date().toLocaleDateString();
      rowData["TIME_NOW"] = new Date().toLocaleTimeString();
      rowData["ROW_NUM"] = i + 1;
      data.push({name:Object.values(rowData)[0],data:rowData});
    }

    try {
      const zip: any = await this.get_doc("/merge/", {template: this.template, data: data});
      const safeName = String(this.template_name).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      this.saveBase64AsDocx(zip.document_base64, `${this.template_name}_${safeName}`);
    } catch (e) {
      console.error("Erreur lors de la génération du document", e);
      this.snackbar.open(`Problème lors de la génération du document`, "Ok");
    }

    this.message = "";
    this.snackbar.open("Génération terminée", "Ok");
  }
}
