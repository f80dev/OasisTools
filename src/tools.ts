import {API_PASSWORD, API_USER} from './secret';

export function get_header(username=API_USER,password=API_PASSWORD): any {
  return {
    'accept': 'application/json',
    'Authorization': 'Basic '+btoa(username+":"+password),
    'Content-Type': 'application/json'
  };
}
