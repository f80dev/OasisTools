import {API_LOGIN} from './secret';

export function get_headers(config = 'prod') : any {
  const s: 'test' | 'prod' = (config === 'development' ? "test" : "prod");
  return {
    'accept': 'application/json',
    'Authorization': 'Basic '+btoa(API_LOGIN[s].username+":"+API_LOGIN[s].password),
    'Content-Type': 'application/json'
  };
}
