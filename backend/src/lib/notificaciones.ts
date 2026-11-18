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

// Normaliza un numero a formato internacional (solo digitos). Si trae 10 digitos
// se antepone el codigo de pais (WHATSAPP_COUNTRY_CODE, por defecto 52 Mexico).
function normalizarNumero(raw: string): string {
  let n = (raw || '').replace(/\D/g, '');
  const cc = process.env.WHATSAPP_COUNTRY_CODE || '52';
  if (n.length === 10) n = cc + n;
  return n;
}

// Envia un mensaje de texto por la WhatsApp Cloud API (Meta). Requiere
// WHATSAPP_TOKEN y WHATSAPP_PHONE_ID. Lanza error si la API responde != 2xx.
async function enviarWhatsApp(destino: string, mensaje: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token || !phoneId) throw new Error('WhatsApp no configurado');
  const resp = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizarNumero(destino), type: 'text', text: { body: mensaje, preview_url: false } }),
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`WhatsApp ${resp.status}: ${detalle.slice(0, 300)}`);
  }
}

// Envia una plantilla HSM aprobada por la WhatsApp Cloud API. Permite enviar
// fuera de la ventana de 24h. 'params' son los valores de {{1}},{{2}},... del body.
async function enviarWhatsAppTemplate(destino: string, nombre: string, lang: string, params: string[]): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token || !phoneId) throw new Error('WhatsApp no configurado');
  const body = {
    messaging_product: 'whatsapp',
    to: normalizarNumero(destino),
    type: 'template',
    template: {
      name: nombre,
      language: { code: lang },
      components: params.length ? [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: String(t) })) }] : [],
    },
  };
  const resp = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`WhatsApp template ${resp.status}: ${detalle.slice(0, 300)}`);
  }
}

// Orden de los parametros ({{1}},{{2}},...) de la plantilla HSM por evento.
// El usuario debe crear en Meta plantillas aprobadas con estos parametros en este orden.
const PARAMS_HSM: Record<string, (v: Record<string, string>) => string[]> = {
  recepcion: (v) => [v.cliente, v.equipo, v.folio],
  autorizacion: (v) => [v.cliente, v.equipo, v.folio, v.total],
  listo: (v) => [v.cliente, v.equipo, v.folio],
  ticket: (v) => [v.cliente, v.folio, v.total],
  factura: (v) => [v.cliente, v.folio, v.total],
};

// Config de plantillas HSM: { evento: { name, lang } } en Configuracion('whatsapp.templates').
async function configHsm(): Promise<Record<string, { name?: string; lang?: string }>> {
  try {
    const c = await prisma.configuracion.findUnique({ where: { clave: 'whatsapp.templates' } });
    return (c?.valor as any) ?? {};
  } catch { return {}; }
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

    const vars = {
      cliente: cliente?.nombre ?? 'cliente',
      folio: orden?.folio ?? ev.venta?.folio ?? '',
      equipo, total,
      estatus: orden?.estatus ?? '',
    };
    const mensaje = render(texto, vars);

    const destino = await destinoCliente(clienteId, canal);
    const waListo = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;

    // Envio real: WhatsApp (plantilla HSM si esta configurada, si no texto); correo pendiente (SMTP).
    let estatus: 'SIMULADA' | 'ENVIADA' | 'SIN_DESTINO' | 'ERROR' = 'SIMULADA';
    if (!destino) {
      estatus = 'SIN_DESTINO';
    } else if (canal === 'WHATSAPP' && waListo) {
      try {
        const tpl = (await configHsm())[ev.evento];
        if (tpl?.name) {
          const params = (PARAMS_HSM[ev.evento] ?? (() => []))(vars);
          await enviarWhatsAppTemplate(destino, tpl.name, tpl.lang || process.env.WHATSAPP_LANG || 'es_MX', params);
        } else {
          await enviarWhatsApp(destino, mensaje); // respaldo: texto libre (solo dentro de 24h)
        }
        estatus = 'ENVIADA';
      } catch (err) { estatus = 'ERROR'; console.error('[notificaciones] WhatsApp falló:', (err as Error).message); }
    }
    // (si canal === 'EMAIL' y SMTP_URL, aqui iria el envio por correo)

    await prisma.notificacion.create({
      data: { evento: ev.evento, canal, destino: destino ?? undefined, mensaje, estatus, clienteId: clienteId ?? undefined, ordenId: orden?.id, ventaId: ev.venta?.id },
    });
  } catch {
    // Nunca debe romper la operacion principal.
  }
}
