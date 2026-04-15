import {Component, inject, OnInit, ViewChild} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {get_headers, saveDataToFile} from '../../tools';
import {CommonModule} from "@angular/common";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelect, MatSelectChange, MatSelectModule} from "@angular/material/select";
import { createReport } from 'docx-templates';
import {MatButtonModule} from "@angular/material/button";
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {TemplateHandler} from 'easy-template-x';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatProgressSpinner],
  templateUrl: './docs.html',
  styleUrl: './docs.css',
})
export class Docs implements OnInit {

  http=inject(HttpClient)
  public cursus_list: any[] | undefined
  public student_list: any[] | undefined
  public selected_file: File | undefined;
  @ViewChild('studentselect') student_select: MatSelect | undefined;
  protected message=""
  public selected_cursus: any | undefined
  public template: any;

  async ngOnInit()  {
    const json_cursus=localStorage.getItem("cursus")
    if(json_cursus){
      this.cursus_list=JSON.parse(json_cursus)
    }else{
      this.cursus_list=await this.get_cursus() as any[]
      localStorage.setItem("cursus",JSON.stringify(this.cursus_list))
    }

    this.template=localStorage.getItem("template")
  }

  async api(url:string,message="",year=2025) {
    url="/api/v2/"+year+"/"+url
    this.message=message
    let rc: any =[]
    try{
      rc = await firstValueFrom(this.http.get(url, {headers: get_headers()}));
    }catch (e){

    }
    this.message=""
    return rc
  }

  async get_cursus() {
    return await this.api('modules?subclass_detail=false',"chargement des cursus")
    }

  async get_students(cursus:string) {
    return await this.api('modules/'+cursus+'/students',"chargement des étudiants")
  }

  async get_disciplines(student:string,year:number) {
    return await this.api('students/'+student+'/courses',"Chargement des disciplines...",year)
  }

  async get_eval_disciplines(student:string,discipline:string,year:number) {
    return await this.api('students/'+student+'/courses',"Chargement des disciplines...",year)
  }

  async on_select_cursus($event: MatSelectChange<any>) {
    this.selected_cursus=$event.value
    this.student_list=await this.get_students(this.selected_cursus.CODE) as any[]
  }

  async on_file_selected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selected_file = input.files[0];
      await this.readfile(this.selected_file)
    }
  }

  clear_form(){
    this.selected_file=undefined
  }




  async complete_student(student:any) {
    student.DISCIPLINES=[]
    for(let y of [2023,2024,2025]){
      let d=await this.get_disciplines(student.CODE,y) as any[]
      for(let i=0;i<d.length;i++){
        d[i].year=y
        let evals=await this.api("courses/"+d[i].CODE+"/assessments")
        student.DISCIPLINES.push(d[i])
      }
    }
    return student
  }



  async readfile(file:any){
    return new Promise((resolve) =>{
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        this.template=reader.result
        localStorage.setItem("template",this.template || "")
        resolve(true)
      }})
  }




  private base64ToUint8Array(base64: string) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }


  async generate_doc(to_save=true) {
    if (!this.template || !this.student_select || this.student_select.value.length === 0) {
      alert("Veuillez sélectionner un fichier et au moins un étudiant.");
      return;
    }



    const templateBuffer = this.base64ToUint8Array(this.template.split(",")[1])

    for(let student of this.student_select!.value){
      student=await this.complete_student(student)

      let rc:any={}
      for(let k in student)
        rc["STUDENT_"+k]=student[k]

      for(let k in this.selected_cursus)
        rc["CURSUS_"+k]=this.selected_cursus[k]

      let disciplines=await this.api("/modules/"+this.selected_cursus.CODE+"/moduleCourses")


      try {

        //Voir la documentation : https://templatedocs.io/docs/intro
        const doc=await new TemplateHandler().process(templateBuffer,rc)

        saveDataToFile(
          doc,
          'report.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )

        //if(to_save)saveAs(new Blob([out.buffer]), `document_${student.LNAME}_${student.FNAME}.docx`);
        this.clear_form()

      } catch (error) {
        console.error("Erreur lors de la génération du document pour " + student.FNAME, error);
      }
    }
  }

  protected clear_doc() {
    this.template=undefined
  }
}
