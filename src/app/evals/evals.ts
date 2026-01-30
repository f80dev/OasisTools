import {Component, ElementRef, inject, OnInit, ViewChild} from '@angular/core';
import {JsonPipe, NgForOf, NgIf} from '@angular/common';
import * as XLSX from 'xlsx';
import { firstValueFrom } from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {MatButton} from '@angular/material/button';
import {get_header} from '../../tools';
import {FormsModule} from "@angular/forms";


@Component({
  selector: 'app-evals',
  standalone:true,
  imports: [
    NgIf,
    JsonPipe,
    MatButton,
    NgForOf,
    FormsModule
  ],
  templateUrl: './evals.html',
  styleUrl: './evals.css',
})
export class Evals implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  message: string = '';
  private http = inject(HttpClient);
  resp:any[]=[];
  proxyTarget: string = '';
  private isStopped = false;
  stopOnError = true;

  async ngOnInit() {
    let config=await firstValueFrom(this.http.get<any>('proxy.conf.json'))
    this.proxyTarget = config['/api'].target;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  StoplImport(): void {
    this.isStopped = true;
    this.exportRespToCsv();
    this.resp = [];
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
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
      const excelFiles = Array.from(files).filter(file =>
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.xlsx')
      );

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

      const rows:any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      // To iterate through cells (example for a specific range A1:C5)
      for(let row of rows.slice(1)){
        if (this.isStopped) {
          this.message = 'Import cancelled.';
          break;
        }
        if(row[0] && row[1]){
          try{
            let rc=await this.update_from_students_and_course(row[0],row[1],row[3],row[2],row[4])    // Await the async function
            if (!this.isStopped) {
              this.resp.push({ ...row, result:"ok"})
            }
          }catch (e:any){
            if (!this.isStopped) {
              this.resp.push({...row, result:"error",message:e.message})
              if (this.stopOnError) {
                this.isStopped = true;
                this.message = 'Import stopped due to an error.';
              }
            }
          }
        }
      }
    }
    reader.readAsBinaryString(file);
  }





  async get_evals(code_course:string,year=2025) : Promise<any> {
    const url = '/api/v2/'+year+'/courses/'+code_course+"/assessments"
    return firstValueFrom(this.http.get(url, { headers:get_header() }));
  }




  async update_from_students_and_course(code_course:string,code_student:string,status:string,mention="",comment="",year=2025,update=true) {
    if(update){
      const evals:any[]=await this.get_evals(code_course);
      for(let evl of evals){
        if(evl.STUDENT.CODE==code_student){
          return this.update_eval_discipline(evl.CODE,status,mention,comment,year)
        }
      }
      //On fait l'ajout si l'évaluation n'existe pas
      return this.eval_discipline(code_course,code_student,status,mention,comment,year)
    }else{
      //On ne fait que l'ajout
      return this.eval_discipline(code_course,code_student,status,mention,comment,year)
    }
  }



  async update_eval_discipline(code_assessments:string,status:string,mention="",comment="",year=2025){
    //voir https://ent.cnsmdp.fr/api/v2/doc#/%C3%89valuations/Oasis%5CCnsmdParis%5COverride%5CApi%5CREST%5CData%5CController%5CCourseAssessmentProfile%5CCourseAssessmentCtrl%3A%3AupdateCourseAssessment
    //voir https://testcnsmdp.scolasis.com/api/v2/doc#/%C3%89valuations/Oasis%5CCnsmdParis%5COverride%5CApi%5CREST%5CData%5CController%5CCourseAssessmentProfile%5CCourseAssessmentCtrl%3A%3AupdateCourseAssessment
    const url = '/api/v2/'+year+'/assessments/'+code_assessments

    const body={
      "STATUS": status,
      "MENTION": mention,
      "COMMENT": comment,
    }
    return firstValueFrom(this.http.patch(url, body, { headers:get_header() }));
  }


  //domain="https://ent.cnsmdp.fr"
  async eval_discipline(code_course:string,code_student:string,status:string,mention="",comment="",year=2025) {
    const url = '/api/v2/'+year+'/assessments'

    const body={
      "CODE_COURSE":code_course,
      "CODE_STUDENT":"student_"+code_student,
      "STATUS": status,
      "MENTION": mention,
      "COMMENT": comment
    }
    try {
      console.log("Envoi de "+JSON.stringify(body)+" sur "+url)
      return await firstValueFrom(this.http.post(url, body, {headers: get_header()}));
    } catch (error) {
      console.error('Error in eval_discipline:', error);
      throw error;
    }
  }
}
