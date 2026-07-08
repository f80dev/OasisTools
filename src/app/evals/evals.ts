import {Component, ElementRef, inject, OnInit, ViewChild} from '@angular/core';
import {JsonPipe, NgForOf, NgIf} from '@angular/common';
import * as XLSX from 'xlsx';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {MatButton} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatTableModule} from '@angular/material/table';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatIconModule} from '@angular/material/icon';
import {FormsModule} from "@angular/forms";
import {get_headers} from '../../tools';

@Component({
  selector: 'app-evals',
  standalone: true,
  imports: [
    NgIf,
    MatButton,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './evals.html',
  styleUrl: './evals.css',
})
export class Evals implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  message: string = '';
  private http = inject(HttpClient);
  resp: any[] = [];
  isStopped = false;
  stopOnError = true;
  importFirstLineOnly = false;
  displayedColumns: string[] = ['course', 'student', 'status', 'mention', 'result', 'message'];

  getOkCount(): number {
    return this.resp.filter(r => r.result === 'ok').length;
  }

  getErrorCount(): number {
    return this.resp.filter(r => r.result === 'error').length;
  }



  async ngOnInit() {
    this.loadSettings();
  }



  loadSettings() {
    const stored = localStorage.getItem('oasis_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      this.stopOnError = settings.evalStopOnError ?? true;
      this.importFirstLineOnly = settings.evalImportFirstLineOnly ?? false;
    }
  }



  get_headers_from_proxy() : any {
    const stored = localStorage.getItem('oasis_settings');
    const settings = stored ? JSON.parse(stored) : {};
    const version = settings.evalProxyVersion || 'prod';
    return {
      'x-proxy-version': version,
      'x-proxy': 'eval'
    };
  }



  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }



  StoplImport(): void {
    this.isStopped = true;
    this.exportRespToCsv();
  }



  ClearImport(): void {
    this.resp=[]
  }

  private exportRespToCsv(): void {
    if (this.resp.length === 0) {
      return;
    }

    const header = ['code_course', 'code_student', 'status', 'mention', 'comment', 'result', 'message'];
    const csvRows = [header.join(',')];

    for (const row of this.resp) {
      const values = [
        `"${(row[0] || '').toString().replace(/"/g, '""')}"`,
        `"${(row[1] || '').toString().replace(/"/g, '""')}"`,
        `"${(row[3] || '').toString().replace(/"/g, '""')}"`,
        `"${(row[2] || '').toString().replace(/"/g, '""')}"`,
        `"${(row[4] || '').toString().replace(/"/g, '""')}"`,
        `"${(row.result || '').toString().replace(/"/g, '""')}"`,
        `"${(row.message || '').toString().replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf--8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'import_results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    this.isStopped = false;
    this.resp = [];

    if (files && files.length > 0) {
      // Validate file types to prevent malicious uploads
      const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      const allowedExtensions = ['.xls', '.xlsx'];

      const excelFiles = Array.from(files).filter(file => {
        const hasValidType = allowedTypes.includes(file.type);
        const hasValidExtension = allowedExtensions.some(ext =>
          file.name.toLowerCase().endsWith(ext)
        );
        // Also validate file name for path traversal attempts
        const hasValidName = !file.name.includes('..') &&
          !file.name.includes('/') &&
          !file.name.includes('\\');
        return (hasValidType || hasValidExtension) && hasValidName;
      });

      if (excelFiles.length > 0) {
        this.message = `Selected ${excelFiles.length} Excel file(s). First file: ${excelFiles[0].name}`;
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

    reader.onload = async (e: any) => { // Changed to async
      if (this.isStopped) return;

      const bstr: string = e.target.result;

      const workbook = XLSX.read(bstr, { type: 'binary' });
      const worksheet = workbook.Sheets["OASIS"];

      let rows:any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      for(let i=0;i<rows[0].length;i++)
        rows[0][i]=rows[0][i].substring(0,5).toLowerCase()

      const header={
        code_course:rows[0].indexOf("disci"),
        code_student:rows[0].indexOf("etudi"),
        status:rows[0].indexOf("statu"),
        mention:rows[0].indexOf("menti"),
        commentaire:rows[0].indexOf("comme"),
      }
      rows = rows.slice(1);
      if (this.importFirstLineOnly) {
        rows = rows.slice(0, 1);
      }
      // To iterate through cells (example for a specific range A1:C5)
      for(let row of rows){
        if (this.isStopped) {
          this.message = 'Import cancelled.';
          break;
        }
        if(row[header.code_course] && row[header.code_student]){
          try{
            let rc=await this.update_from_students_and_course(
              row[header.code_course],
              row[header.code_student],
              row[header.status],
              header.mention>-1 ? row[header.mention] : "",
              header.commentaire>-1 ? row[header.commentaire] : ""
            )    // Await the async function
            if (!this.isStopped) {
              this.resp.push({ ...row, result:"ok"})
            }
          }catch (e:any){
            if (!this.isStopped) {
              // Sanitize error messages to prevent XSS
              const sanitizeError = (msg: string): string => {
                if (!msg || typeof msg !== 'string') return 'An unknown error occurred';
                // Remove HTML tags and limit length
                return msg.replace(/<[^>]*>/g, '').substring(0, 200);
              };
              const errorMessage = sanitizeError(e?.error?.error || e?.message || "An unknown error occurred");
              this.resp.push({...row, result:"error",message: errorMessage})
              if (this.stopOnError) {
                this.isStopped = true;
                this.message = 'Import stopped due to an error.';
              }
            }
          }
        }
        if(this.importFirstLineOnly)break
      }
    }
    reader.readAsBinaryString(file);
  }





  async get_evals(code_course:string,year:number) : Promise<any> {
    const url = '/api/v2/'+year+'/courses/'+code_course+"/assessments"
    return firstValueFrom(this.http.get(url, { headers: get_headers() }));
  }




  async update_from_students_and_course(code_course:string,code_student:string,status:string,mention="",comment="",year=2025,update=true) {
    try {
      if (update) {
        const evals: any[] = await this.get_evals(code_course,year);
        for (let evl of evals) {
          if (evl.STUDENT.CODE == code_student) {
            return this.update_eval_discipline(evl.CODE, status, mention, comment, year)
          }
        }
        //On fait l'ajout si l'évaluation n'existe pas
        return this.eval_discipline(code_course, code_student, status, mention, comment, year)
      } else {
        //On ne fait que l'ajout
        return this.eval_discipline(code_course, code_student, status, mention, comment, year)
      }
    } catch (e:any) {
      console.error('Error in update_from_students_and_course:', e);
      throw e;
    }
  }



  async update_eval_discipline(code_assessments:string,status:string,mention="",comment="",year=2025){
    //voir https://ent.cnsmdp.fr/api/v2/doc#/%C3%89valuations/Oasis%5CCnsmdParis%5COverride%5CApi%5CREST%5CData%5CController%5CCourseAssessmentProfile%5CCourseAssessmentCtrl%3A%3AupdateCourseAssessment
    //voir https://testcnsmdp.scolasis.com/api/v2/doc#/%C3%89valuations/Oasis%5CCnsmdParis%5COverride%5CApi%5CREST%5CData%5CController%5CCourseAssessmentProfile%5CCourseAssessmentCtrl%3A%3AupdateCourseAssessment
    const url = '/api/v2/'+year+'/assessments/'+code_assessments

    const body={
      "STATUS": status,
      "COMMENT": comment,
    }
    return firstValueFrom(this.http.patch(url, body, { headers: get_headers() }));
  }


  //domain="https://ent.cnsmdp.fr"
  async eval_discipline(code_course:string,code_student:string,status:string,mention="",comment="",year=2025) {
    const url = '/api/v2/'+year+'/assessments'

    const body={
      "CODE_COURSE":code_course,
      "CODE_STUDENT":code_student,
      "STATUS": status,
      "COMMENT": comment
    }
    try {
      console.log("[eval_discipline] Envoi de "+JSON.stringify(body)+" sur "+url)
      console.log("[eval_discipline] Proxy target: https://testcnsmdp.scolasis.com")
      console.log("[eval_discipline] Full URL will be: https://testcnsmdp.scolasis.com"+url)
      const response = await firstValueFrom(this.http.post(url, body, {headers: get_headers(), observe: 'response'}));
      console.log("[eval_discipline] Response status:", response.status);
      console.log("[eval_discipline] Response body:", response.body);
      return response.body;
    } catch (error: any) {
      console.error('[eval_discipline] Error details:', {
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText,
        url: error?.url,
        error: error?.error
      });
      throw error;
    }
  }
}
