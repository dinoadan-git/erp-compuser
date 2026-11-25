import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const ESTATUS_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido', EN_DIAGNOSTICO: 'En diagnostico', ESPERANDO_AUTORIZACION: 'Esperando autorizacion',
  EN_TRAMITE_GARANTIA_EPSON: 'Tramite garantia EPSON', ESPERANDO_REFACCION: 'Esperando refaccion',
  EN_REPARACION: 'En reparacion', EN_PRUEBAS_CALIDAD: 'En pruebas de calidad',
  LISTO_ENTREGA_REPARADO: 'Listo (reparado)', LISTO_ENTREGA_SIN_REPARAR: 'Listo (sin reparar)',
  ENTREGADO: 'Entregado', ABANDONO: 'Abandono', CANCELADO: 'Cancelado',
};

const money = (n: any) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---- Logo oficial del sitio (mismo PNG que usa la web) para los PDF ----
type LogoInfo = { data: string; w: number; h: number } | null;
let LOGO_CACHE: LogoInfo = null;
let LOGO_PROMISE: Promise<LogoInfo> | null = null;
export async function ensureLogo(): Promise<LogoInfo> {
  if (LOGO_CACHE) return LOGO_CACHE;
  if (!LOGO_PROMISE) {
    LOGO_PROMISE = (async () => {
      try {
        const resp = await fetch('/logo-compuservicios.png');
        if (!resp.ok) return null;
        const blob = await resp.blob();
        const data = await new Promise<string>((res, rej) => {
          const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob);
        });
        const dim = await new Promise<{ w: number; h: number }>((res) => {
          const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => res({ w: 917, h: 204 }); img.src = data;
        });
        LOGO_CACHE = { data, w: dim.w, h: dim.h };
      } catch { LOGO_CACHE = null; }
      return LOGO_CACHE;
    })();
  }
  return LOGO_PROMISE;
}
if (typeof window !== 'undefined') ensureLogo();

// Dibuja el logo oficial con altura `h` (mm) en (x,y). Si aún no cargó, usa el
// arco tricolor + texto como respaldo. Devuelve el ancho dibujado.
function dibujarLogo(doc: jsPDF, x: number, y: number, h: number): number {
  if (LOGO_CACHE) {
    const w = h * (LOGO_CACHE.w / LOGO_CACHE.h);
    try { doc.addImage(LOGO_CACHE.data, 'PNG', x, y, w, h); return w; } catch { /* respaldo abajo */ }
  }
  dibujarMarca(doc, x + 4.5, y + h / 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(h * 1.15); doc.setTextColor(30, 30, 30);
  doc.text('Compuser', x + 10, y + h / 2 + 1); const wCom = doc.getTextWidth('Compuser');
  doc.setTextColor(150, 150, 150); doc.text('vicios', x + 10 + wCom, y + h / 2 + 1);
  return 46;
}

// Genera y descarga el PDF de la orden de servicio.
export async function generarOrdenPdf(orden: any, empresa?: any) {
  await ensureLogo();
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const M = 15;                 // margen
  const W = doc.internal.pageSize.getWidth();
  let y = M;

  const line = (y1: number) => { doc.setDrawColor(200); doc.line(M, y1, W - M, y1); };
  const label = (txt: string, x: number, yy: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(110); doc.text(txt.toUpperCase(), x, yy); };
  const value = (txt: string, x: number, yy: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30); doc.text(txt || '-', x, yy); };

  // Encabezado con logo oficial
  dibujarLogo(doc, M, y, 11);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(30, 30, 30);
  doc.text('CENTRO DE SERVICIO AUTORIZADO', W / 2, y + 2, { align: 'center' });
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(10); doc.setTextColor(14, 165, 233);
  doc.text('EPSON', W / 2 - 7, y + 7.5, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 40, 40); doc.text('Canon', W / 2 + 11, y + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30);
  doc.text('ORDEN DE SERVICIO', W - M, y, { align: 'right' });
  doc.setFontSize(13); doc.setTextColor(14, 165, 233);
  doc.text(`#${orden.folio || ''}`, W - M, y + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110);
  doc.text(`Fecha: ${new Date(orden.recibidaEn || Date.now()).toLocaleDateString('es-MX')}`, W - M, y + 11, { align: 'right' });
  doc.text(`Estatus: ${ESTATUS_LABEL[orden.estatus] || orden.estatus}`, W - M, y + 15, { align: 'right' });

  y = y + 15 + 6; line(y); y += 7;

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
  doc.text('Compuservicios - Centro de Servicio Autorizado EPSON / Canon', M, doc.internal.pageSize.getHeight() - 10);

  doc.save(`${orden.folio || 'orden'}.pdf`);
}

// Comprobante de recepcion (version corta) con codigo QR para consultar estatus.
// Marca Compuservicios para los documentos.
const MARCA = {
  nombre: 'Compuservicios',
  tagline: 'HACEMOS QUE LA TECNOLOGIA FUNCIONE PARA TI',
  tel: '951 167 2703',
  whatsapp: '951 646 3845',
};

// Dibuja el arco tricolor de la marca centrado en (cx,cy).
function dibujarMarca(doc: jsPDF, cx: number, cy: number) {
  const arco = (r: number, rgb: number[]) => {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(1.3); doc.setLineCap('round');
    let prev: number[] | null = null;
    for (let a = 180; a <= 360; a += 10) {
      const rad = (a * Math.PI) / 180; const p = [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
      if (prev) doc.line(prev[0], prev[1], p[0], p[1]); prev = p;
    }
  };
  arco(4.6, [34, 197, 94]); arco(3.2, [14, 165, 233]); arco(1.8, [239, 68, 68]);
  doc.setLineWidth(0.2);
}

// Dibuja una copia del comprobante de recepcion en la posicion yTop.
function dibujarComprobante(doc: jsPDF, yTop: number, copia: string, orden: any, empresa: any, qrData: string) {
  const M = 10, W = doc.internal.pageSize.getWidth(), R = W - M;
  const azul = [37, 99, 235], sky = [14, 165, 233], gris = 110, negro = 30;
  let y = yTop;
  const lbl = (t: string, x: number, yy: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...(azul as [number, number, number])); doc.text(t.toUpperCase(), x, yy); };
  const grisLbl = (t: string, x: number, yy: number, align: any = 'left') => { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(gris, gris, gris); doc.text(t.toUpperCase(), x, yy, { align }); };
  const val = (t: string, x: number, yy: number, sz = 9.5) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(sz); doc.setTextColor(negro, negro, negro); doc.text(t || '-', x, yy); };
  const hline = (yy: number) => { doc.setDrawColor(40); doc.setLineWidth(0.4); doc.line(M, yy, R, yy); doc.setLineWidth(0.2); };

  // Encabezado: logo oficial | centro autorizado | folio
  dibujarLogo(doc, M, y, 11);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(negro, negro, negro);
  doc.text('CENTRO DE SERVICIO AUTORIZADO', W / 2, y + 3, { align: 'center' });
  doc.setFontSize(11); doc.setFont('helvetica', 'bolditalic'); doc.setTextColor(sky[0], sky[1], sky[2]);
  doc.text('EPSON', W / 2 - 8, y + 9, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 40, 40); doc.text('Canon', W / 2 + 12, y + 9, { align: 'center' });

  grisLbl('Folio', R, y + 3, 'right');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(sky[0], sky[1], sky[2]);
  doc.text(`#${orden.folio || ''}`, R, y + 9, { align: 'right' });

  y += 13; hline(y); y += 5;

  // Fecha / copia
  grisLbl('Fecha de recepcion:', M, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(negro, negro, negro);
  doc.text(new Date(orden.recibidaEn || Date.now()).toLocaleDateString('es-MX'), M + 30, y);
  grisLbl(`Copia: ${copia}`, R, y, 'right');
  y += 6;
  // Cliente / telefono
  grisLbl('Cliente:', M, y); val((orden.cliente?.nombre || '').toUpperCase(), M + 14, y, 10);
  grisLbl('Telefono:', R, y - 3.5, 'right');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(negro, negro, negro);
  doc.text(orden.telefonoContacto || empresa?._telCliente || orden.cliente?.telefono || '', R, y, { align: 'right' });
  y += 3; hline(y); y += 4.5;

  // Fila de 4 columnas
  const colX = [M, M + 50, M + 100, M + 150];
  const servicio = orden.tipoGarantia === 'EPSON' ? 'GARANTIA EPSON' : orden.tipoGarantia === 'TALLER' ? 'GARANTIA TALLER' : 'CORRECTIVO';
  const cols = [
    ['Equipo:', (orden.equipo?.tipo || '').toUpperCase()],
    ['Marca / Modelo:', `${orden.equipo?.marca || ''} ${orden.equipo?.modelo || ''}`.trim().toUpperCase()],
    ['Servicio realizado:', servicio],
    ['N/S (Serie):', (orden.equipo?.numeroSerie || '').toUpperCase()],
  ];
  cols.forEach((c, i) => { lbl(c[0], colX[i], y); val(c[1], colX[i], y + 4.5, 9); if (i > 0) { doc.setDrawColor(210); doc.line(colX[i] - 3, y - 3, colX[i] - 3, y + 6); } });
  y += 9; hline(y); y += 4.5;

  // Dos cajas: falla / accesorios
  const boxW = (R - M - 5) / 2, boxH = 16;
  lbl('Falla reportada por el cliente:', M, y);
  lbl('Accesorios y condiciones fisicas:', M + boxW + 5, y);
  y += 2; doc.setDrawColor(190);
  doc.rect(M, y, boxW, boxH); doc.rect(M + boxW + 5, y, boxW, boxH);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(negro, negro, negro);
  doc.text(doc.splitTextToSize(orden.fallaReportada || '', boxW - 4), M + 2, y + 4);
  doc.text(doc.splitTextToSize(orden.estadoFisico || '', boxW - 4), M + boxW + 7, y + 4);
  y += boxH + 4;

  // Observaciones tecnicas (izq) | recibe + costo (der)
  lbl('Observaciones tecnicas:', M, y);
  const obsY = y + 2;
  doc.setDrawColor(190); doc.rect(M, obsY, boxW, 16);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(gris, gris, gris);
  doc.text(doc.splitTextToSize(orden.diagnostico || 'Equipo recibido para diagnostico. Pendiente de revision tecnica.', boxW - 4), M + 2, obsY + 4);

  const dx = M + boxW + 5;
  grisLbl('Recibe:', dx, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(sky[0], sky[1], sky[2]);
  doc.text(((orden.recibidoPor?.nombre || orden.tecnico?.nombre) || '').toUpperCase(), R, y, { align: 'right' });
  // costo revision + anticipo/apartado + sello
  const cy = obsY + 4;
  doc.setFillColor(235, 242, 252); doc.rect(dx, cy, boxW, 13, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(negro, negro, negro);
  doc.text(`COSTO REVISION: ${money(orden.costoDiagnostico)}`, dx + 2, cy + 5);
  // Anticipo / apartado dejado en recepcion
  const ant = Number(orden.anticipo) || 0;
  const antForma = orden.anticipoReg?.forma ? ` (${FORMA_LABEL[orden.anticipoReg.forma] || orden.anticipoReg.forma})` : '';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  if (ant > 0) { doc.setTextColor(16, 122, 64); doc.text(`APARTADO: ${money(ant)}${antForma}`, dx + 2, cy + 10.5); }
  else { doc.setTextColor(150, 150, 150); doc.text('SIN ANTICIPO / APARTADO', dx + 2, cy + 10.5); }
  y = cy + 17;

  // QR pequeno (solo copia cliente)
  if (qrData && copia === 'CLIENTE') {
    doc.addImage(qrData, 'PNG', R - 20, y, 18, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(gris, gris, gris);
    doc.text('Escanea tu estatus', R - 11, y + 20.5, { align: 'center' });
  }

  // Footer contacto
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(negro, negro, negro);
  const telTxt = `Tel: ${empresa?.telefono || MARCA.tel}`;
  const waTxt = `WhatsApp: ${MARCA.whatsapp}`;
  doc.setTextColor(220, 40, 40); doc.text(telTxt, W / 2 - 25, y + 6, { align: 'center' });
  doc.setTextColor(sky[0], sky[1], sky[2]); doc.text(waTxt, W / 2 + 25, y + 6, { align: 'center' });
}

// Comprobante de recepcion: dos copias (cliente/empresa) con corte al centro.
export async function generarComprobanteRecepcion(orden: any, empresa?: any, baseUrl?: string) {
  await ensureLogo();
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = `${origin}/portal?token=${orden.qrToken || ''}`;
  let qrData = '';
  try { qrData = await QRCode.toDataURL(url, { margin: 1, width: 240 }); } catch { /* sin QR */ }

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  dibujarComprobante(doc, 10, 'CLIENTE', orden, empresa, qrData);

  // Linea de corte
  const yCorte = 143;
  doc.setLineDashPattern([2, 1.5], 0); doc.setDrawColor(150); doc.line(10, yCorte, W - 10, yCorte);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
  doc.text('--- CORTE AQUI ---', W / 2, yCorte - 1, { align: 'center' });

  dibujarComprobante(doc, 150, 'EMPRESA', orden, empresa, qrData);
  doc.save(`${orden.folio || 'orden'}-recepcion.pdf`);
}

const TIPO_VENTA_LABEL: Record<string, string> = {
  TICKET: 'TICKET DE VENTA', FACTURA: 'FACTURA', COTIZACION: 'COTIZACION',
  APARTADO: 'APARTADO', NOTA_CREDITO: 'NOTA DE CREDITO',
};
const FORMA_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', CREDITO: 'Credito', MIXTO: 'Mixto',
};

// Reimprime el ticket de una venta en formato 80mm (tipo termico).
export async function generarTicketVenta(venta: any, empresa?: any) {
  await ensureLogo();
  const w = 80, mx = 5, cw = w - mx * 2;
  const det = venta.detalles || [];
  const emp = empresa || {};
  const empLines = 1 + (emp.direccion ? 2 : 0) + ((emp.telefono || emp.telefono2) ? 1 : 0) + (emp.whatsapp ? 1 : 0) + (emp.email ? 1 : 0) + ((emp.facebook || emp.instagram || emp.sitioWeb) ? 2 : 0) + (emp.rfc ? 1 : 0);
  const cliLines = (venta.cliente?.nombre ? 1 : 0) + (venta.cliente?.telefono ? 1 : 0) + (venta.cliente?.rfc ? 1 : 0);
  const alto = 46 + empLines * 3 + (4 + cliLines) * 3.5 + det.length * 8 + (venta.pagos?.length || 1) * 4 + (Number(venta.anticipoAplicado) > 0 ? 8 : 0) + (Number(venta._recibido) > 0 ? 8 : 0) + 18;
  const doc = new jsPDF({ unit: 'mm', format: [w, alto] });
  let y = 6;
  const center = (t: string, yy: number) => doc.text(t, w / 2, yy, { align: 'center' });
  const rowLR = (l: string, r: string, yy: number) => { doc.text(l, mx, yy); doc.text(r, w - mx, yy, { align: 'right' }); };
  const sep = (yy: number) => { doc.setDrawColor(150); doc.setLineDashPattern([0.6, 0.6], 0); doc.line(mx, yy, w - mx, yy); doc.setLineDashPattern([], 0); };

  // Logo oficial centrado
  const lw = LOGO_CACHE ? 9 * (LOGO_CACHE.w / LOGO_CACHE.h) : 42;
  dibujarLogo(doc, (w - lw) / 2, y, 9); y += 11;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(90);
  center('Centro de Servicio Autorizado EPSON / Canon', y); y += 3;
  if (emp.direccion) { for (const ln of doc.splitTextToSize(String(emp.direccion), cw)) { center(ln, y); y += 2.8; } }
  const tels = [emp.telefono, emp.telefono2].filter(Boolean).join(' / ');
  if (tels) { center(`Tel: ${tels}`, y); y += 2.8; }
  if (emp.whatsapp) { center(`WhatsApp: ${emp.whatsapp}`, y); y += 2.8; }
  if (emp.email) { center(String(emp.email), y); y += 2.8; }
  const redes = [emp.facebook && `FB: ${emp.facebook}`, emp.instagram && `IG: ${emp.instagram}`, emp.sitioWeb].filter(Boolean).join('   ');
  if (redes) { for (const ln of doc.splitTextToSize(redes, cw)) { center(ln, y); y += 2.8; } }
  if (emp.rfc) { center(`RFC: ${emp.rfc}`, y); y += 2.8; }

  y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
  center(TIPO_VENTA_LABEL[venta.tipo] || 'TICKET', y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(50);
  center(`Folio: ${venta.folio}`, y); y += 3.5;
  center(new Date(venta.creadoEn || Date.now()).toLocaleString('es-MX'), y); y += 3.5;
  if (venta.cajero?.nombre) { center(`Atendio: ${venta.cajero.nombre}`, y); y += 3.5; }
  // Datos del cliente (p.ej. al cobrar una orden de trabajo)
  if (venta.cliente?.nombre) { center(`Cliente: ${venta.cliente.nombre}`, y); y += 3.5; }
  if (venta.cliente?.telefono) { center(`Tel. cliente: ${venta.cliente.telefono}`, y); y += 3.5; }
  if (venta.cliente?.rfc) { center(`RFC cliente: ${venta.cliente.rfc}`, y); y += 3.5; }

  y += 1; sep(y); y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(90);
  rowLR('DESCRIPCION', 'IMPORTE', y); y += 3; sep(y); y += 3.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(30, 30, 30);
  for (const d of det) {
    const desc = doc.splitTextToSize(String(d.descripcion || d.producto?.nombre || ''), cw - 22);
    doc.text(desc, mx, y);
    doc.text(money(d.importe), w - mx, y, { align: 'right' });
    y += desc.length * 3.2;
    doc.setTextColor(120); doc.setFontSize(6.5);
    doc.text(`${Number(d.cantidad)} x ${money(d.precioUnit)}`, mx, y);
    doc.setTextColor(30, 30, 30); doc.setFontSize(7.5);
    y += 4;
  }
  sep(y); y += 4;
  doc.setFontSize(8);
  rowLR('Subtotal', money(venta.subtotal), y); y += 4;
  rowLR('IVA', money(venta.impuestos), y); y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  rowLR('TOTAL', money(venta.total), y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  const anticipoPrev = Number(venta.anticipoAplicado) || 0;
  if (anticipoPrev > 0) {
    rowLR('Anticipo recibido', `- ${money(anticipoPrev)}`, y); y += 4;
    doc.setFont('helvetica', 'bold');
    rowLR('SALDO A PAGAR', money(Number(venta.total) - anticipoPrev), y); y += 4;
    doc.setFont('helvetica', 'normal');
  }
  for (const p of (venta.pagos || [])) { rowLR(FORMA_LABEL[p.forma] || p.forma, money(p.monto), y); y += 4; }
  // Efectivo recibido y cambio (si se capturó en el cobro)
  const recibido = Number(venta._recibido) || 0;
  if (recibido > 0) {
    rowLR('Recibido', money(recibido), y); y += 4;
    doc.setFont('helvetica', 'bold');
    rowLR('Cambio', money(Math.max(0, recibido - Number(venta.total) + anticipoPrev)), y); y += 4;
    doc.setFont('helvetica', 'normal');
  }

  y += 2; sep(y); y += 4;
  doc.setFontSize(7); doc.setTextColor(90);
  center('Gracias por su preferencia', y); y += 3;
  const waPie = emp.whatsapp || MARCA.whatsapp;
  if (waPie) center(`WhatsApp: ${waPie}`, y);

  doc.save(`${venta.folio || 'ticket'}.pdf`);
}

// Dibuja una pagina (dos copias) del comprobante de una orden en el doc dado.
async function paginaComprobante(doc: jsPDF, orden: any, empresa: any, baseUrl: string) {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = `${origin}/portal?token=${orden.qrToken || ''}`;
  let qrData = '';
  try { qrData = await QRCode.toDataURL(url, { margin: 1, width: 240 }); } catch { /* sin QR */ }
  const W = doc.internal.pageSize.getWidth();
  dibujarComprobante(doc, 10, 'CLIENTE', orden, empresa, qrData);
  const yCorte = 143;
  doc.setLineDashPattern([2, 1.5], 0); doc.setDrawColor(150); doc.line(10, yCorte, W - 10, yCorte);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
  doc.text('--- CORTE AQUI ---', W / 2, yCorte - 1, { align: 'center' });
  dibujarComprobante(doc, 150, 'EMPRESA', orden, empresa, qrData);
}

// Genera un solo PDF con el comprobante de una o varias ordenes (una por pagina)
// y lo manda a impresion directa (abre el dialogo de la impresora predeterminada).
export async function imprimirComprobantesRecepcion(ordenes: any[], empresa?: any, baseUrl?: string) {
  await ensureLogo();
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  for (let i = 0; i < ordenes.length; i++) {
    if (i > 0) doc.addPage();
    await paginaComprobante(doc, ordenes[i], empresa, baseUrl || '');
  }
  try {
    doc.autoPrint();
    const url = doc.output('bloburl');
    const w = window.open(url, '_blank');
    if (!w) doc.save(`comprobantes-${Date.now()}.pdf`); // si el navegador bloquea el popup, descarga
  } catch {
    doc.save(`comprobantes-${Date.now()}.pdf`);
  }
}

// Reporte en PDF del resultado de búsqueda del listado de órdenes.
export async function generarReporteOrdenes(ordenes: any[], filtros: any, tecnicos: any[], empresa?: any) {
  await ensureLogo();
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const sky: [number, number, number] = [37, 99, 235];

  // Encabezado con logo oficial
  dibujarLogo(doc, M, 8, 10);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(sky[0], sky[1], sky[2]);
  doc.text('Reporte de órdenes de servicio', W - M, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
  doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, W - M, 19, { align: 'right' });

  // Filtros aplicados
  const tecNombre = filtros.tecnicoId ? (tecnicos.find((t) => String(t.id) === String(filtros.tecnicoId))?.nombre || filtros.tecnicoId) : '';
  const partes: string[] = [];
  if (filtros.estatus) partes.push(`Estatus: ${ESTATUS_LABEL[filtros.estatus] || filtros.estatus}`);
  if (tecNombre) partes.push(`Técnico: ${tecNombre}`);
  if (filtros.tipoGarantia) partes.push(`Garantía: ${filtros.tipoGarantia}`);
  if (filtros.desde) partes.push(`Desde: ${filtros.desde}`);
  if (filtros.hasta) partes.push(`Hasta: ${filtros.hasta}`);
  if (filtros.q) partes.push(`Búsqueda: "${filtros.q}"`);
  doc.setFontSize(8); doc.setTextColor(90);
  doc.text(partes.length ? `Filtros — ${partes.join(' · ')}` : 'Sin filtros (todas las órdenes)', M, 24);
  doc.text(`${ordenes.length} orden(es)`, W - M, 24, { align: 'right' });

  // Tabla
  const cols = [
    { h: 'Folio', w: 20 }, { h: 'Recepción', w: 20 }, { h: 'Cliente', w: 44 },
    { h: 'Equipo / Modelo', w: 38 }, { h: 'N/S', w: 27 }, { h: 'Técnico', w: 34 },
    { h: 'Estado', w: 34 }, { h: 'Garantía', w: 20 }, { h: 'Anticipo', w: 20 },
  ];
  let x0 = M; const xs = cols.map((c) => { const x = x0; x0 += c.w; return x; });
  let y = 30;
  const header = () => {
    doc.setFillColor(sky[0], sky[1], sky[2]); doc.rect(M, y, W - M * 2, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
    cols.forEach((c, i) => doc.text(c.h, xs[i] + 1.5, y + 4.7));
    y += 7;
  };
  header();
  doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
  ordenes.forEach((o, idx) => {
    if (y > H - 14) { doc.addPage(); y = 14; header(); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40); }
    if (idx % 2 === 1) { doc.setFillColor(243, 246, 251); doc.rect(M, y, W - M * 2, 6, 'F'); }
    doc.setFontSize(7.3);
    const fecha = o.recibidaEn ? new Date(o.recibidaEn).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
    const row = [
      `#${o.folio}`, fecha, o.cliente?.nombre || '—',
      [o.equipo?.marca, o.equipo?.modelo].filter(Boolean).join(' ') || o.equipo?.tipo || '—',
      o.equipo?.numeroSerie || '—', o.tecnico?.nombre || 'Sin asignar',
      ESTATUS_LABEL[o.estatus] || o.estatus, o.tipoGarantia || 'NINGUNA',
      Number(o.anticipo) > 0 ? money(o.anticipo) : '—',
    ];
    row.forEach((v, i) => doc.text(doc.splitTextToSize(String(v), cols[i].w - 2)[0], xs[i] + 1.5, y + 4.2));
    y += 6;
  });

  // Pie con total de anticipos
  const totalAnticipos = ordenes.reduce((s, o) => s + (Number(o.anticipo) || 0), 0);
  y += 2; doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 30);
  doc.text(`Anticipos en el resultado: ${money(totalAnticipos)}`, W - M, y, { align: 'right' });

  doc.save(`reporte-ordenes-${new Date().toISOString().slice(0, 10)}.pdf`);
}
