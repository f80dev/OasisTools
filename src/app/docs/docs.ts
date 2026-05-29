import {Component, inject, OnInit, ViewChild} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {clear_text, get_headers, local_settings, saveDataToFile, translate_to_openxml} from '../../tools';
import {CommonModule} from "@angular/common";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule, MatSelect, MatSelectChange} from "@angular/material/select";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatIconModule} from "@angular/material/icon";
import {FormsModule} from "@angular/forms";
import {MatSnackBar} from '@angular/material/snack-bar';
import {Oasis} from '../oasis';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
    FormsModule,
  ],
  templateUrl: './docs.html',
  styleUrl: './docs.css',
})
export class Docs implements OnInit {

  snackbar=inject(MatSnackBar)
  oasis=inject(Oasis)
  http=inject(HttpClient)

  public cursus_list: any[] | undefined
  public student_list: any[] | undefined
  public selected_file: File | undefined;
  @ViewChild('studentselect') student_select: MatSelect | undefined;
  protected message=""

  public selected_cursus: any | undefined
  public selected_students: any[] = [];
  public selected_year: number = 2025
  public year_list: number[] = [2025, 2024, 2023,2022,2021,2020]
  public template: any;
  private cursus_disciplines:any
  public template_name: string=""
  private data:any={}

  async ngOnInit()  {
    const json_cursus=localStorage.getItem("cursus")
    if(json_cursus){
      this.cursus_list=JSON.parse(json_cursus)
    }else{
      this.cursus_list=await this.get_cursus() as any[]
      for(let c of this.cursus_list){
        c.DESCRIPTION=""
        c.OBJECTIVES_AND_CONTENT=""
        c.DESCRIPTION_EN=""
        c.OBJECTIVES_AND_CONTENT_EN=""
      }
      localStorage.setItem("cursus",JSON.stringify(this.cursus_list))
    }

    //Sélectionne le premier cursus
    if (this.cursus_list && this.cursus_list.length > 0) {
      if(localStorage.getItem("selected_cursus")){
        this.selected_cursus=JSON.parse(localStorage.getItem("selected_cursus") || "{}")
        await this.on_select_cursus({value:this.selected_cursus}  as MatSelectChange)
      }else{
        await this.on_select_cursus({ value: this.cursus_list[0] } as MatSelectChange);
      }

    }

    this.cursus_disciplines=await this.get_maquettage()
    this.template=localStorage.getItem("template")
  }




  async get_doc(url:string,data:any,message="") {
    const baseUrl = local_settings().docApiUrl
    url = `${baseUrl}/doc${url}`;
    this.message=message
    return await firstValueFrom(this.http.post(url, data));
  }


  async get_cursus() {
    return await this.oasis.get('modules?subclass_detail=false',"chargement des cursus",this.selected_year)
    }

  async get_maquettage() {
    try {
      return await firstValueFrom(this.http.get("contenudescursus.json"));
    } catch (e) {
      let rc: any = {}
      for (let y = 2016; y < 2026; y++) {
        let k = y.toString()
        rc[k] = await this.oasis.get('moduleCourses', "chargement du maquettage", y)
      }
      return rc
    }
  }

  async get_students(cursus:string) {
    return await this.oasis.get('modules/'+cursus+'/students',"chargement des étudiants ...",this.selected_year)
  }

  async get_student(login:string) {
    return await this.oasis.get('students/'+login,"chargement du detail de l'étudiant ...",this.selected_year)
  }

  async get_disciplines(student:string,year:number) {
    return await this.oasis.get('students/'+student+'/courses',"Chargement des disciplines ...",year)
  }

  async get_eval_disciplines(student:string,discipline:string,year:number) {
    return await this.oasis.get('students/'+student+'/courses',"Chargement des disciplines ...",year)
  }

  async on_select_cursus($event: MatSelectChange<any>) {
    this.selected_cursus=$event.value
    localStorage.setItem("selected_cursus",JSON.stringify(this.selected_cursus))
    this.student_list=await this.get_students(this.selected_cursus.CODE) as any[]
    if (this.student_list && this.student_list.length > 0) {
      this.selected_students = [this.student_list[0]];
    } else {
      this.selected_students = [];
    }
    this.load_data()
    this.message=""
    // this.templates=[]
    // for (let t of await get_properties()){
    //   if(t.subject.indexOf(this.selected_cursus.code)>-1 || t.subject=="")this.templates.push(t)
    // }
  }

  async on_select_year($event: MatSelectChange<number>) {
    this.selected_year = $event.value;
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
        for (let d of await this.oasis.get("courses","",y)){
          for(let e of await this.oasis.get("courses/"+d.CODE+"/assessments","",y)){
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
        d[i].FR_OBJECTIVE=""
        d[i].EN_OBJECTIVE=""
        d[i].FR_REQUISIT=""
        d[i].FR_EXAM=""
        d[i].EN_REQUISIT=""
        d[i].REWARD_EN=""

        for(let e of await this.oasis.get("courses/"+d[i].CODE+"/assessments","Récupération des résultats de "+student.FNAME,y)){
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
        localStorage.setItem("template",this.template || "")
        resolve(true)
      }})
  }




  private base64ToUint8Array(base64: string) {
    // Validate base64 input to prevent XSS attacks
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      console.error('Invalid base64 input detected');
      return null;
    }
    try {
      const binary_string = window.atob(base64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (e) {
      console.error('Base64 decoding error:', e);
      return null;
    }
  }



  // async generate_doc_from_frontend(to_save=true) {
  //   if (!this.template || !this.student_select || this.student_select.value.length === 0) {
  //     alert("Veuillez sélectionner un fichier et au moins un étudiant.");
  //     return;
  //   }
  //
  //   const templateBuffer = this.base64ToUint8Array(this.template.split(",")[1])
  //
  //   for(let student of this.student_select!.value){
  //     this.message="Traitement de "+student.FNAME+" "+student.LNAME
  //     student=await this.complete_student(student)
  //
  //     let rc:any={}
  //     for(let k in student)
  //       rc["STUDENT_"+k]=translate_to_openxml(clear_text(student[k]))
  //
  //     for(let k in this.selected_cursus)
  //       rc["CURSUS_"+k]=translate_to_openxml(clear_text(this.selected_cursus[k]))
  //
  //     //let disciplines=await this.oasis.get("/modules/"+this.selected_cursus.CODE+"/moduleCourses")
  //
  //     try {
  //
  //       //Voir la documentation : https://templatedocs.io/docs/intro
  //       this.message="Production du document"
  //       const doc=await new TemplateHandler().process(templateBuffer,rc)
  //
  //       saveDataToFile(
  //         doc,
  //         this.template_name+"_"+student.LNAME+"_"+student.FNAME+".docx",
  //         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  //       )
  //       //if(to_save)saveAs(new Blob([out.buffer]), `document_${student.LNAME}_${student.FNAME}.docx`);
  //       this.clear_form()
  //     } catch (error) {
  //       console.error("Erreur lors de la génération du document pour " + student.FNAME, error);
  //     }
  //   }
  //   this.message=""
  // }
  protected selected_format: string="docx"

  saveBase64AsDocx(base64Data: string, fileName: string) {
    // Validate base64 input to prevent XSS attacks
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

      // 3. Créer le Blob avec le type MIME Word
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      // 4. Déclencher le téléchargement
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
      link.click();

      // Nettoyage mémoire
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Error saving DOCX:', e);
    }
  };



  async load_data(with_disciplines=true) {
    console.log("Chargement des datas ")


    for (let student of this.selected_students) {
      this.message = "Traitement de " + student.FNAME + " " + student.LNAME

      if(!this.data.hasOwnProperty(student.CODE)){
        let cache = localStorage.getItem(this.selected_cursus.CODE + "_" + student.LNAME)
        if (!cache) {
          student = await this.get_student(student.CODE)
          student["images"]={"PHOTO":student["PHOTO"]}
          if (with_disciplines) student = await this.complete_student(student)
          localStorage.setItem(this.selected_cursus.CODE + "_" + student.LNAME, JSON.stringify(student))
        } else {
          student = JSON.parse(cache)
        }

        let obj:any={}
        for (let k in student)
            if(k!="images"){
              obj["STUDENT_" + k] = translate_to_openxml(clear_text(student[k]))
            }

        for (let k in this.selected_cursus)
            obj["CURSUS_" + k] = translate_to_openxml(clear_text(this.selected_cursus[k]))

        //let disciplines=await this.oasis.get("/modules/"+this.selected_cursus.CODE+"/moduleCourses")

        this.data[student.CODE]=obj
      }
      this.message=""
    }

  }


  async generate_doc() {

    if (!this.template || !this.selected_students || this.selected_students.length === 0) {
      alert("Veuillez sélectionner un fichier et au moins un étudiant.");
      return;
    }
    await this.load_data()

    for (let login in this.data){

        let student=this.data[login]
        const templateBuffer: string = this.template.split(",")[1]

        //Voir la documentation : https://templatedocs.io/docs/intro
        this.message="Production du document"

        try{
          //appel du service https://console.cloud.google.com/run/detail/europe-west1/apidoc/yaml/view?hl=fr&project=apidoc-496918
          const doc:any=await this.get_doc("/merge-docx/",{format:this.selected_format,data: this.data[login],template:templateBuffer})
          this.saveBase64AsDocx(doc.document_base64,this.template_name+"_"+student.STUDENT_LNAME+"_"+student.STUDENT_FNAME+".docx")
        }catch (e){
          this.snackbar.open("Probleme avec le template","Ok")
        }


    }
    this.message=""
  }

  protected clear_doc() {
    this.template=undefined
    this.template_name=""
  }

  protected select_all_students() {
    if(this.student_list){
      this.selected_students=this.student_list
      this.load_data()
    }
  }
}
