import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { generarOrdenPdf, generarComprobanteRecepcion } from '../lib/ordenPdf';

const ESTATUS_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido', EN_DIAGNOSTICO: 'En diagnostico', ESPERANDO_AUTORIZACION: 'Esperando autorizacion',
  EN_TRAMITE_GARANTIA_EPSON: 'Tramite garantia EPSON', ESPERANDO_REFACCION: 'Esperando refaccion',
  EN_REPARACION: 'En reparacion', EN_PRUEBAS_CALIDAD: 'En pruebas de calidad',
  LISTO_ENTREGA_REPARADO: 'Listo (reparado)', LISTO_ENTREGA_SIN_REPARAR: 'Listo (sin reparar)',
  ENTREGADO: 'Entregado', ABANDONO: 'Abandono', CANCELADO: 'Cancelado',
};
const ESTATUS = Object.keys(ESTATUS_LABEL);
const TIPOS_EQUIPO = ['Impresora', 'Multifuncional', 'Laptop', 'Computadora de Escritorio', 'Proyector', 'Otro'];

export default function Ordenes() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [detalle, setDetalle] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const vacio = {
    clienteId: '', nuevoCliente: false, clienteNombre: '', clienteTipo: 'MOSTRADOR',
    equipoId: '', nuevoEquipo: true, eqTipo: 'Impresora', eqMarca: '', eqModelo: '', eqSerie: '',
    falla: '', estadoFisico: '', tipoGarantia: 'NINGUNA', tecnicoId: '',
  };
  const [f, setF] = useState<any>(vacio);

  const cargar = () => api.get('/ordenes').then((r) => setOrdenes(r.data)).catch(() => {});
  useEffect(() => {
    cargar();
    api.get('/clientes').then((r) => setClientes(r.data)).catch(() => {});
    api.get('/ordenes/tecnicos').then((r) => setTecnicos(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (f.clienteId && !f.nuevoCliente) {
      api.get(`/clientes/${f.clienteId}`).then((r) => {
        setEquipos(r.data.equipos || []);
        setF((p: any) => ({ ...p, nuevoEquipo: (r.data.equipos || []).length === 0 }));
      }).catch(() => setEquipos([]));
    } else { setEquipos([]); }
    // eslint-disable-next-line
  }, [f.clienteId, f.nuevoCliente]);

  const abrir = (id: number) => api.get(`/ordenes/${id}`).then((r) => { setDetalle(r.data); setMsg(''); }).catch(() => {});

  async function guardar() {
    try {
      let clienteId = Number(f.clienteId);
      if (f.nuevoCliente) {
        if (!f.clienteNombre.trim()) { setMsg('Escribe el nombre del cliente'); return; }
        const { data } = await api.post('/clientes', { nombre: f.clienteNombre, tipo: f.clienteTipo });
        clienteId = data.id;
      }
      if (!clienteId) { setMsg('Selecciona o crea un cliente'); return; }
      let equipoId = Number(f.equipoId);
      if (f.nuevoEquipo || !equipoId) {
        const { data } = await api.post('/equipos', { clienteId, tipo: f.eqTipo, marca: f.eqMarca || undefined, modelo: f.eqModelo || undefined, numeroSerie: f.eqSerie || undefined });
        equipoId = data.id;
      }
      if (!f.falla.trim()) { setMsg('Describe la falla reportada'); return; }
      const { data: orden } = await api.post('/ordenes', { clienteId, equipoId, fallaReportada: f.falla, estadoFisico: f.estadoFisico || undefined, tipoGarantia: f.tipoGarantia, tecnicoId: f.tecnicoId ? Number(f.tecnicoId) : undefined });
      setMsg(`Orden ${orden.folio} creada`); setF(vacio); setShowForm(false); cargar();
      api.get('/clientes').then((r) => setClientes(r.data));
    } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error al crear la orden'); }
  }

  // ---- Vista de detalle ----
  if (detalle) return <Detalle orden={detalle} tecnicos={tecnicos} user={user} onBack={() => { setDetalle(null); cargar(); }} onReload={() => abrir(detalle.id)} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Ordenes de trabajo</h1>
        <button onClick={() => { setShowForm(!showForm); setMsg(''); }} className="bg-primary-600 text-white rounded px-4 py-2 text-sm font-medium">{showForm ? 'Cancelar' : '+ Nueva orden'}</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <h2 className="font-semibold mb-3">Recepcion de equipo</h2>
          <div className="grid md:grid-cols-2 gap-5 text-sm">
            <div>
              <div className="font-medium mb-1">Cliente</div>
              {!f.nuevoCliente ? (<>
                <select value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value, equipoId: '' })} className="w-full border rounded px-2 py-1">
                  <option value="">Selecciona un cliente...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button onClick={() => setF({ ...f, nuevoCliente: true, clienteId: '' })} className="text-primary-600 text-xs mt-1">+ Cliente nuevo</button>
              </>) : (<div className="space-y-1">
                <input className="w-full border rounded px-2 py-1" placeholder="Nombre del cliente" value={f.clienteNombre} onChange={(e) => setF({ ...f, clienteNombre: e.target.value })} />
                <select value={f.clienteTipo} onChange={(e) => setF({ ...f, clienteTipo: e.target.value })} className="w-full border rounded px-2 py-1"><option value="MOSTRADOR">Mostrador</option><option value="EMPRESA">Empresa</option><option value="GARANTIA_EPSON">Garantia EPSON</option></select>
                <button onClick={() => setF({ ...f, nuevoCliente: false })} className="text-slate-500 text-xs">usar cliente existente</button>
              </div>)}
            </div>
            <div>
              <div className="font-medium mb-1">Equipo</div>
              {!f.nuevoEquipo && equipos.length > 0 ? (<>
                <select value={f.equipoId} onChange={(e) => setF({ ...f, equipoId: e.target.value })} className="w-full border rounded px-2 py-1">
                  <option value="">Selecciona un equipo...</option>
                  {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.tipo} {eq.marca} {eq.modelo} ({eq.numeroSerie || 's/n'})</option>)}
                </select>
                <button onClick={() => setF({ ...f, nuevoEquipo: true, equipoId: '' })} className="text-primary-600 text-xs mt-1">+ Equipo nuevo</button>
              </>) : (<div className="grid grid-cols-2 gap-1">
                <select value={f.eqTipo} onChange={(e) => setF({ ...f, eqTipo: e.target.value })} className="border rounded px-2 py-1">{TIPOS_EQUIPO.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                <input className="border rounded px-2 py-1" placeholder="Marca" value={f.eqMarca} onChange={(e) => setF({ ...f, eqMarca: e.target.value })} />
                <input className="border rounded px-2 py-1" placeholder="Modelo" value={f.eqModelo} onChange={(e) => setF({ ...f, eqModelo: e.target.value })} />
                <input className="border rounded px-2 py-1" placeholder="No. de serie" value={f.eqSerie} onChange={(e) => setF({ ...f, eqSerie: e.target.value })} />
                {equipos.length > 0 && <button onClick={() => setF({ ...f, nuevoEquipo: false })} className="text-slate-500 text-xs col-span-2 text-left">usar equipo existente</button>}
              </div>)}
            </div>
            <div className="md:col-span-2"><div className="font-medium mb-1">Falla reportada</div><textarea className="w-full border rounded px-2 py-1" rows={2} placeholder="Describe la falla" value={f.falla} onChange={(e) => setF({ ...f, falla: e.target.value })} /></div>
            <div><div className="font-medium mb-1">Estado fisico / accesorios</div><input className="w-full border rounded px-2 py-1" value={f.estadoFisico} onChange={(e) => setF({ ...f, estadoFisico: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><div className="font-medium mb-1">Garantia</div><select value={f.tipoGarantia} onChange={(e) => setF({ ...f, tipoGarantia: e.target.value })} className="w-full border rounded px-2 py-1"><option value="NINGUNA">Ninguna</option><option value="EPSON">EPSON</option><option value="TALLER">Taller</option></select></div>
              <div><div className="font-medium mb-1">Tecnico</div><select value={f.tecnicoId} onChange={(e) => setF({ ...f, tecnicoId: e.target.value })} className="w-full border rounded px-2 py-1"><option value="">Sin asignar</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
            </div>
          </div>
          <div className="mt-4 flex justify-end"><button onClick={guardar} className="bg-green-600 text-white rounded px-5 py-2 text-sm font-medium">Recibir y crear orden</button></div>
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
  const [estatus, setEstatus] = useState(orden.estatus);
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
  useEffect(() => { if (q.trim()) api.get('/catalogo/productos', { params: { q } }).then((r) => setProds(r.data)); else setProds([]); }, [q]);

  async function agregarRefaccion(productoId: number) {
    const cant = prompt('Cantidad a consumir:'); if (!cant) return;
    try { await api.post(`/ordenes/${orden.id}/consumos`, { productoId, cantidad: Number(cant) }); setMsg('Refaccion consumida (inventario descontado)'); setQ(''); setProds([]); onReload(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }

  const [formaPago, setFormaPago] = useState('EFECTIVO');
  const baseCobro = Number(orden.cotizacionTotal) > 0 ? Number(orden.cotizacionTotal) : Number(orden.costoDiagnostico) || 0;
  const totalCobro = Math.round(baseCobro * 1.16 * 100) / 100;
  async function cobrar() {
    try {
      const { data } = await api.post(`/ventas/orden/${orden.id}`, { forma: formaPago });
      setMsg(`Orden cobrada. Ticket ${data.folio} por $${Number(data.total).toFixed(2)}`);
      onReload();
    } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error al cobrar'); }
  }
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
          <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className="w-full border rounded px-2 py-1">
            {ESTATUS.map((s) => <option key={s} value={s}>{ESTATUS_LABEL[s]}</option>)}
          </select>
          <input className="w-full border rounded px-2 py-1" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <button onClick={cambiarEstatus} className="bg-green-600 text-white rounded px-4 py-1">Actualizar estatus</button>
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
                <div className="text-slate-500 text-xs">Importe a cobrar (cotizacion + IVA)</div>
                <div className="text-2xl font-bold text-primary-700">${totalCobro.toFixed(2)}</div>
                <div className="text-xs text-slate-400">Base ${baseCobro.toFixed(2)} + IVA</div>
              </div>
              <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)} className="border rounded px-2 py-1">
                <option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option><option value="CREDITO">Credito</option>
              </select>
              <button onClick={cobrar} disabled={baseCobro <= 0} className="bg-green-600 disabled:bg-slate-300 text-white rounded px-5 py-2 font-medium">Cobrar en caja</button>
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
      </div>
    </div>
  );
}
