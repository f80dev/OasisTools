import {Component, inject, OnInit, ViewChild} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {
  clear_text,
  get_headers,
  local_settings,
  readfile,
  saveDataToFile,
  translate_country,
  translate_to_openxml
} from '../../tools';
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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

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

  // In-memory cache for HTTP GET requests
  private httpCache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes default TTL

  /**
   * Cached HTTP GET request - returns cached data if available and not expired
   */
  private async cachedGet<T>(url: string, ttl: number = this.DEFAULT_CACHE_TTL): Promise<T> {
    const cacheKey = url;
    const now = Date.now();

    // Check if cached data exists and is not expired
    const cached = this.httpCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < cached.ttl) {
      console.log('[Docs Cache] HIT:', url, '(age:', Math.round((now - cached.timestamp) / 1000), 's)');
      return cached.data;
    }

    console.log('[Docs Cache] MISS:', url);
    // Fetch fresh data
    const data = await firstValueFrom(this.http.get<T>(url));

    // Store in cache
    this.httpCache.set(cacheKey, {
      data,
      timestamp: now,
      ttl
    });

    return data;
  }

  /**
   * Clear the HTTP cache
   */
  clearHttpCache(): void {
    this.httpCache.clear();
    console.log('[Docs Cache] Cleared');
  }

  /**
   * Invalidate a specific cached entry
   */
  invalidateCache(url: string): void {
    this.httpCache.delete(url);
    console.log('[Docs Cache] Invalidated:', url);
  }

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
  private ue:any
  public template_name: string=""
  private data:any={}

  async ngOnInit()  {
    // Test connectivity with health endpoint
    try {
      await firstValueFrom(this.http.get("/doc/health/"));

      console.log('[Docs] Health check passed');
    } catch (e) {
      console.error('[Docs] Health check failed:', e);
    }

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
      if(localStorage.getItem("last_saved_cursus")){
        const savedCursus = JSON.parse(localStorage.getItem("last_saved_cursus") || "{}");
        // Find the actual reference in cursus_list by CODE to fix mat-select display issue
        const matchingCursus = this.cursus_list.find((c: any) => c.CODE === savedCursus.CODE);
        if (matchingCursus) {
          this.selected_cursus = matchingCursus;
          console.log('[DEBUG ngOnInit] Restored last_saved_cursus by reference:', matchingCursus.CODE);
        } else {
          this.selected_cursus = this.cursus_list[0];
          console.log('[DEBUG ngOnInit] Saved cursus not found, using first one');
        }
        await this.on_select_cursus({value: this.selected_cursus} as MatSelectChange);
      }else{
        await this.on_select_cursus({ value: this.cursus_list[0] } as MatSelectChange);
      }

    }

    this.cursus_disciplines=await this.cachedGet("contenudescursus.json");
    this.ue=await this.cachedGet("contenudescursus.json");
    this.template=localStorage.getItem("template")
  }




  async get_doc(url:string,data:any,message="") {
    url = `/doc${url}`;
    console.log('[get_doc] Full URL:', url);
    this.message=message
    return await firstValueFrom(this.http.post(url, data));
  }


  async get_cursus() {
    return await this.oasis.get('modules?subclass_detail=false&course_list=true',"chargement des cursus",this.selected_year)
  }



  async get_maquettage() {
    try {
      return await this.cachedGet("contenudescursus.json");
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
    // Save as last_saved_cursus immediately on selection
    localStorage.setItem("last_saved_cursus", JSON.stringify(this.selected_cursus));
    console.log('[DEBUG on_select_cursus] Saved last_saved_cursus:', this.selected_cursus.CODE);
    this.student_list=await this.get_students(this.selected_cursus.CODE) as any[]
    if (this.student_list && this.student_list.length > 0) {
      // Restore previously selected students instead of defaulting to first
      //this.restore_selected_students();
    } else {
      this.selected_students = [];
    }
    this.load_data_for_student()
    this.message=""
    // this.templates=[]
    // for (let t of await get_properties()){
    //   if(t.subject.indexOf(this.selected_cursus.code)>-1 || t.subject=="")this.templates.push(t)
    // }
  }

  async on_select_year($event: MatSelectChange<number>) {
    this.selected_year = $event.value;
  }




  async refresh_cursus() {
    console.log('[Docs] Force refreshing cursus for year:', this.selected_year);
    localStorage.removeItem("cursus");
    this.cursus_list = await this.get_cursus() as any[];
    for(let c of this.cursus_list){
      c.DESCRIPTION=""
      c.OBJECTIVES_AND_CONTENT=""
      c.DESCRIPTION_EN=""
      c.OBJECTIVES_AND_CONTENT_EN=""
    }
    localStorage.setItem("cursus",JSON.stringify(this.cursus_list));
    this.snackbar.open("Cursus actualisé", "Ok", {duration: 2000});
  }

  async on_file_selected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selected_file = input.files[0];
      let json:any=await readfile(this.selected_file)
      this.template_name=json.template_name
      this.template=json.template
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
      return await this.cachedGet("all_evals.json");
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

        const discipline_id=d[i].CODE

        for(let e of await this.oasis.get("courses/"+discipline_id+"/assessments","Récupération des résultats de "+student.FNAME,y)){
          if(e.STUDENT.CODE==student.CODE){
            d[i].MENTION=e.MENTION.LABEL
            d[i].VALIDATE=e.STATUS.LABEL
            d[i].COMMENT=e.COMMENT
          }
        }

        //recherche de l'ECTS
        if(this.selected_cursus.COURSES.hasOwnProperty(discipline_id)){
          d[i].ECTS=Number(this.selected_cursus.COURSES[discipline_id].ECTS)
        }else{
          console.log(d[i].CODE+" est hors cursus")
        }

        student.DISCIPLINES.push(d[i])
      }
    }
    return student
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

  saveBase64AsFile(base64Data: string, fileName: string) {
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
      link.download = fileName.endsWith('.zip') ? fileName : `${fileName}.zip`;
      link.click();

      // Nettoyage mémoire
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Error saving DOCX:', e);
    }
  };



  // Save selected students list to localStorage
  save_selected_students() {
    if (this.selected_cursus && this.selected_students && this.selected_students.length > 0) {
      const storageKey = `selected_students_${this.selected_cursus.CODE}`;
      const studentsToSave = this.selected_students.map(s => ({ CODE: s.CODE, LNAME: s.LNAME, FNAME: s.FNAME }));
      localStorage.setItem(storageKey, JSON.stringify(studentsToSave));
      console.log('[DEBUG save_selected_students] Saved', studentsToSave.length, 'students for cursus', this.selected_cursus.CODE);
    }
  }

  // Restore selected students list from localStorage
  restore_selected_students() {
    if (!this.selected_cursus || !this.student_list) {
      console.log('[DEBUG restore_selected_students] No cursus or student_list available');
      return;
    }
    const storageKey = `selected_students_${this.selected_cursus.CODE}`;
    const savedStudentsJson = localStorage.getItem(storageKey);
    if (savedStudentsJson) {
      try {
        const savedStudents = JSON.parse(savedStudentsJson) as any[];
        // Find matching students in the current student_list
        const restoredStudents = savedStudents
          .map((saved: any) => this.student_list?.find((s: any) => s.CODE === saved.CODE))
          .filter((s: any) => s !== undefined);

        if (restoredStudents.length > 0) {
          this.selected_students = restoredStudents;
          console.log('[DEBUG restore_selected_students] Restored', restoredStudents.length, 'students for cursus', this.selected_cursus.CODE);
        } else {
          console.log('[DEBUG restore_selected_students] No matching students found, keeping default selection');
          this.selected_students = [this.student_list[0]];
        }
      } catch (e) {
        console.error('[DEBUG restore_selected_students] Error parsing saved students:', e);
        this.selected_students = [this.student_list[0]];
      }
    } else {
      console.log('[DEBUG restore_selected_students] No saved students found for cursus', this.selected_cursus.CODE);
      this.selected_students = [this.student_list[0]];
    }
  }

  async load_data_for_student(with_disciplines=true) {
    console.log("Chargement des datas ")

    // Save selected students when loading data
    this.save_selected_students();

    for (let student of this.selected_students) {
      this.message = "Traitement de " + student.FNAME + " " + student.LNAME

      if(!this.data.hasOwnProperty(student.CODE)){
        let cache = localStorage.getItem(this.selected_cursus.CODE + "_" + student.LNAME)
        if (!cache) {
          student = await this.get_student(student.CODE)
          student["images"]={"PHOTO":student["PHOTO"]}
          student["BIRTHDATE"]=new Date(student["BIRTHDATE"]).toLocaleDateString()
          student["BIRTHPLACE"]=translate_country(student["BIRTHCOUNTRY"])

          if (with_disciplines) student = await this.complete_student(student)

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
    // DEBUG: Log current state before saving
    console.log('[DEBUG generate_doc] START');
    console.log('[DEBUG generate_doc] selected_cursus:', this.selected_cursus?.CODE, this.selected_cursus?.LABEL);
    console.log('[DEBUG generate_doc] selected_students:', this.selected_students?.map((s: any) => s.CODE + ' ' + s.LNAME));
    console.log('[DEBUG generate_doc] localStorage keys:', Object.keys(localStorage).filter(k => k.includes('last_saved') || k.includes('selected')));

    if (!this.template || !this.selected_students || this.selected_students.length === 0) {
      alert("Veuillez sélectionner un fichier et au moins un étudiant.");
      return;
    }
    await this.load_data_for_student()
    let datas=[]

    const templateBuffer: string = this.template.split(",")[1]
    for (let login in this.data){
        let data=this.data[login]
        data["DATE_NOW"]=new Date().toLocaleDateString()
        data["DATE_DOCUMENT"]=new Date().toLocaleDateString()
        data["DOCUMENT_DATE"]=new Date().toLocaleDateString()
        data["STUDENT_NAME"]=data["STUDENT_FNAME"]+" "+data["STUDENT_LNAME"]
        data["NOW"]=new Date().toLocaleDateString()
        data["TIME_NOW"]=new Date().toLocaleTimeString()
        data["ACADEMIC_YEARS"]=this.selected_year

        //Voir la documentation : https://templatedocs.io/docs/intro
        this.message="Production du document"

      datas.push(data)
    }
    const doc:any=await this.get_doc("/merge/",{template:templateBuffer,data: datas})
    this.saveBase64AsFile(doc.zip_base64,this.template_name+"_"+this.selected_cursus.NAME+".zip")

    this.message=""

    // Save last saved cursus and student for restoration on app load
    if (this.selected_cursus) {
      localStorage.setItem("last_saved_cursus", JSON.stringify(this.selected_cursus));
      console.log('[DEBUG generate_doc] Saved last_saved_cursus:', this.selected_cursus.CODE);
    }
    if (this.selected_students && this.selected_students.length > 0) {
      localStorage.setItem("last_saved_student", JSON.stringify(this.selected_students[0]));
      console.log('[DEBUG generate_doc] Saved last_saved_student:', this.selected_students[0].CODE);
    }
  }

  protected clear_doc() {
    this.template=undefined
    this.template_name=""
  }

  protected select_all_students() {
    if(this.student_list){
      this.selected_students=this.student_list
      this.load_data_for_student()
    }
  }
}
