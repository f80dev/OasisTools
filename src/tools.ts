import {API_LOGIN} from './secret';

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


