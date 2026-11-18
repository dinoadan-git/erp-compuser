import { jsPDF } from 'jspdf';

const ESTATUS_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido', EN_DIAGNOSTICO: 'En diagnostico', ESPERANDO_AUTORIZACION: 'Esperando autorizacion',
  EN_TRAMITE_GARANTIA_EPSON: 'Tramite garantia EPSON', ESPERANDO_REFACCION: 'Esperando refaccion',
  EN_REPARACION: 'En reparacion', EN_PRUEBAS_CALIDAD: 'En pruebas de calidad',
  LISTO_ENTREGA_REPARADO: 'Listo (reparado)', LISTO_ENTREGA_SIN_REPARAR: 'Listo (sin reparar)',
  ENTREGADO: 'Entregado', ABANDONO: 'Abandono', CANCELADO: 'Cancelado',
};

const money = (n: any) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Genera y descarga el PDF de la orden de servicio.
export function generarOrdenPdf(orden: any, empresa?: any) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const M = 15;                 // margen
  const W = doc.internal.pageSize.getWidth();
  let y = M;

  const line = (y1: number) => { doc.setDrawColor(200); doc.line(M, y1, W - M, y1); };
  const label = (txt: string, x: number, yy: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(110); doc.text(txt.toUpperCase(), x, yy); };
  const value = (txt: string, x: number, yy: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30); doc.text(txt || '-', x, yy); };

  // Encabezado
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(2, 132, 199);
  doc.text(empresa?.nombre || 'Centro de Servicio Autorizado EPSON', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  if (empresa?.rfc) { y += 5; doc.text(`RFC: ${empresa.rfc}`, M, y); }
  if (empresa?.direccion) { y += 4; doc.text(String(empresa.direccion), M, y); }
  if (empresa?.telefono) { y += 4; doc.text(`Tel: ${empresa.telefono}`, M, y); }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30);
  doc.text('ORDEN DE SERVICIO', W - M, M, { align: 'right' });
  doc.setFontSize(11); doc.setTextColor(2, 132, 199);
  doc.text(String(orden.folio || ''), W - M, M + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
  doc.text(`Fecha: ${new Date(orden.recibidaEn || Date.now()).toLocaleString('es-MX')}`, W - M, M + 11, { align: 'right' });
  doc.text(`Estatus: ${ESTATUS_LABEL[orden.estatus] || orden.estatus}`, W - M, M + 15, { align: 'right' });

  y = Math.max(y, M + 15) + 7; line(y); y += 7;

  // Cliente y equipo (dos columnas)
  const col2 = W / 2 + 5;
  label('Cliente', M, y); label('Equipo', col2, y); y += 5;
  value(orden.cliente?.nombre || '', M, y);
  value(`${orden.equipo?.tipo || ''} ${orden.equipo?.marca || ''} ${orden.equipo?.modelo || ''}`.trim(), col2, y); y += 5;
  if (orden.cliente?.rfc) { value(`RFC: ${orden.cliente.rfc}`, M, y); }
  value(`No. serie: ${orden.equipo?.numeroSerie || 's/n'}`, col2, y); y += 5;
  value(`Garantia: ${orden.tipoGarantia || 'NINGUNA'}`, col2, y);
  value(`Tecnico: ${orden.tecnico?.nombre || 'Sin asignar'}`, M, y); y += 8;

  line(y); y += 7;

  // Falla y diagnostico
  const bloque = (titulo: string, texto: string) => {
    label(titulo, M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30);
    const lines = doc.splitTextToSize(texto || '-', W - 2 * M);
    doc.text(lines, M, y); y += lines.length * 5 + 3;
  };
  bloque('Falla reportada', orden.fallaReportada);
  if (orden.estadoFisico) bloque('Estado fisico / accesorios', orden.estadoFisico);
  if (orden.diagnostico) bloque('Diagnostico', orden.diagnostico);

  // Refacciones
  const consumos = orden.consumos || [];
  if (consumos.length) {
    y += 2; label('Refacciones y materiales', M, y); y += 5;
    doc.setFontSize(9); doc.setTextColor(110); doc.setFont('helvetica', 'bold');
    doc.text('Descripcion', M, y); doc.text('Cant.', W - M - 55, y, { align: 'right' });
    doc.text('P. unit', W - M - 28, y, { align: 'right' }); doc.text('Importe', W - M, y, { align: 'right' });
    y += 2; line(y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30); doc.setFontSize(9);
    for (const c of consumos) {
      const imp = Number(c.cantidad) * Number(c.precioUnit);
      doc.text(String(c.producto?.nombre || `#${c.productoId}`).slice(0, 60), M, y);
      doc.text(String(Number(c.cantidad)), W - M - 55, y, { align: 'right' });
      doc.text(money(c.precioUnit), W - M - 28, y, { align: 'right' });
      doc.text(money(imp), W - M, y, { align: 'right' });
      y += 5;
    }
    y += 2;
  }

  // Totales
  line(y); y += 6;
  const refTotal = consumos.reduce((s: number, c: any) => s + Number(c.cantidad) * Number(c.precioUnit), 0);
  const fila = (t: string, v: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11 : 10); doc.setTextColor(30);
    doc.text(t, W - M - 60, y); doc.text(v, W - M, y, { align: 'right' }); y += 6;
  };
  if (refTotal) fila('Refacciones', money(refTotal));
  if (Number(orden.costoDiagnostico)) fila('Diagnostico', money(orden.costoDiagnostico));
  fila('Total cotizado', money(orden.cotizacionTotal), true);

  // Firma
  y = Math.max(y + 16, doc.internal.pageSize.getHeight() - 40);
  doc.setDrawColor(120); doc.line(M + 15, y, W / 2 - 10, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
  doc.text('Firma de autorizacion / recibido del cliente', M + 15, y + 4);

  doc.setFontSize(7); doc.setTextColor(150);
  doc.text('Documento generado por el sistema CSA EPSON', M, doc.internal.pageSize.getHeight() - 10);

  doc.save(`${orden.folio || 'orden'}.pdf`);
}
