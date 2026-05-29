import {inject, Injectable} from '@angular/core';
import {firstValueFrom, Observable} from 'rxjs';
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



  /**
   * Import and parse a CSV file from the static directory
   * @param filename - The filename (e.g., 'secteurs.csv' from public/ directory)
   * @param keyName - The key name to wrap the result array in the returned object
   * @returns Observable of parsed CSV data as {keyName: array}
   */
  importCsvAsJson(filename: string, keyNames: string): Observable<{ [key: string]: any[] }> {
    return new Observable<{ [key: string]: any[] }>(observer => {
      this.http.get(`/${filename}`, { responseType: 'text' })
        .subscribe({
          next: (csvContent: string) => {
            try {
              const wrapped: any={}

              for(let row of this.parseCsvToJson(csvContent)){
                const keys=keyNames.split(",")
                if(keys.length>1){
                  if(wrapped.hasOwnProperty(row[keys[0]])){
                    wrapped[row[keys[0]]][keys[1]]=row
                  }else{
                    const s:string=row[keys[1]]
                    wrapped[row[keys[0]]]={s:row}
                  }
                }else{
                  wrapped[row[keyNames]]=row
                }
              }

              observer.next(wrapped);
              observer.complete();
            } catch (error) {
              observer.error(error);
            }
          },
          error: (error) => observer.error(error)
        });
    });
  }

  /**
   * Parse CSV content to JSON array
   * @param csvContent - The CSV string content
   * @returns Array of objects with headers as keys
   */
  private parseCsvToJson(csvContent: string): any[] {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    // Parse header row, handling quoted fields
    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);

    const result: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      result.push(obj);
    }
    return result;
  }

  /**
   * Parse a single CSV line handling quoted fields and comma separators
   * @param line - A CSV line string
   * @returns Array of field values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
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
