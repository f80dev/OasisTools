import {Component, inject, OnInit, ViewChild} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {clear_text, get_headers,  saveDataToFile, translate_to_openxml} from '../../tools';
import {CommonModule} from "@angular/common";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelect, MatSelectChange, MatSelectModule} from "@angular/material/select";
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
  private cursus_disciplines:any
  public template_name: string=""

  async ngOnInit()  {
    const json_cursus=localStorage.getItem("cursus")
    if(json_cursus){
      this.cursus_list=JSON.parse(json_cursus)
    }else{
      this.cursus_list=await this.get_cursus() as any[]
      localStorage.setItem("cursus",JSON.stringify(this.cursus_list))
    }
    this.cursus_disciplines=await this.get_maquettage()
    //this.evals=await this.get_all_evals()
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
    return rc
  }

  async api_doc(url:string,data:any,message="") {
    url="http://127.0.0.1:8000/doc"+url
    this.message=message
    let rc: any =[]
    try{
      rc = await firstValueFrom(this.http.post(url, data));
    }catch (e){
      console.log(rc)
    }
    return rc
  }



  async get_cursus() {
    return await this.api('modules?subclass_detail=false',"chargement des cursus")
    }

  async get_maquettage() {
    try {
      return await firstValueFrom(this.http.get("contenudescursus.json"));
    } catch (e) {
      let rc: any = {}
      for (let y = 2016; y < 2026; y++) {
        let k = y.toString()
        rc[k] = await this.api('moduleCourses', "chargement du maquettage", y)
      }
      return rc
    }
  }

  async get_students(cursus:string) {
    return await this.api('modules/'+cursus+'/students',"chargement des étudiants ...")
  }

  async get_disciplines(student:string,year:number) {
    return await this.api('students/'+student+'/courses',"Chargement des disciplines ...",year)
  }

  async get_eval_disciplines(student:string,discipline:string,year:number) {
    return await this.api('students/'+student+'/courses',"Chargement des disciplines ...",year)
  }

  async on_select_cursus($event: MatSelectChange<any>) {
    this.selected_cursus=$event.value
    this.student_list=await this.get_students(this.selected_cursus.CODE) as any[]
    this.message=""
    // this.templates=[]
    // for (let t of await get_properties()){
    //   if(t.subject.indexOf(this.selected_cursus.code)>-1 || t.subject=="")this.templates.push(t)
    // }
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


  complete_discipline(discipline:any,cursus:string,y:number) {
    for(let d of this.cursus_disciplines[y.toString()]){
      if(d.CODE==discipline.CODE && d.CODE_MODULE==cursus){
        discipline.COURSE_TYPE=d.COURSE_TYPE
        return discipline
      }
    }
    return discipline
  }


  async get_all_evals() {
    try {
      return await firstValueFrom(this.http.get("all_evals.json"));
    } catch (e) {
      let rc: any = {}
      for (let y = 2016; y < 2026; y++) {
        rc[y.toString()]=[]
        for (let d of await this.api("courses","",y)){
          for(let e of await this.api("courses/"+d.CODE+"/assessments","",y)){
            e.STUDENT=e.STUDENT.CODE
            e.CODE_COURSE=d.CODE
            rc[y.toString()].push(e)
          }

        }
      }
      return rc
    }
  }


  async complete_student(student:any) {
    student.DISCIPLINES=[]
    for(let y=2017;y<=2026;y++){
      let d=await this.get_disciplines(student.CODE,y) as any[]
      for(let i=0;i<d.length;i++){
        d[i]=this.complete_discipline(d[i],this.selected_cursus.CODE,y)
        for(let e of await this.api("courses/"+d[i].CODE+"/assessments","Récupération des résultats ...",y)){
          if(e.STUDENT.CODE==student.CODE){
            d[i].MENTION=e.MENTION.LABEL
            d[i].VALIDATE=e.STATUS.LABEL
            d[i].COMMENT=e.COMMENT
          }
        }
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
        this.template_name=file.name.replace(".docx","")
        try{
          localStorage.setItem("template",this.template || "")
        }catch (e){
          console.log("Impossible de stocker le modele en local")
        }

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



  async generate_doc_from_frontend(to_save=true) {
    if (!this.template || !this.student_select || this.student_select.value.length === 0) {
      alert("Veuillez sélectionner un fichier et au moins un étudiant.");
      return;
    }

    const templateBuffer = this.base64ToUint8Array(this.template.split(",")[1])

    for(let student of this.student_select!.value){
      this.message="Traitement de "+student.FNAME+" "+student.LNAME
      student=await this.complete_student(student)

      let rc:any={}
      for(let k in student)
        rc["STUDENT_"+k]=translate_to_openxml(clear_text(student[k]))

      for(let k in this.selected_cursus)
        rc["CURSUS_"+k]=translate_to_openxml(clear_text(this.selected_cursus[k]))

      let disciplines=await this.api("/modules/"+this.selected_cursus.CODE+"/moduleCourses")

      try {

        //Voir la documentation : https://templatedocs.io/docs/intro
        this.message="Production du document"
        const doc=await new TemplateHandler().process(templateBuffer,rc)

        saveDataToFile(
          doc,
          this.template_name+"_"+student.LNAME+"_"+student.FNAME+".docx",
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        //if(to_save)saveAs(new Blob([out.buffer]), `document_${student.LNAME}_${student.FNAME}.docx`);
        this.clear_form()
      } catch (error) {
        console.error("Erreur lors de la génération du document pour " + student.FNAME, error);
      }
    }
    this.message=""
  }

  async generate_doc(to_save=true) {
    if (!this.template || !this.student_select || this.student_select.value.length === 0) {
      alert("Veuillez sélectionner un fichier et au moins un étudiant.");
      return;
    }

    const templateBuffer:string = this.template.split(",")[1]

    for(let student of this.student_select!.value){
      this.message="Traitement de "+student.FNAME+" "+student.LNAME
      student=await this.complete_student(student)

      let rc:any={}
      for(let k in student)
        rc["STUDENT_"+k]=translate_to_openxml(clear_text(student[k]))

      for(let k in this.selected_cursus)
        rc["CURSUS_"+k]=translate_to_openxml(clear_text(this.selected_cursus[k]))

      let disciplines=await this.api("/modules/"+this.selected_cursus.CODE+"/moduleCourses")

      try {

        //Voir la documentation : https://templatedocs.io/docs/intro
        this.message="Production du document"
        const doc=await this.api_doc("/merge-docx/",{data:rc,template:templateBuffer})

        saveDataToFile(
          doc,
          this.template_name+"_"+student.LNAME+"_"+student.FNAME+".docx",
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        //if(to_save)saveAs(new Blob([out.buffer]), `document_${student.LNAME}_${student.FNAME}.docx`);
        this.clear_form()
      } catch (error) {
        console.error("Erreur lors de la génération du document pour " + student.FNAME, error);
      }
    }
    this.message=""
  }

  protected clear_doc() {
    this.template=undefined
  }
}
