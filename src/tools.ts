import {API_LOGIN} from './secret';
import {parseOffice} from 'officeparser';
import * as JSZip from 'jszip';
import {XMLParser} from 'fast-xml-parser';

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

