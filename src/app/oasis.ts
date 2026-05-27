import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {clear_text, get_headers, local_settings, saveDataToFile, translate_to_openxml} from '../tools';

@Injectable({
  providedIn: 'root',
})
export class Oasis {

  http=inject(HttpClient)
  vm:any

  build_url(url:string,year=2025) {
    const baseUrl = local_settings().evalProxyVersion;
    return "/api/v2/"+year+"/"+url
  }

  async get(url:string,message="",year=2025) {
    if(this.vm)this.vm.message=message
    let rc: any =[]
    try{
      rc = await firstValueFrom(this.http.get(this.build_url(url,year), {headers: get_headers()}));
    }catch (e){

    }
    return rc
  }



}
