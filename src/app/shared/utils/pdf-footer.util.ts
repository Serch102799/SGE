import jsPDF from 'jspdf';

/**
 * Agrega pie de página a cada hoja del documento PDF.
 * @param doc Instancia del documento jsPDF
 * @param modulo Nombre del módulo/reporte, ej: 'Mantenimiento de Flota'
 */
export function addPdfFooter(doc: jsPDF, modulo: string = 'Sistema de Gestión Empresarial'): void {
  const totalPages = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

    // Texto del pie
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');

    const leyenda = `Documento generado por el Sistema de Gestión Empresarial (SGE) — Módulo de ${modulo}. Este documento es de uso interno y confidencial.`;
    const textWidth = pageWidth - 28;
    const splitText = doc.splitTextToSize(leyenda, textWidth);
    doc.text(splitText, pageWidth / 2, pageHeight - 12, { align: 'center' });

    // Número de página
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' });

    // Fecha de generación
    const fechaGeneracion = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    doc.text(`Generado: ${fechaGeneracion}`, 14, pageHeight - 6);
  }
}
