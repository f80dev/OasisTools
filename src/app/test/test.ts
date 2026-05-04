import {Component, OnInit} from '@angular/core';
import {TemplateHandler, RawXmlPlugin, createDefaultPlugins} from 'easy-template-x';
import {saveDataToFile, translate_to_openxml} from '../../tools';

@Component({
  selector: 'app-test',
  imports: [],
  templateUrl: './test.html',
  styleUrl: './test.css',
})
export class Test implements OnInit {
    async ngOnInit() {
      const data={"CURSUS_NAME": translate_to_openxml("<g><color:red>Herve</color:red></g> non <color:green>gras</color:green> <g>comment</g> non gras <g>ça</g> va")}

      // Fetch the template.docx file
      const response = await fetch('template.docx');
      const templateBuffer = await response.arrayBuffer();


      const engine=new TemplateHandler({plugins:createDefaultPlugins()})
      const doc=await engine.process(templateBuffer,data)

      saveDataToFile(
        doc,
        'report.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    }

}
