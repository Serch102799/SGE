import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-breadscrumb',
  standalone: false,

  templateUrl: './breadscrumb.component.html',
  styleUrl: './breadscrumb.component.css'
})
export class BreadscrumbComponent {
@Input() breadScrumbText: any;
}
