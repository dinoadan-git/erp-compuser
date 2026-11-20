import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { generarOrdenPdf, generarComprobanteRecepcion, imprimirComprobantesRecepcion } from '../lib/ordenPdf';

const ESTATUS_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido', EN_DIAGNOSTICO: 'En diagnostico', ESPERANDO_AUTORIZACION: 'Esperando autorizacion',
  EN_TRAMITE_GARANTIA_EPSON: 'Tramite garantia EPSON', ESPERANDO_REFACCION: 'Esperando refaccion',
  EN_REPARACION: 'En reparacion', EN_PRUEBAS_CALIDAD: 'En pruebas de calidad',
  LISTO_ENTREGA_REPARADO: 'Listo (reparado)', LISTO_ENTREGA_SIN_REPARAR: 'Listo (sin reparar)',
  ENTREGADO: 'Entregado', ABANDONO: 'Abandono', CANCELADO: 'Cancelado',
};
const ESTATUS = Object.keys(ESTATUS_LABEL);
const TIPOS_EQUIPO = ['Impresora', 'Multifuncional', 'Laptop', 'Computadora de Escritorio', 'Proyector', 'Otro'];

const ITEM_VACIO = () => ({ equipoId: '', nuevo: false, eqTipo: 'Impresora', eqMarca: '', eqModelo: '', eqSerie: '', falla: '', estadoFisico: '', tipoGarantia: 'NINGUNA' });

export default function Ordenes() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [equiposCliente, setEquiposCliente] = useState<any[]>([]);
  const [empresa, setEmpresa] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [detalle, setDetalle] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cliente (una vez) + recibe/tecnico (para todo el lote)
  const [cli, setCli] = useState<any>({ clienteId: '', nuevoCliente: false, clienteNombre: '', clienteTel: '', clienteTipo: 'MOSTRADOR' });
  const [recibidoPorId, setRecibidoPorId] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  // Varios equipos -> una orden por cada uno
  const [items, setItems] = useState<any[]>([ITEM_VACIO()]);

  const cargar = () => api.get('/ordenes').then((r) => setOrdenes(r.data)).catch(() => {});
  const cargarTecnicos = () => api.get('/ordenes/tecnicos').then((r) => setTecnicos(r.data)).catch(() => {});
  useEffect(() => {
    cargar(); cargarTecnicos();
    api.get('/clientes').then((r) => setClientes(r.data)).catch(() => {});
    api.get('/config/empresa').then((r) => setEmpresa(r.data)).catch(() => {});
  }, []);

  // Al elegir cliente existente, cargar SUS equipos (relación cliente→equipos).
  useEffect(() => {
    if (cli.clienteId && !cli.nuevoCliente) {
      api.get(`/clientes/${cli.clienteId}`).then((r) => {
        const eqs = r.data.equipos || [];
        setEquiposCliente(eqs);
        // Si el cliente no tiene equipos, el primer item arranca como nuevo.
        setItems((its) => its.map((it) => ({ ...it, nuevo: eqs.length === 0 ? true : it.nuevo })));
      }).catch(() => setEquiposCliente([]));
    } else { setEquiposCliente([]); setItems((its) => its.map((it) => ({ ...it, nuevo: cli.nuevoCliente ? true : it.nuevo }))); }
    // eslint-disable-next-line
  }, [cli.clienteId, cli.nuevoCliente]);

  const abrir = (id: number) => api.get(`/ordenes/${id}`).then((r) => { setDetalle(r.data); setMsg(''); }).catch(() => {});
  const setItem = (i: number, patch: any) => setItems((its) => its.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  function resetForm() { setCli({ clienteId: '', nuevoCliente: false, clienteNombre: '', clienteTel: '', clienteTipo: 'MOSTRADOR' }); setRecibidoPorId(''); setTecnicoId(''); setItems([ITEM_VACIO()]); }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    try {
      let clienteId = Number(cli.clienteId);
      if (cli.nuevoCliente) {
        if (!cli.clienteNombre.trim()) { setMsg('Escribe el nombre del cliente'); setGuardando(false); return; }
        const { data } = await api.post('/clientes', { nombre: cli.clienteNombre, tipo: cli.clienteTipo, telefono: cli.clienteTel || undefined });
        clienteId = data.id;
      }
      if (!clienteId) { setMsg('Selecciona o crea un cliente'); setGuardando(false); return; }

      const creadas: any[] = [];
      for (const it of items) {
        if (!it.falla.trim()) { setMsg('Cada equipo necesita su falla reportada'); setGuardando(false); return; }
        let equipoId = Number(it.equipoId);
        if (it.nuevo || !equipoId) {
          const { data } = await api.post('/equipos', { clienteId, tipo: it.eqTipo, marca: it.eqMarca || undefined, modelo: it.eqModelo || undefined, numeroSerie: it.eqSerie || undefined });
          equipoId = data.id;
        }
        const { data: orden } = await api.post('/ordenes', {
          clienteId, equipoId, fallaReportada: it.falla, estadoFisico: it.estadoFisico || undefined, tipoGarantia: it.tipoGarantia,
          tecnicoId: tecnicoId ? Number(tecnicoId) : undefined, recibidoPorId: recibidoPorId ? Number(recibidoPorId) : undefined,
        });
        creadas.push(orden);
      }
      setMsg(`${creadas.length} orden(es) creada(s): ${creadas.map((o) => o.folio).join(', ')}`);
      // Traer el detalle completo (cliente, equipo, recibe, tecnico) e imprimir.
      try {
        const full = await Promise.all(creadas.map((o) => api.get(`/ordenes/${o.id}`).then((r) => r.data)));
        await imprimirComprobantesRecepcion(full, empresa);
      } catch { /* si falla la impresion, la orden ya quedo creada */ }
      setShowForm(false); resetForm(); cargar(); cargarTecnicos();
      api.get('/clientes').then((r) => setClientes(r.data));
    } catch (e: any) {
      setMsg(e?.response?.data?.error ?? 'Error al crear la orden');
    } finally { setGuardando(false); }
  }

  // ---- Vista de detalle ----
  if (detalle) return <Detalle orden={detalle} tecnicos={tecnicos} user={user} onBack={() => { setDetalle(null); cargar(); }} onReload={() => abrir(detalle.id)} />;

  const tecOpt = (t: any) => `${t.nombre}${t.ticketsActivos != null ? ` · ${t.ticketsActivos} tickets` : ''}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Ordenes de trabajo</h1>
        <button onClick={() => { setShowForm(!showForm); setMsg(''); }} className="bg-primary-600 text-white rounded px-4 py-2 text-sm font-medium">{showForm ? 'Cancelar' : '+ Nueva orden'}</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl shadow p-5 mb-6 text-sm">
          <h2 className="font-semibold mb-3">Recepción de equipos</h2>

          {/* CLIENTE (una sola vez) */}
          <div className="grid md:grid-cols-3 gap-4 pb-4 border-b">
            <div className="md:col-span-2">
              <div className="font-medium mb-1">Cliente</div>
              {!cli.nuevoCliente ? (<>
                <select value={cli.clienteId} onChange={(e) => setCli({ ...cli, clienteId: e.target.value })} className="w-full border rounded px-2 py-1">
                  <option value="">Selecciona un cliente...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ` · ${c.telefono}` : ''}</option>)}
                </select>
                <button onClick={() => setCli({ ...cli, nuevoCliente: true, clienteId: '' })} className="text-primary-600 text-xs mt-1">+ Cliente nuevo</button>
              </>) : (<div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1" placeholder="Nombre del cliente" value={cli.clienteNombre} onChange={(e) => setCli({ ...cli, clienteNombre: e.target.value })} />
                <input className="border rounded px-2 py-1" placeholder="Teléfono" value={cli.clienteTel} onChange={(e) => setCli({ ...cli, clienteTel: e.target.value })} />
                <select value={cli.clienteTipo} onChange={(e) => setCli({ ...cli, clienteTipo: e.target.value })} className="border rounded px-2 py-1 col-span-2"><option value="MOSTRADOR">Mostrador</option><option value="EMPRESA">Empresa</option><option value="GARANTIA_EPSON">Garantía EPSON</option></select>
                <button onClick={() => setCli({ ...cli, nuevoCliente: false })} className="text-slate-500 text-xs col-span-2 text-left">usar cliente existente</button>
              </div>)}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <div className="font-medium mb-1">Recibe</div>
                <select value={recibidoPorId} onChange={(e) => setRecibidoPorId(e.target.value)} className="w-full border rounded px-2 py-1">
                  <option value="">Selecciona técnico…</option>
                  {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <div className="font-medium mb-1">Técnico asignado</div>
                <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className="w-full border rounded px-2 py-1">
                  <option value="">Sin asignar</option>
                  {tecnicos.map((t) => <option key={t.id} value={t.id}>{tecOpt(t)}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* EQUIPOS (uno o varios -> una orden por cada uno) */}
          <div className="mt-4 space-y-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg border p-3 bg-slate-50/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500">Equipo {i + 1} — generará la orden {items.length > 1 ? `(${i + 1} de ${items.length})` : ''}</span>
                  {items.length > 1 && <button onClick={() => setItems((its) => its.filter((_, idx) => idx !== i))} className="text-red-500 text-xs">quitar</button>}
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Equipo</div>
                    {!it.nuevo && equiposCliente.length > 0 ? (<>
                      <select value={it.equipoId} onChange={(e) => setItem(i, { equipoId: e.target.value })} className="w-full border rounded px-2 py-1">
                        <option value="">Selecciona un equipo del cliente…</option>
                        {equiposCliente.map((eq) => <option key={eq.id} value={eq.id}>{eq.tipo} {eq.marca} {eq.modelo} ({eq.numeroSerie || 's/n'})</option>)}
                      </select>
                      <button onClick={() => setItem(i, { nuevo: true, equipoId: '' })} className="text-primary-600 text-xs mt-1">+ Equipo nuevo</button>
                    </>) : (<div className="grid grid-cols-2 gap-1">
                      <select value={it.eqTipo} onChange={(e) => setItem(i, { eqTipo: e.target.value })} className="border rounded px-2 py-1">{TIPOS_EQUIPO.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                      <input className="border rounded px-2 py-1" placeholder="Marca" value={it.eqMarca} onChange={(e) => setItem(i, { eqMarca: e.target.value })} />
                      <input className="border rounded px-2 py-1" placeholder="Modelo" value={it.eqModelo} onChange={(e) => setItem(i, { eqModelo: e.target.value })} />
                      <input className="border rounded px-2 py-1" placeholder="No. de serie" value={it.eqSerie} onChange={(e) => setItem(i, { eqSerie: e.target.value })} />
                      {equiposCliente.length > 0 && <button onClick={() => setItem(i, { nuevo: false })} className="text-slate-500 text-xs col-span-2 text-left">usar equipo existente del cliente</button>}
                    </div>)}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div><div className="text-xs text-slate-500 mb-1">Falla reportada</div><textarea rows={1} className="w-full border rounded px-2 py-1" value={it.falla} onChange={(e) => setItem(i, { falla: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="border rounded px-2 py-1" placeholder="Estado físico / accesorios" value={it.estadoFisico} onChange={(e) => setItem(i, { estadoFisico: e.target.value })} />
                      <select value={it.tipoGarantia} onChange={(e) => setItem(i, { tipoGarantia: e.target.value })} className="border rounded px-2 py-1"><option value="NINGUNA">Sin garantía</option><option value="EPSON">Garantía EPSON</option><option value="TALLER">Garantía taller</option></select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setItems((its) => [...its, ITEM_VACIO()])} className="text-primary-600 text-sm font-medium">+ Agregar equipo</button>
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={guardar} disabled={guardando} className="bg-green-600 disabled:bg-slate-300 text-white rounded px-5 py-2 text-sm font-medium">
              {guardando ? 'Creando…' : `Recibir y crear ${items.length > 1 ? `${items.length} órdenes` : 'orden'}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left"><tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Equipo</th><th className="px-4 py-2">Tecnico</th><th className="px-4 py-2">Estatus</th><th className="px-4 py-2"></th></tr></thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => abrir(o.id)}>
                <td className="px-4 py-2 font-mono">{o.folio}</td>
                <td className="px-4 py-2">{o.cliente?.nombre}</td>
                <td className="px-4 py-2">{o.equipo?.marca} {o.equipo?.modelo}</td>
                <td className="px-4 py-2">{o.tecnico?.nombre ?? 'Sin asignar'}</td>
                <td className="px-4 py-2"><span className="px-2 py-1 rounded bg-primary-50 text-primary-700 text-xs">{ESTATUS_LABEL[o.estatus] ?? o.estatus}</span></td>
                <td className="px-4 py-2 text-right"><span className="text-primary-600 text-xs">Abrir →</span></td>
              </tr>
            ))}
            {ordenes.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin ordenes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detalle({ orden, tecnicos, user, onBack, onReload }: { orden: any; tecnicos: any[]; user: any; onBack: () => void; onReload: () => void }) {
  const [msg, setMsg] = useState('');
  const [transiciones, setTransiciones] = useState<Record<string, string[]>>({});
  const permitidos = transiciones[orden.estatus] || [];
  const [estatus, setEstatus] = useState('');
  const [nota, setNota] = useState('');
  const [asignar, setAsignar] = useState('');
  const [empresa, setEmpresa] = useState<any>(null);
  const [q, setQ] = useState('');
  const [prods, setProds] = useState<any[]>([]);
  const [ed, setEd] = useState({
    diagnostico: orden.diagnostico ?? '', costoDiagnostico: Number(orden.costoDiagnostico) || 0,
    cotizacionTotal: Number(orden.cotizacionTotal) || 0, tipoGarantia: orden.tipoGarantia,
  });

  useEffect(() => { api.get('/config/empresa').then((r) => setEmpresa(r.data)).catch(() => {}); }, []);
  useEffect(() => { api.get('/ordenes/transiciones').then((r) => setTransiciones(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (permitidos.length) setEstatus((prev) => permitidos.includes(prev) ? prev : permitidos[0]); /* eslint-disable-next-line */ }, [transiciones]);
  useEffect(() => { if (q.trim()) api.get('/catalogo/productos', { params: { q } }).then((r) => setProds(r.data)); else setProds([]); }, [q]);

  async function agregarRefaccion(productoId: number) {
    const cant = prompt('Cantidad a consumir:'); if (!cant) return;
    try { await api.post(`/ordenes/${orden.id}/consumos`, { productoId, cantidad: Number(cant) }); setMsg('Refaccion consumida (inventario descontado)'); setQ(''); setProds([]); onReload(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }

  const navigate = useNavigate();
  const partsNet = (orden.consumos || []).reduce((s: number, c: any) => s + Number(c.cantidad) * Number(c.precioUnit), 0);
  const laborNet = Number(orden.cotizacionTotal) > 0 ? Number(orden.cotizacionTotal) : Number(orden.costoDiagnostico) || 0;
  const baseCobro = partsNet + laborNet;
  const totalCobro = Math.round(baseCobro * 1.16 * 100) / 100;
  function irACobrarPos() { navigate(`/ventas?orden=${orden.id}`); }
  async function cambiarAEntregado() {
    try { await api.post(`/ordenes/${orden.id}/estatus`, { estatus: 'ENTREGADO', nota: 'Equipo entregado y cobrado' }); setMsg('Orden entregada'); onReload(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }

  async function cambiarEstatus() {
    try { await api.post(`/ordenes/${orden.id}/estatus`, { estatus, nota: nota || undefined }); setMsg('Estatus actualizado'); setNota(''); onReload(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }
  async function tomar() { try { await api.post(`/ordenes/${orden.id}/tomar`); setMsg('Tomaste esta orden'); onReload(); } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); } }
  async function asignarTecnico() {
    if (!asignar) return;
    try { await api.post(`/ordenes/${orden.id}/tecnico`, { tecnicoId: Number(asignar) }); setMsg('Tecnico asignado'); onReload(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error (requiere rol recepcion/admin)'); }
  }
  async function guardarEdicion() {
    try { await api.patch(`/ordenes/${orden.id}`, ed); setMsg('Datos guardados'); onReload(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }

  const esTecnico = user?.roles?.includes('TECNICO');

  return (
    <div>
      <button onClick={onBack} className="text-primary-600 text-sm mb-3">← Volver a la lista</button>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}
      <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold">{orden.folio}</h1>
          <p className="text-slate-500 text-sm">{orden.cliente?.nombre} · {orden.equipo?.tipo} {orden.equipo?.marca} {orden.equipo?.modelo} ({orden.equipo?.numeroSerie || 's/n'})</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">{ESTATUS_LABEL[orden.estatus] ?? orden.estatus}</span>
          <button onClick={() => generarComprobanteRecepcion(orden, empresa)} className="bg-slate-600 text-white rounded px-3 py-1.5 text-sm">Comprobante recepcion</button>
          <button onClick={() => generarOrdenPdf(orden, empresa)} className="bg-slate-800 text-white rounded px-3 py-1.5 text-sm">Orden de servicio PDF</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Datos */}
        <div className="bg-white rounded-xl shadow p-4 text-sm space-y-2">
          <h2 className="font-semibold">Datos del equipo</h2>
          <div><b>Falla:</b> {orden.fallaReportada}</div>
          <div><b>Estado fisico:</b> {orden.estadoFisico || '—'}</div>
          <div><b>Garantia:</b> {orden.tipoGarantia}</div>
          <div><b>Tecnico:</b> {orden.tecnico?.nombre ?? 'Sin asignar'}</div>
          <div className="pt-2 flex flex-wrap gap-2">
            {esTecnico && <button onClick={tomar} className="bg-primary-600 text-white rounded px-3 py-1 text-xs">Tomar orden</button>}
            <select value={asignar} onChange={(e) => setAsignar(e.target.value)} className="border rounded px-2 py-1 text-xs">
              <option value="">Asignar tecnico...</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button onClick={asignarTecnico} className="bg-slate-700 text-white rounded px-3 py-1 text-xs">Asignar</button>
          </div>
        </div>

        {/* Cambiar estatus */}
        <div className="bg-white rounded-xl shadow p-4 text-sm space-y-2">
          <h2 className="font-semibold">Cambiar estatus</h2>
          <div className="text-xs text-slate-500">Actual: <b>{ESTATUS_LABEL[orden.estatus] ?? orden.estatus}</b></div>
          {permitidos.length === 0 ? (
            <p className="text-slate-400">Estatus final: esta orden ya no admite cambios.</p>
          ) : (<>
            <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className="w-full border rounded px-2 py-1">
              {permitidos.map((s) => <option key={s} value={s}>{ESTATUS_LABEL[s] ?? s}</option>)}
            </select>
            <input className="w-full border rounded px-2 py-1" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
            <button onClick={cambiarEstatus} className="bg-green-600 text-white rounded px-4 py-1">Actualizar estatus</button>
            <p className="text-xs text-slate-400">Solo se muestran los siguientes pasos validos del flujo; no se puede regresar a un estatus anterior.</p>
          </>)}
        </div>

        {/* Diagnostico y cotizacion */}
        <div className="bg-white rounded-xl shadow p-4 text-sm space-y-2 md:col-span-2">
          <h2 className="font-semibold">Diagnostico y cotizacion</h2>
          <textarea className="w-full border rounded px-2 py-1" rows={2} placeholder="Diagnostico del tecnico" value={ed.diagnostico} onChange={(e) => setEd({ ...ed, diagnostico: e.target.value })} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <label>Costo diagnostico<input type="number" className="w-full border rounded px-2 py-1" value={ed.costoDiagnostico} onChange={(e) => setEd({ ...ed, costoDiagnostico: Number(e.target.value) })} /></label>
            <label>Cotizacion total<input type="number" className="w-full border rounded px-2 py-1" value={ed.cotizacionTotal} onChange={(e) => setEd({ ...ed, cotizacionTotal: Number(e.target.value) })} /></label>
            <label>Garantia<select className="w-full border rounded px-2 py-1" value={ed.tipoGarantia} onChange={(e) => setEd({ ...ed, tipoGarantia: e.target.value })}><option value="NINGUNA">Ninguna</option><option value="EPSON">EPSON</option><option value="TALLER">Taller</option></select></label>
          </div>
          <button onClick={guardarEdicion} className="bg-primary-600 text-white rounded px-4 py-1">Guardar cambios</button>
        </div>

        {/* Cobro en POS */}
        <div className="bg-white rounded-xl shadow p-4 text-sm md:col-span-2">
          <h2 className="font-semibold mb-2">Cobro</h2>
          {orden.venta ? (
            <div className="p-3 bg-green-50 text-green-800 rounded">
              Orden cobrada — Ticket <b>{orden.venta.folio}</b> por <b>${Number(orden.venta.total).toFixed(2)}</b>
              {orden.estatus !== 'ENTREGADO' && (
                <button onClick={cambiarAEntregado} className="ml-3 bg-green-600 text-white rounded px-3 py-1 text-xs">Marcar entregado</button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="text-slate-500 text-xs">Importe estimado (refacciones + mano de obra, IVA incl.)</div>
                <div className="text-2xl font-bold text-primary-700">${totalCobro.toFixed(2)}</div>
                <div className="text-xs text-slate-400">Refacciones ${partsNet.toFixed(2)} + Mano de obra ${laborNet.toFixed(2)}</div>
              </div>
              <button onClick={irACobrarPos} disabled={baseCobro <= 0} className="bg-green-600 disabled:bg-slate-300 text-white rounded px-5 py-2 font-medium">Cobrar en POS →</button>
              {baseCobro <= 0 && <span className="text-xs text-amber-600">Captura la cotizacion antes de cobrar.</span>}
            </div>
          )}
        </div>

        {/* Refacciones / materiales */}
        <div className="bg-white rounded-xl shadow p-4 text-sm md:col-span-2">
          <h2 className="font-semibold mb-2">Refacciones y materiales usados</h2>
          {(orden.consumos || []).length > 0 ? (
            <table className="w-full mb-3">
              <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Producto</th><th className="py-1 text-right">Cant.</th><th className="py-1 text-right">P. unit</th><th className="py-1 text-right">Importe</th></tr></thead>
              <tbody>
                {orden.consumos.map((c: any) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-1">{c.producto?.nombre ?? `#${c.productoId}`}</td>
                    <td className="py-1 text-right">{Number(c.cantidad)}</td>
                    <td className="py-1 text-right">${Number(c.precioUnit).toFixed(2)}</td>
                    <td className="py-1 text-right">${(Number(c.cantidad) * Number(c.precioUnit)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-slate-400 mb-3">Sin refacciones consumidas.</p>}
          <div className="relative">
            <input className="w-full border rounded px-2 py-1" placeholder="Buscar refaccion por nombre o SKU para consumir..." value={q} onChange={(e) => setQ(e.target.value)} />
            {prods.length > 0 && (
              <ul className="border rounded mt-1 max-h-40 overflow-y-auto">
                {prods.map((p) => (
                  <li key={p.id} onClick={() => agregarRefaccion(p.id)} className="px-2 py-1 hover:bg-slate-100 cursor-pointer flex justify-between">
                    <span>{p.nombre} <span className="text-xs text-slate-400">({p.sku})</span></span>
                    <span className="text-xs text-slate-500">stock {Number(p.disponible)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Bitacora */}
        <div className="bg-white rounded-xl shadow p-4 text-sm md:col-span-2">
          <h2 className="font-semibold mb-2">Bitacora</h2>
          <ol className="border-l-2 border-primary-200 pl-4 space-y-3">
            {(orden.bitacora || []).map((b: any) => (
              <li key={b.id}>
                <div className="font-medium">{ESTATUS_LABEL[b.estatus] ?? b.estatus}{b.soloInterno && <span className="text-xs text-slate-400"> · interno</span>}</div>
                {b.nota && <div className="text-slate-500">{b.nota}</div>}
                <div className="text-xs text-slate-400">{new Date(b.creadoEn).toLocaleString()} {b.usuario?.nombre ? `· ${b.usuario.nombre}` : ''}</div>
              </li>
            ))}
            {(orden.bitacora || []).length === 0 && <li className="text-slate-400">Sin movimientos</li>}
          </ol>
        </div>

        {/* Notificaciones al cliente */}
        <div className="bg-white rounded-xl shadow p-4 text-sm md:col-span-2">
          <h2 className="font-semibold mb-2">Notificaciones al cliente</h2>
          {(orden.notificaciones || []).length === 0 ? (
            <p className="text-slate-400">Aun no se han generado notificaciones.</p>
          ) : (
            <ul className="space-y-2">
              {orden.notificaciones.map((n: any) => (
                <li key={n.id} className="border rounded p-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{n.evento.toUpperCase()} · {n.canal} {n.destino ? `→ ${n.destino}` : ''}</span>
                    <span className={n.estatus === 'ENVIADA' ? 'text-green-600' : n.estatus === 'SIN_DESTINO' ? 'text-amber-600' : 'text-slate-400'}>{n.estatus}</span>
                  </div>
                  <div className="mt-1">{n.mensaje}</div>
                  <button onClick={() => navigator.clipboard?.writeText(n.mensaje)} className="text-primary-600 text-xs mt-1">Copiar mensaje</button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-400 mt-2">Los mensajes se generan automaticamente (recepcion, autorizacion, listo, cobro). El envio automatico por WhatsApp/correo se activa al configurar el proveedor; mientras tanto, cópialos para enviarlos.</p>
        </div>
      </div>
    </div>
  );
}
