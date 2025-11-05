import { Component, signal, ViewChild, ElementRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { HttpClient, HttpClientModule } from '@angular/common/http';
// You will need to install and import the 'xlsx' library:
// npm install xlsx
// import * as XLSX from 'xlsx';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatButton, HttpClientModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  @ViewChild('fileInput') fileInput!: ElementRef;
  protected readonly title = signal('OasisTools');
  message: string = '';
  private http = inject(HttpClient);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    this.handleFiles(files);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.handleFiles(files);
  }

  private handleFiles(files: FileList | null | undefined): void {
    if (files && files.length > 0) {
      const excelFiles = Array.from(files).filter(file =>
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.xlsx')
      );

      if (excelFiles.length > 0) {
        this.message = `Selected ${excelFiles.length} Excel file(s). First file: ${excelFiles[0].name}`;
        console.log('Selected Excel files:', excelFiles);
        excelFiles.forEach(file => this.processExcelFile(file));
      } else {
        this.message = 'No Excel files selected. Please drop or select Excel files (.xls, .xlsx).';
      }
    } else {
      this.message = 'No files selected.';
    }
  }

  private processExcelFile(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const bstr: string = e.target.result;
      // You would use XLSX.read(bstr, { type: 'binary' }) here
      // For demonstration, we'll just log a message.
      console.log(`Processing Excel file: ${file.name}`);

      // Example of how you would typically use the xlsx library:

      const workbook = XLSX.read(bstr, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON or iterate through cells
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log('Excel data:', data);

      // To iterate through cells (example for a specific range A1:C5)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.s.c; ++C) {
          const cell_address = { c: C, r: R };
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          const cell = worksheet[cell_ref];
          if (cell) {
            console.log(`Cell ${cell_ref}: ${cell.v}`);
          }
        }
      }

    };

    reader.readAsBinaryString(file);
  }


  //domain="https://ent.cnsmdp.fr"
  eval_discipline(code_course:string,code_student:string,status:string,mention="",comment="",year=2025,domain="https://testcnsmdp.scolasis.com"): void {
    const url = domain+'/api/v2/'+year+'/assessments';
    const headers = {
      'accept': 'application/json',
      'Authorization': 'Basic aC5ob2FyZWF1OkhoNDI3MSEh',
      'Content-Type': 'application/json'
    };
    let body={
      "CODE_COURSE": code_course, //"DI216",
      "CODE_STUDENT": code_student, //"karboleda",
      "STATUS": status, //"PENDING|INVALIDATE|VALIDATE|VALIDATE_1|VALIDATE_2|VALIDATE_3",
      "MENTION": mention, //"AB|B|TB|U|F",
      "COMMENT": comment
    }

    this.http.post(url, body, { headers }).subscribe({
      next: (response) => {
        console.log('Assessment sent successfully:', response);
        this.message = 'Assessment sent successfully!';
      },
      error: (error) => {
        console.error('Error sending assessment:', error);
        this.message = `Error sending assessment: ${error.message || error.statusText}`;
      }
    });
  }
}
