import {Component, signal, ViewChild, ElementRef, inject} from '@angular/core';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import * as XLSX from 'xlsx';
import {firstValueFrom} from 'rxjs';
import {JsonPipe, NgIf} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatTableModule} from '@angular/material/table';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {get_headers} from '../../tools';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HttpClientModule,
    JsonPipe,
    NgIf,
    MatButtonModule,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  @ViewChild('fileInput') fileInput!: ElementRef;
  message: string = '';
  private http = inject(HttpClient);
  resp: any[] = [];

  displayedColumns: string[] = ['course', 'student', 'status', 'result', 'message'];

  getOkCount(): number {
    return this.resp.filter(r => r.result === 'ok').length;
  }

  getErrorCount(): number {
    return this.resp.filter(r => r.result === 'error').length;
  }

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
        this.message = `Sélection de ${excelFiles.length} fichier(s) Excel. Fichier : ${excelFiles[0].name}`;
        this.resp = [];
        excelFiles.forEach(file => this.processExcelFile(file));
      } else {
        this.message = 'Aucun fichier Excel sélectionné. Formats acceptés : .xls, .xlsx';
      }
    } else {
      this.message = 'Aucun fichier sélectionné.';
    }
  }

  private processExcelFile(file: File): void {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const bstr: string = e.target.result;
      const workbook = XLSX.read(bstr, {type: 'binary'});
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, {header: 1});
      for (let row of rows.slice(1)) {
        if (row[0] && row[1]) {
          try {
            await this.update_from_students_and_course(row[0], row[1], row[3], row[2], row[4]);
            this.resp.push({...row, result: "ok"});
          } catch (e: any) {
            this.resp.push({...row, result: "error", message: e.error});
          }
        }
      }
    };
    reader.readAsBinaryString(file);
  }

  async get_evals(code_course: string, year = 2025): Promise<any> {
    const url = '/api/v2/' + year + '/courses/' + code_course + "/assessments";
    return firstValueFrom(this.http.get(url, {headers: get_headers()}));
  }

  async update_from_students_and_course(code_course: string, code_student: string, status: string, mention = "", comment = "", year = 2025, update = true) {
    if (update) {
      const evals: any[] = await this.get_evals(code_course);
      for (let evl of evals) {
        if (evl.STUDENT.CODE == code_student) {
          return this.update_eval_discipline(evl.CODE, status, mention, comment, year);
        }
      }
      return this.eval_discipline(code_course, code_student, status, mention, comment, year);
    } else {
      return this.eval_discipline(code_course, code_student, status, mention, comment, year);
    }
  }

  async update_eval_discipline(code_assessments: string, status: string, mention = "", comment = "", year = 2025) {
    const url = '/api/v2/' + year + '/assessments/' + code_assessments;
    const body = {"STATUS": status, "MENTION": mention, "COMMENT": comment};
    return firstValueFrom(this.http.patch(url, body, {headers: get_headers()}));
  }

  async eval_discipline(code_course: string, code_student: string, status: string, mention = "", comment = "", year = 2025) {
    const url = '/api/v2/' + year + '/assessments';
    const body = {"CODE_COURSE": code_course, "CODE_STUDENT": code_student, "STATUS": status, "MENTION": mention, "COMMENT": comment};
    return firstValueFrom(this.http.post(url, body, {headers: get_headers()}));
  }
}