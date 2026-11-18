import { prisma } from './prisma.js';

// Plantillas por defecto (se pueden sobrescribir en Configuracion -> Plantillas).
const PLANTILLAS: Record<string, { canal: string; texto: string }> = {
  recepcion: { canal: 'WHATSAPP', texto: 'Hola {cliente}, recibimos tu equipo {equipo}. Tu folio es {folio}. Puedes seguir el estatus en nuestro portal. Gracias por confiar en nosotros.' },
  autorizacion: { canal: 'WHATSAPP', texto: 'Hola {cliente}, tu equipo {equipo} (folio {folio}) ya tiene diagnostico. El costo estimado es {total}. Por favor autoriza la reparacion para continuar.' },
  listo: { canal: 'WHATSAPP', texto: 'Hola {cliente}, tu equipo {equipo} (folio {folio}) esta listo para entrega. Te esperamos en el centro de servicio.' },
  ticket: { canal: 'WHATSAPP', texto: 'Hola {cliente}, gracias por tu visita. Adjuntamos el comprobante de tu orden {folio} por {total}. Que tengas buen dia.' },
  factura: { canal: 'EMAIL', texto: 'Hola {cliente}, adjuntamos la factura de tu orden {folio} por {total}.' },
};

const money = (n: any) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function render(txt: string, vars: Record<string, string>) {
  return txt.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Obtiene la plantilla (de BD si existe, si no la default).
async function plantilla(clave: string) {
  const db = await prisma.plantillaMensaje.findUnique({ where: { clave: `orden.${clave}` } }).catch(() => null);
  if (db && db.activo) return { canal: db.canal, texto: db.cuerpo };
  return PLANTILLAS[clave] ?? { canal: 'WHATSAPP', texto: 'Actualizacion de tu orden {folio}.' };
}

// Resuelve a donde enviar: primer contacto del cliente con whatsapp/telefono o email.
async function destinoCliente(clienteId: number | null | undefined, canal: string) {
  if (!clienteId) return null;
  const contacto = await prisma.contactoCliente.findFirst({ where: { clienteId }, orderBy: { principal: 'desc' } });
  if (!contacto) return null;
  if (canal === 'EMAIL') return contacto.email || null;
  return contacto.whatsapp || contacto.telefono || null;
}

export interface EventoNotif {
  evento: 'recepcion' | 'autorizacion' | 'listo' | 'ticket' | 'factura';
  orden?: any;   // con cliente y equipo
  venta?: any;   // con folio y total
  clienteId?: number;
}

// Genera (y registra) una notificacion. Si hay proveedor configurado, se enviaria
// aqui; por ahora se guarda como SIMULADA para que el personal la copie/envie.
export async function notificar(ev: EventoNotif) {
  try {
    const { canal, texto } = await plantilla(ev.evento);
    const orden = ev.orden;
    const cliente = orden?.cliente;
    const clienteId = ev.clienteId ?? orden?.clienteId ?? cliente?.id ?? null;
    const equipo = orden?.equipo ? `${orden.equipo.tipo ?? ''} ${orden.equipo.marca ?? ''} ${orden.equipo.modelo ?? ''}`.trim() : '';
    const total = ev.venta ? money(ev.venta.total) : money(orden?.cotizacionTotal || orden?.costoDiagnostico);

    const mensaje = render(texto, {
      cliente: cliente?.nombre ?? 'cliente',
      folio: orden?.folio ?? ev.venta?.folio ?? '',
      equipo, total,
      estatus: orden?.estatus ?? '',
    });

    const destino = await destinoCliente(clienteId, canal);
    const proveedorListo = canal === 'EMAIL' ? !!process.env.SMTP_URL : !!process.env.WHATSAPP_TOKEN;

    // Aqui iria el envio real cuando el proveedor este configurado.
    const estatus = !destino ? 'SIN_DESTINO' : (proveedorListo ? 'ENVIADA' : 'SIMULADA');

    await prisma.notificacion.create({
      data: { evento: ev.evento, canal, destino: destino ?? undefined, mensaje, estatus, clienteId: clienteId ?? undefined, ordenId: orden?.id, ventaId: ev.venta?.id },
    });
  } catch {
    // Nunca debe romper la operacion principal.
  }
}
