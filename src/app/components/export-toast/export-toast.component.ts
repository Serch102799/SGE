import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ExportNotificationService, ExportToast } from '../../shared/services/export-notification.service';

@Component({
  selector: 'app-export-toast',
  standalone: false,
  template: `
    <div class="toast-container">
      <div
        class="export-toast"
        *ngFor="let toast of toasts; trackBy: trackById"
        [ngClass]="'toast-' + toast.type"
      >
        <div class="toast-glow"></div>

        <div class="toast-icon-wrap">
          <!-- PDF Icon -->
          <svg *ngIf="toast.type === 'pdf'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <!-- Excel Icon -->
          <svg *ngIf="toast.type === 'excel'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="17"/>
            <line x1="16" y1="13" x2="8" y2="17"/>
          </svg>
          <!-- Error Icon -->
          <svg *ngIf="toast.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <!-- Warning Icon -->
          <svg *ngIf="toast.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <!-- Success Icon -->
          <svg *ngIf="toast.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>

          <div class="toast-icon-ring"></div>
        </div>

        <div class="toast-body">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-message">{{ toast.message }}</div>
          <div class="toast-progress-track">
            <div class="toast-progress-bar" [style.width.%]="toast.progress"></div>
          </div>
        </div>

        <button class="toast-close" (click)="dismiss(toast.id)" title="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./export-toast.component.css']
})
export class ExportToastComponent implements OnInit, OnDestroy {
  toasts: ExportToast[] = [];
  private sub?: Subscription;

  constructor(private exportNotif: ExportNotificationService) {}

  ngOnInit(): void {
    this.sub = this.exportNotif.toasts.subscribe(t => this.toasts = t);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(id: number): void {
    this.exportNotif.dismiss(id);
  }

  trackById(_: number, toast: ExportToast): number {
    return toast.id;
  }
}
