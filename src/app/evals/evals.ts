import {Component, ElementRef, inject, signal, ViewChild} from '@angular/core';
import {JsonPipe} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import * as XLSX from 'xlsx';
import { firstValueFrom } from 'rxjs';
import {API_PASSWORD, API_USER} from '../../secret';


@Component({
  selector: 'app-evals',
  imports: [
    JsonPipe
  ],
  templateUrl: './evals.html',
  styleUrl: './evals.css',
})
export class Evals {
  @ViewChild('fileInput') fileInput!: ElementRef;

  message: string = '';
  private http = inject(HttpClient);
  resp:any[]=[]

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

    reader.onload = async (e: any) => { // Changed to async
      const bstr: string = e.target.result;

      const workbook = XLSX.read(bstr, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rows:any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      // To iterate through cells (example for a specific range A1:C5)
      for(let row of rows.slice(1)){
        if(row[0] && row[1]){
          try{
            let rc=await this.update_from_students_and_course(row[0],row[1],row[3],row[2],row[4])    // Await the async function
            this.resp.push({ ...row, result:"ok"})
          }catch (e:any){
            this.resp.push({...row, result:"error",message:e.error})
          }
        }
      }
    };

    reader.readAsBinaryString(file);
  }



  get_header(username=API_USER,password=API_PASSWORD): any {
    return {
      'accept': 'application/json',
      'Authorization': 'Basic '+btoa(username+":"+password),
      'Content-Type': 'application/json'
    };
  }


  async get_evals(code_course:string,year=2025) : Promise<any> {
    const url = '/api/v2/'+year+'/courses/'+code_course+"/assessments"
    return firstValueFrom(this.http.get(url, { headers:this.get_header() }));
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
    return firstValueFrom(this.http.patch(url, body, { headers:this.get_header() }));
  }


  //domain="https://ent.cnsmdp.fr"
  async eval_discipline(code_course:string,code_student:string,status:string,mention="",comment="",year=2025) {
    const url = '/api/v2/'+year+'/assessments'

    const body={
      "CODE_COURSE":code_course,
      "CODE_STUDENT":code_student,
      "STATUS": status,
      "MENTION": mention,
      "COMMENT": comment
    }
    return firstValueFrom(this.http.post(url, body, { headers:this.get_header() }));
  }
}
