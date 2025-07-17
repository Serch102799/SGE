import {
  AfterViewInit,
  NgZone,
  Component,
  OnInit,
  HostListener,
  ViewEncapsulation, ElementRef
} from '@angular/core';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AdminComponent implements OnInit, AfterViewInit {
  constructor(
    private el: ElementRef,
    private ngZone: NgZone,
  ) {
  }
  ngOnInit(): void {

  }
  ngAfterViewInit() {

  }

}