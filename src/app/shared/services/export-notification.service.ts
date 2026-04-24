import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'pdf' | 'excel' | 'error' | 'warning' | 'success';

export interface ExportToast {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  visible: boolean;
  progress: number; // 0-100
}

@Injectable({
  providedIn: 'root'
})
export class ExportNotificationService {

  private toasts$ = new BehaviorSubject<ExportToast[]>([]);
  toasts = this.toasts$.asObservable();

  private idCounter = 0;

  show(type: ToastType, title: string, message: string, duration: number = 4000): void {
    const id = ++this.idCounter;
    const toast: ExportToast = { id, type, title, message, visible: true, progress: 100 };

    const current = this.toasts$.getValue();
    this.toasts$.next([...current, toast]);

    // Animate progress bar down
    const interval = 50;
    const decrement = (interval / duration) * 100;
    const timer = setInterval(() => {
      const toasts = this.toasts$.getValue();
      const idx = toasts.findIndex(t => t.id === id);
      if (idx === -1) { clearInterval(timer); return; }
      const updated = [...toasts];
      updated[idx] = { ...updated[idx], progress: Math.max(0, updated[idx].progress - decrement) };
      this.toasts$.next(updated);
    }, interval);

    // Remove after duration
    setTimeout(() => {
      clearInterval(timer);
      this.dismiss(id);
    }, duration);
  }

  dismiss(id: number): void {
    const toasts = this.toasts$.getValue().filter(t => t.id !== id);
    this.toasts$.next(toasts);
  }

  showPdf(filename: string): void {
    this.show('pdf', '📄 PDF Generado', `Archivo descargado: ${filename}`, 5000);
  }

  showExcel(filename: string): void {
    this.show('excel', '📊 Excel Generado', `Archivo descargado: ${filename}`, 5000);
  }

  showError(message: string): void {
    this.show('error', '❌ Error de Exportación', message, 6000);
  }

  showGenerating(type: 'pdf' | 'excel'): void {
    const label = type === 'pdf' ? 'PDF' : 'Excel';
    this.show(type, `⏳ Generando ${label}...`, 'Procesando datos, por favor espera...', 3000);
  }
}
