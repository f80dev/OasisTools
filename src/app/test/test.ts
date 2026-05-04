import {Component, OnInit} from '@angular/core';
import {TemplateHandler, RawXmlPlugin, createDefaultPlugins} from 'easy-template-x';
import {get_properties, saveDataToFile, translate_to_openxml} from '../../tools';

@Component({
  selector: 'app-test',
  imports: [],
  templateUrl: './test.html',
  styleUrl: './test.css',
})
export class Test implements OnInit {
    async ngOnInit() {
      const docs=await get_properties()
      console.log(docs)
    }

}
