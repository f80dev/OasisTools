import {API_LOGIN} from './secret';
import {parseOffice} from 'officeparser';
import * as JSZip from 'jszip';
import {XMLParser} from 'fast-xml-parser';
import {OasisSettings, SETTINGS_KEY} from './app/preferences/preferences';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';

export function clear_text(text:any) : string {
  if(!text || typeof(text)!="string")return text
  for(let balise of ["<p>","</p>","<sup>","</sup>"]){
    text=text.replaceAll(balise,"")
  }
  for(let sub of [["de a","d'a"]]){
    text=text.replaceAll(sub[0],sub[1])
  }
  return text
}


export async function readfile(file:any) : Promise<{template:any,template_name:string}>{
  console.log('[readfile] Received parameter:', {
    type: typeof file,
    isBlob: file instanceof Blob,
    isFile: file instanceof File,
    value: file
  });
  return new Promise((resolve, reject) =>{
    const reader = new FileReader();
    reader.onload = () => {
      let template:any=reader.result
      let template_name=typeof file === 'object' && file.name ? file.name.replace(".docx","") : "unknown";
      console.log('[readfile] Successfully read file:', template_name);
      //localStorage.setItem("template",template || "")
      resolve({template:template,template_name:template_name})
    }
    reader.onerror = (error) => {
      console.error('[readfile] FileReader error:', error);
      reject(error);
    }
    console.log('[readfile] About to call readAsDataURL with:', file);
    reader.readAsDataURL(file);
  })

}


export function translate_to_openxml(text:any) : string | any {
  if(!text || typeof(text)!="string")return text

  const COLOR_MAP: { [key: string]: string } = {
    red: "FF0000",
    blue: "0000FF",
    green: "00FF00",
    // Ajoutez d'autres couleurs si nécessaire
  };

  const outputParts: string[] = [];
  let styleStack: { type: 'bold' | 'color', value?: string }[] = [];

  // Regex to find any opening or closing tag
  // Group 1: '/' for closing tag, empty for opening
  // Group 2: 'g' or 'color'
  // Group 3: color name if it's a color tag
  const tagRegex = /<(\/?)(g|color:([a-zA-Z]+))>/g;
  let lastIndex = 0;
  let match;
  if(tagRegex.exec(text)==null)return text

  while ((match = tagRegex.exec(text)) !== null) {
    // Extract text segment before the current tag
    const textSegment = text.substring(lastIndex, match.index);
    if (textSegment) {
      outputParts.push(generateOpenXmlRun(textSegment, styleStack, COLOR_MAP));
    }

    const isClosingTag = match[1] === '/';
    const fullTagName = match[2]; // e.g., 'g' or 'color:red'
    const colorName = match[3]; // e.g., 'red'

    if (isClosingTag) {
      // Pop style from stack
      if (fullTagName === 'g') {
        const index = styleStack.findIndex(s => s.type === 'bold');
        if (index !== -1) styleStack.splice(index, 1);
      } else if (fullTagName.startsWith('color:')) {
        const index = styleStack.findIndex(s => s.type === 'color' && s.value === colorName);
        if (index !== -1) styleStack.splice(index, 1);
      }
    } else {
      // Push style onto stack
      if (fullTagName === 'g') {
        styleStack.push({ type: 'bold' });
      } else if (fullTagName.startsWith('color:')) {
        styleStack.push({ type: 'color', value: colorName });
      }
    }
    lastIndex = tagRegex.lastIndex;
  }

  // Process any remaining text after the last tag
  const remainingText = text.substring(lastIndex);
  if (remainingText) {
    outputParts.push(generateOpenXmlRun(remainingText, styleStack, COLOR_MAP));
  }

  return {_type:"rawXml",xml:outputParts.join('')};
}

export function local_settings() : OasisSettings {
  return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
}




function generateOpenXmlRun(
  content: string,
  styleStack: { type: 'bold' | 'color', value?: string }[],
  COLOR_MAP: { [key: string]: string }
): string {
  let properties = '';
  let isBold = false;
  let colorHex = '';

  for (const style of styleStack) {
    if (style.type === 'bold') {
      isBold = true;
    } else if (style.type === 'color' && style.value) {
      const mappedColor = COLOR_MAP[style.value.toLowerCase()];
      if (mappedColor) {
        colorHex = mappedColor;
      }
    }
  }

  if (isBold) {
    properties += '<w:b/>';
  }
  if (colorHex) {
    properties += `<w:color w:val="${colorHex}"/>`;
  }

  if (properties) {
    return `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${content}</w:t></w:r>`;
  } else {
    return `<w:r><w:t xml:space="preserve">${content}</w:t></w:r>`;
  }
}


export function get_headers(config = 'prod') : any {
  const s: 'test' | 'prod' = (config === 'development' ? "test" : "prod");
  return {
    'accept': 'application/json',
    'Authorization': 'Basic '+btoa(API_LOGIN[s].username+":"+API_LOGIN[s].password),
    'Content-Type': 'application/json'
  };
}



export function downloadURL  (data:any, fileName:string)  {
  const a = document.createElement('a');
  a.href = data;
  a.download = fileName;
  document.body.appendChild(a);
  a.style = 'display: none';
  a.click();
  a.remove();
}




export function saveDataToFile(data:any, fileName:string, mimeType:string) {
  const blob = new Blob([data], {type: mimeType});
  const url = window.URL.createObjectURL(blob);
  downloadURL(url, fileName);
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
}

// Simple obfuscation for localStorage data - Base64 encoding with prefix
// Note: This provides NO cryptographic security, just makes data less readable in localStorage
const OBFUSCATION_PREFIX = 'OBS:';

export function obfuscateData(data: string): string {
  if (!data) return data;
  try {
    // Simple Base64 encoding with prefix for identification
    return OBFUSCATION_PREFIX + btoa(data);
  } catch (e) {
    console.error('Obfuscation error:', e);
    return data;
  }
}

export function deobfuscateData(obfuscatedData: string): string {
  if (!obfuscatedData) return obfuscatedData;
  try {
    if (!obfuscatedData.startsWith(OBFUSCATION_PREFIX)) {
      return obfuscatedData;
    }
    const encoded = obfuscatedData.substring(OBFUSCATION_PREFIX.length);
    return atob(encoded);
  } catch (e) {
    console.error('Deobfuscation error:', e);
    return obfuscatedData;
  }
}

export function setSecureItem(key: string, value: any): void {
  try {
    const jsonStr = JSON.stringify(value);
    localStorage.setItem(key, obfuscateData(jsonStr));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

export function getSecureItem(key: string): any {
  try {
    const obfuscatedData = localStorage.getItem(key);
    if (!obfuscatedData) return null;
    const deobfuscated = deobfuscateData(obfuscatedData);
    return JSON.parse(deobfuscated);
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return null;
  }
}



/**
 * Parse CSV content to JSON array
 * @param csvContent - The CSV string content
 * @returns Array of objects with headers as keys
 */
export function parseCsvToJson(csvContent: string): any[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Parse header row, handling quoted fields
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const result: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    result.push(obj);
  }
  return result;
}


export function translate_country(code:string) : string {
  const countries:any={
    "AD": "Andorre",
    "AE": "Émira arabes unis",
    "AF": "Afghanistan",
    "AG": "Antigua-et-Barbuda",
    "AL": "Albanie",
    "AM": "Arménie",
    "AO": "Angola",
    "AR": "Argentine",
    "AT": "Autriche",
    "AU": "Australie",
    "AZ": "Azerbaïdjan",
    "BA": "Bosnie-Herzégovine",
    "BB": "Barbade",
    "BD": "Bangladesh",
    "BE": "Belgique",
    "BF": "Burkina Faso",
    "BG": "Bulgarie",
    "BH": "Bahreïn",
    "BI": "Burundi",
    "BJ": "Bénin",
    "BN": "Brunéi Darussalam",
    "BO": "Bolivie",
    "BR": "Brésil",
    "BS": "Bahamas",
    "BT": "Bhoutan",
    "BW": "Botswana",
    "BY": "Biélorussie",
    "BZ": "Belize",
    "CA": "Canada",
    "CD": "République démocratique du Congo",
    "CF": "République centrafricaine",
    "CG": "République du Congo",
    "CH": "Suisse",
    "CI": "Côte d'Ivoire",
    "CL": "Chili",
    "CM": "Cameroun",
    "CN": "Chine",
    "CO": "Colombie",
    "CR": "Costa Rica",
    "CU": "Cuba",
    "CV": "Cap-Vert",
    "CY": "Chypre",
    "DE": "Allemagne",
    "DJ": "Djibouti",
    "DK": "Danemark",
    "DM": "Dominique",
    "DO": "République dominicaine",
    "DZ": "Algérie",
    "EC": "Équateur",
    "EE": "Estonie",
    "EG": "Égypte",
    "ER": "Érythrée",
    "ES": "Espagne",
    "ET": "Éthiopie",
    "FI": "Finlande",
    "FJ": "Fidji",
    "FM": "Micronésie",
    "FR": "France",
    "GA": "Gabon",
    "GB": "Royaume-Uni",
    "GD": "Grenade",
    "GE": "Géorgie",
    "GH": "Ghana",
    "GM": "Gambie",
    "GN": "Guinée",
    "GQ": "Guinée équatoriale",
    "GR": "Grèce",
    "GT": "Guatemala",
    "GW": "Guinée-Bissau",
    "GY": "Guyana",
    "HN": "Honduras",
    "HR": "Croatie",
    "HT": "Haïti",
    "HU": "Hongrie",
    "ID": "Indonésie",
    "IE": "Irlande",
    "IL": "Israël",
    "IN": "Inde",
    "IQ": "Irak",
    "IR": "Iran",
    "IS": "Islande",
    "IT": "Italie",
    "JM": "Jamaïque",
    "JO": "Jordanie",
    "JP": "Japon",
    "KE": "Kenya",
    "KG": "Kirghizistan",
    "KH": "Cambodge",
    "KI": "Kiribati",
    "KM": "Comores",
    "KN": "Saint-Christophe-et-Niévès",
    "KP": "Corée du Nord",
    "KR": "Corée du Sud",
    "KW": "Koweït",
    "KZ": "Kazakhstan",
    "LA": "Laos",
    "LB": "Liban",
    "LC": "Sainte-Lucie",
    "LI": "Liechtenstein",
    "LK": "Sri Lanka",
    "LR": "Libéria",
    "LS": "Lesotho",
    "LT": "Lituanie",
    "LU": "Luxembourg",
    "LV": "Lettonie",
    "LY": "Libye",
    "MA": "Maroc",
    "MC": "Monaco",
    "MD": "Moldavie",
    "ME": "Monténégro",
    "MG": "Madagascar",
    "MH": "Îles Marshall",
    "MK": "Macédoine du Nord",
    "ML": "Mali",
    "MM": "Myanmar (Birmanie)",
    "MN": "Mongolie",
    "MR": "Mauritanie",
    "MT": "Malte",
    "MU": "Maurice",
    "MV": "Maldives",
    "MW": "Malawi",
    "MX": "Mexique",
    "MY": "Malaisie",
    "MZ": "Mozambique",
    "NA": "Namibie",
    "NE": "Niger",
    "NG": "Nigéria",
    "NI": "Nicaragua",
    "NL": "Pays-Bas",
    "NO": "Norvège",
    "NP": "Népal",
    "NR": "Nauru",
    "NZ": "Nouvelle-Zélande",
    "OM": "Oman",
    "PA": "Panama",
    "PE": "Pérou",
    "PG": "Papouasie-Nouvelle-Guinée",
    "PH": "Philippines",
    "PK": "Pakistan",
    "PL": "Pologne",
    "PT": "Portugal",
    "PW": "Palaos",
    "PY": "Paraguay",
    "QA": "Qatar",
    "RO": "Roumanie",
    "RS": "Serbie",
    "RU": "Russie",
    "RW": "Rwanda",
    "SA": "Arabie saoudite",
    "SB": "Îles Salomon",
    "SC": "Seychelles",
    "SD": "Soudan",
    "SE": "Suède",
    "SG": "Singapour",
    "SI": "Slovénie",
    "SK": "Slovaquie",
    "SL": "Sierra Leone",
    "SM": "Saint-Marin",
    "SN": "Sénégal",
    "SO": "Somalie",
    "SR": "Suriname",
    "SS": "Soudan du Sud",
    "ST": "Sao Tomé-et-Principe",
    "SY": "Syrie",
    "SZ": "Eswatini",
    "TD": "Tchad",
    "TG": "Togo",
    "TH": "Thaïlande",
    "TJ": "Tadjikistan",
    "TL": "Timor oriental",
    "TM": "Turkménistan",
    "TN": "Tunisie",
    "TO": "Tonga",
    "TR": "Turquie",
    "TT": "Trinité-et-Tobago",
    "TV": "Tuvalu",
    "TW": "Taïwan",
    "TZ": "Tanzanie",
    "UA": "Ukraine",
    "UG": "Ouganda",
    "US": "États-Unis",
    "UY": "Uruguay",
    "UZ": "Ouzbékistan",
    "VA": "Vatican",
    "VC": "Saint-Vincent-et-les-Grenadines",
    "VE": "Venezuela",
    "VN": "Viêt Nam",
    "VU": "Vanuatu",
    "WS": "Samoa",
    "YE": "Yémen",
    "ZA": "Afrique du Sud",
    "ZM": "Zambie",
    "ZW": "Zimbabwe"
  }
  return countries[code]
}



/**
 * Parse a single CSV line handling quoted fields and comma separators
 * @param line - A CSV line string
 * @returns Array of field values
 */
export function parseCSVLine(line: string): string[] {
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




 /**
 * Import and parse a CSV file from the static directory
 * @param filename - The filename (e.g., 'secteurs.csv' from public/ directory)
 * @param keyName - The key name to wrap the result array in the returned object
 * @returns Observable of parsed CSV data as {keyName: array}
 */
export function importCsvAsJson(filename: string, keyNames: string, http:HttpClient): Observable<{ [key: string]: any[] }> {
  return new Observable<{ [key: string]: any[] }>(observer => {
    http.get(`/${filename}`, { responseType: 'text' })
      .subscribe({
        next: (csvContent: string) => {
          try {
            const wrapped: any={}

            for(let row of parseCsvToJson(csvContent)){
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
        error: (error:any) => observer.error(error)
      });
  });
}


export async function get_properties_old(files:string[]=["template.docx"]) {
  let rc=[]
  for(let file of files){
    rc.push(await parseOffice(await (await fetch(file)).arrayBuffer()))
  }
  return rc
}


export async function get_properties(files: string[] = ["student.docx"]) {
  const rc = [];
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

  for (const file of files) {
    try {
      // 1. Récupération du fichier en ArrayBuffer
      const response = await fetch(file);
      const arrayBuffer = await response.arrayBuffer();

      // 2. Chargement du ZIP (le .docx)
      const zip = await JSZip.loadAsync(arrayBuffer);
      const coreXmlFile = zip.file("docProps/core.xml");

      if (coreXmlFile) {
        const xmlContent = await coreXmlFile.async("string");
        const jsonObj = parser.parse(xmlContent);
        const props = jsonObj.coreProperties;

        // 3. Extraction ciblée des propriétés demandées
        rc.push({
          fileName: file,
          subject: props.subject || null,
          category: props.category || null,
          keywords: props.keywords || null,
          lastModifiedBy: props.lastModifiedBy || null
        });
      }
    } catch (error) {
      console.error(`Erreur sur le fichier ${file}:`, error);
      rc.push({ fileName: file, error: "Parsing failed" });
    }
  }
  return rc;
}

