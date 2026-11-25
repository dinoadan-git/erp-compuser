import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { generarOrdenPdf, generarComprobanteRecepcion, imprimirComprobantesRecepcion, generarReporteOrdenes } from '../lib/ordenPdf';

const ESTATUS_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido', EN_DIAGNOSTICO: 'En diagnostico', ESPERANDO_AUTORIZACION: 'Esperando autorizacion',
  EN_TRAMITE_GARANTIA_EPSON: 'Tramite garantia EPSON', ESPERANDO_REFACCION: 'Esperando refaccion',
  EN_REPARACION: 'En reparacion', EN_PRUEBAS_CALIDAD: 'En pruebas de calidad',
  LISTO_ENTREGA_REPARADO: 'Listo (reparado)', LISTO_ENTREGA_SIN_REPARAR: 'Listo (sin reparar)',
  ENTREGADO: 'Entregado', ABANDONO: 'Abandono', CANCELADO: 'Cancelado',
};
const ESTATUS = Object.keys(ESTATUS_LABEL);
const TIPOS_EQUIPO = ['Impresora', 'Multifuncional', 'Laptop', 'Computadora de Escritorio', 'Proyector', 'Otro'];

const ITEM_VACIO = () => ({ equipoId: '', nuevo: false, eqTipo: 'Impresora', eqMarca: '', eqModelo: '', eqSerie: '', falla: '', estadoFisico: '', tipoGarantia: 'NINGUNA', diagnostico: '', costoDiagnostico: 200 });

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
  const [q, setQ] = useState('');

  // Cliente (una vez) + recibe/tecnico (para todo el lote)
  const [cli, setCli] = useState<any>({ clienteId: '', nuevoCliente: false, clienteNombre: '', clienteTel: '', clienteTipo: 'MOSTRADOR' });
  const [recibidoPorId, setRecibidoPorId] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  // Varios equipos -> una orden por cada uno
  const [items, setItems] = useState<any[]>([ITEM_VACIO()]);
  // Anticipo del lote (se deja apartado al recibir)
  const [dejaAnticipo, setDejaAnticipo] = useState(false);
  const [anticipoForma, setAnticipoForma] = useState('EFECTIVO');
  const [anticipoMonto, setAnticipoMonto] = useState('');
  const [cajaAbierta, setCajaAbierta] = useState<boolean>(false);
  const sumaDiagnosticos = items.reduce((s, it) => s + (Number(it.costoDiagnostico) || 0), 0);

  const [showFiltros, setShowFiltros] = useState(false);
  const [filtros, setFiltros] = useState({ estatus: '', tecnicoId: '', tipoGarantia: '', desde: '', hasta: '' });
  const cargar = () => {
    const params: any = {};
    if (filtros.estatus) params.estatus = filtros.estatus;
    if (filtros.tecnicoId) params.tecnicoId = filtros.tecnicoId;
    if (filtros.tipoGarantia) params.tipoGarantia = filtros.tipoGarantia;
    if (filtros.desde) params.desde = filtros.desde;
    if (filtros.hasta) params.hasta = filtros.hasta;
    return api.get('/ordenes', { params }).then((r) => setOrdenes(r.data)).catch(() => {});
  };
  const cargarTecnicos = () => api.get('/ordenes/tecnicos').then((r) => setTecnicos(r.data)).catch(() => {});
  useEffect(() => {
    cargar(); cargarTecnicos();
    api.get('/clientes').then((r) => setClientes(r.data)).catch(() => {});
    api.get('/config/empresa').then((r) => setEmpresa(r.data)).catch(() => {});
    api.get('/ventas/caja/actual').then((r) => setCajaAbierta(!!r.data)).catch(() => {});
  }, []);

  // Recargar la lista cuando cambian los filtros del servidor.
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [filtros]);

  function toggleAnticipo(on: boolean) {
    setDejaAnticipo(on);
    if (on && !anticipoMonto) setAnticipoMonto(String(sumaDiagnosticos || ''));
  }

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
  function resetForm() { setCli({ clienteId: '', nuevoCliente: false, clienteNombre: '', clienteTel: '', clienteTipo: 'MOSTRADOR' }); setRecibidoPorId(''); setTecnicoId(''); setItems([ITEM_VACIO()]); setDejaAnticipo(false); setAnticipoForma('EFECTIVO'); setAnticipoMonto(''); }

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

      // Anticipo del lote: se reparte entre las órdenes en proporción a su costo
      // de diagnóstico (si todos son 0, se reparte en partes iguales).
      const totalAnticipo = dejaAnticipo ? Math.max(0, Number(anticipoMonto) || 0) : 0;
      if (dejaAnticipo && totalAnticipo <= 0) { setMsg('Captura el monto del anticipo o desmarca "Se deja anticipo"'); setGuardando(false); return; }
      if (totalAnticipo > 0 && anticipoForma === 'EFECTIVO' && !cajaAbierta) {
        setMsg('Para recibir el anticipo en efectivo debes abrir la caja (ve a Ventas → Abrir caja) o usa otra forma de pago.'); setGuardando(false); return;
      }
      const baseReparto = sumaDiagnosticos > 0 ? items.map((it) => Number(it.costoDiagnostico) || 0) : items.map(() => 1);
      const sumaBase = baseReparto.reduce((s, n) => s + n, 0) || 1;
      let repartido = 0;

      const creadas: any[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.falla.trim()) { setMsg('Cada equipo necesita su falla reportada'); setGuardando(false); return; }
        let equipoId = Number(it.equipoId);
        if (it.nuevo || !equipoId) {
          const { data } = await api.post('/equipos', { clienteId, tipo: it.eqTipo, marca: it.eqMarca || undefined, modelo: it.eqModelo || undefined, numeroSerie: it.eqSerie || undefined });
          equipoId = data.id;
        }
        // Parte del anticipo para esta orden (la última absorbe el redondeo).
        const esUltima = i === items.length - 1;
        const parte = totalAnticipo <= 0 ? 0 : esUltima
          ? Math.round((totalAnticipo - repartido) * 100) / 100
          : Math.round((totalAnticipo * baseReparto[i] / sumaBase) * 100) / 100;
        repartido += parte;
        const { data: orden } = await api.post('/ordenes', {
          clienteId, equipoId, fallaReportada: it.falla, estadoFisico: it.estadoFisico || undefined, tipoGarantia: it.tipoGarantia,
          tecnicoId: tecnicoId ? Number(tecnicoId) : undefined, recibidoPorId: recibidoPorId ? Number(recibidoPorId) : undefined,
          diagnostico: it.diagnostico || undefined, costoDiagnostico: Number(it.costoDiagnostico) || 0,
          anticipo: parte, anticipoForma,
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

  const ordenesFiltradas = ordenes.filter((o) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return [o.folio, o.cliente?.nombre, o.equipo?.numeroSerie, o.equipo?.modelo, o.equipo?.marca]
      .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(t));
  });
  const filtrosActivos = Object.values(filtros).filter(Boolean).length;
  const limpiarFiltros = () => setFiltros({ estatus: '', tecnicoId: '', tipoGarantia: '', desde: '', hasta: '' });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de Servicio</h1>
          <p className="text-sm text-slate-500">Gestiona la recepción, diagnóstico y entrega de equipos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`btn-ghost ${showFiltros || filtrosActivos ? 'ring-2 ring-primary-200' : ''}`} title="Filtros" onClick={() => setShowFiltros((v) => !v)}>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 017 19.25v-5.757a2.25 2.25 0 00-.659-1.591L1.659 7.22A2.25 2.25 0 011 5.629V3.34a.75.75 0 01.628-.74z" clipRule="evenodd" /></svg>
            Filtros{filtrosActivos ? ` (${filtrosActivos})` : ''}
          </button>
          <button className="btn-ghost" title="Exportar a PDF el resultado" onClick={() => generarReporteOrdenes(ordenesFiltradas, { ...filtros, q }, tecnicos, empresa)}>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" /></svg>
            Reporte
          </button>
          <button onClick={() => { setShowForm(!showForm); setMsg(''); }} className={showForm ? 'btn-ghost' : 'btn-primary'}>
            {showForm ? 'Cancelar' : (<><span className="text-base leading-none">+</span> Nueva</>)}
          </button>
        </div>
      </div>
      {msg && <div className="mb-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 ring-1 ring-primary-100">{msg}</div>}

      {showFiltros && (
        <div className="card mb-4 text-sm">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="block"><span className="lbl">Estatus</span>
              <select value={filtros.estatus} onChange={(e) => setFiltros({ ...filtros, estatus: e.target.value })}>
                <option value="">Todos</option>
                {ESTATUS.map((s) => <option key={s} value={s}>{ESTATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="block"><span className="lbl">Técnico</span>
              <select value={filtros.tecnicoId} onChange={(e) => setFiltros({ ...filtros, tecnicoId: e.target.value })}>
                <option value="">Todos</option>
                {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </label>
            <label className="block"><span className="lbl">Garantía</span>
              <select value={filtros.tipoGarantia} onChange={(e) => setFiltros({ ...filtros, tipoGarantia: e.target.value })}>
                <option value="">Todas</option>
                <option value="NINGUNA">Sin garantía</option><option value="EPSON">Garantía EPSON</option><option value="TALLER">Garantía taller</option>
              </select>
            </label>
            <label className="block"><span className="lbl">Desde (recepción)</span>
              <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
            </label>
            <label className="block"><span className="lbl">Hasta (recepción)</span>
              <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{ordenesFiltradas.length} orden(es) en el resultado · el botón Reporte exporta esto a PDF.</span>
            {filtrosActivos > 0 && <button onClick={limpiarFiltros} className="text-xs font-medium text-primary-600">Limpiar filtros</button>}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mb-6 text-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Recepción de equipos</h2>

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

                {/* Diagnóstico y cotización por equipo */}
                <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <div className="mb-1 text-xs text-slate-500">Diagnóstico / observaciones de revisión</div>
                    <textarea rows={1} className="w-full border rounded px-2 py-1" placeholder="Qué se revisará o diagnóstico inicial (opcional)" value={it.diagnostico} onChange={(e) => setItem(i, { diagnostico: e.target.value })} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-slate-500">Costo de diagnóstico</div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input type="number" min={0} step="0.01" style={{ paddingLeft: '1.25rem' }} value={it.costoDiagnostico} onChange={(e) => setItem(i, { costoDiagnostico: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setItems((its) => [...its, ITEM_VACIO()])} className="text-primary-600 text-sm font-medium">+ Agregar equipo</button>
          </div>

          {/* Anticipo / apartado */}
          <div className="mt-4 rounded-xl bg-primary-50/60 p-4 ring-1 ring-primary-100">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={dejaAnticipo} onChange={(e) => toggleAnticipo(e.target.checked)} />
              Se deja anticipo / apartado al recibir
            </label>
            {dejaAnticipo && (
              <div className="mt-3 grid items-end gap-3 sm:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs text-slate-500">Monto del anticipo (sugerido: suma de diagnósticos ${sumaDiagnosticos.toFixed(2)})</div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input type="number" min={0} step="0.01" style={{ paddingLeft: '1.25rem' }} value={anticipoMonto} onChange={(e) => setAnticipoMonto(e.target.value)} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-slate-500">Forma de pago</div>
                  <select value={anticipoForma} onChange={(e) => setAnticipoForma(e.target.value)}>
                    <option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                  </select>
                </div>
                <div className="text-xs text-slate-500">
                  Se registra en el corte de caja del día y se descuenta del saldo al cobrar.
                  {items.length > 1 && <> Se reparte entre las {items.length} órdenes.</>}
                </div>
              </div>
            )}
            {dejaAnticipo && anticipoForma === 'EFECTIVO' && !cajaAbierta && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚠️ La caja está cerrada. Para recibir el anticipo en <b>efectivo</b> abre la caja (Ventas → Abrir caja), o elige otra forma de pago.
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={guardar} disabled={guardando} className="btn-success disabled:opacity-50">
              {guardando ? 'Creando…' : `Recibir y crear ${items.length > 1 ? `${items.length} órdenes` : 'orden'}`}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 relative max-w-md">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a1 1 0 01-1.42 1.42l-3.08-3.08A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input style={{ paddingLeft: '2.5rem' }} placeholder="Buscar por Folio, N/S o Cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Folio</th><th>Cliente</th><th>Equipo / Modelo</th><th>Técnico</th><th>Estado</th><th>Fecha recepción</th>
            </tr>
          </thead>
          <tbody>
            {ordenesFiltradas.map((o) => (
              <tr key={o.id} className="cursor-pointer" onClick={() => abrir(o.id)}>
                <td><span className="folio-link">#{o.folio}</span></td>
                <td className="font-medium text-slate-800">{o.cliente?.nombre}</td>
                <td>
                  <div className="text-slate-700">{[o.equipo?.marca, o.equipo?.modelo].filter(Boolean).join(' ') || o.equipo?.tipo || '—'}</div>
                  {o.equipo?.numeroSerie && (
                    <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">N/S: {o.equipo.numeroSerie}</span>
                  )}
                </td>
                <td>
                  <div className="text-slate-700">{o.tecnico?.nombre ?? <span className="text-slate-400">Sin asignar</span>}</div>
                  {o.recibidoPor?.nombre && <div className="text-xs text-slate-400">Recibió: {o.recibidoPor.nombre}</div>}
                </td>
                <td><span className={`pill ${pillEstatus(o.estatus)}`}>{ESTATUS_LABEL[o.estatus] ?? o.estatus}</span></td>
                <td className="text-slate-500">{o.recibidaEn ? new Date(o.recibidaEn).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
              </tr>
            ))}
            {ordenesFiltradas.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin órdenes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pillEstatus(estatus: string): string {
  if (['ENTREGADO'].includes(estatus)) return 'pill-green';
  if (['CANCELADO', 'ABANDONO'].includes(estatus)) return 'pill-gray';
  if (['LISTO_ENTREGA_REPARADO', 'LISTO_ENTREGA_SIN_REPARAR', 'EN_PRUEBAS_CALIDAD'].includes(estatus)) return 'pill-blue';
  if (['ESPERANDO_AUTORIZACION', 'ESPERANDO_REFACCION', 'EN_TRAMITE_GARANTIA_EPSON'].includes(estatus)) return 'pill-amber';
  return 'pill-amber';
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
      <button onClick={onBack} className="mb-3 text-sm font-medium text-primary-600 hover:text-primary-700">← Volver a la lista</button>
      {msg && <div className="mb-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 ring-1 ring-primary-100">{msg}</div>}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Folio #{orden.folio}</h1>
            <span className={`pill ${pillEstatus(orden.estatus)}`}>{ESTATUS_LABEL[orden.estatus] ?? orden.estatus}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{orden.cliente?.nombre} · {orden.equipo?.tipo} {orden.equipo?.marca} {orden.equipo?.modelo} ({orden.equipo?.numeroSerie || 's/n'})</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => generarComprobanteRecepcion(orden, empresa)} className="btn-ghost text-xs">Comprobante recepción</button>
          <button onClick={() => generarOrdenPdf(orden, empresa)} className="btn-primary text-xs">Orden de servicio PDF</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Datos */}
        <div className="card text-sm space-y-2">
          <h2 className="font-semibold">Datos del equipo</h2>
          <div><b>Falla:</b> {orden.fallaReportada}</div>
          <div><b>Estado fisico:</b> {orden.estadoFisico || '—'}</div>
          <div><b>Garantia:</b> {orden.tipoGarantia}</div>
          <div><b>Tecnico:</b> {orden.tecnico?.nombre ?? 'Sin asignar'}</div>
          <div className="pt-2 flex flex-wrap gap-2">
            {esTecnico && <button onClick={tomar} className="btn-primary px-3 py-1 text-xs">Tomar orden</button>}
            <select value={asignar} onChange={(e) => setAsignar(e.target.value)} className="border rounded px-2 py-1 text-xs">
              <option value="">Asignar tecnico...</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button onClick={asignarTecnico} className="btn-ghost px-3 py-1 text-xs">Asignar</button>
          </div>
        </div>

        {/* Cambiar estatus */}
        <div className="card text-sm space-y-2">
          <h2 className="font-semibold">Cambiar estatus</h2>
          <div className="text-xs text-slate-500">Actual: <b>{ESTATUS_LABEL[orden.estatus] ?? orden.estatus}</b></div>
          {permitidos.length === 0 ? (
            <p className="text-slate-400">Estatus final: esta orden ya no admite cambios.</p>
          ) : (<>
            <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className="w-full border rounded px-2 py-1">
              {permitidos.map((s) => <option key={s} value={s}>{ESTATUS_LABEL[s] ?? s}</option>)}
            </select>
            <input className="w-full border rounded px-2 py-1" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
            <button onClick={cambiarEstatus} className="btn-success px-4 py-1.5">Actualizar estatus</button>
            <p className="text-xs text-slate-400">Solo se muestran los siguientes pasos validos del flujo; no se puede regresar a un estatus anterior.</p>
          </>)}
        </div>

        {/* Diagnostico y cotizacion */}
        <div className="card text-sm space-y-2 md:col-span-2">
          <h2 className="font-semibold">Diagnostico y cotizacion</h2>
          <textarea className="w-full border rounded px-2 py-1" rows={2} placeholder="Diagnostico del tecnico" value={ed.diagnostico} onChange={(e) => setEd({ ...ed, diagnostico: e.target.value })} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <label>Costo diagnostico<input type="number" className="w-full border rounded px-2 py-1" value={ed.costoDiagnostico} onChange={(e) => setEd({ ...ed, costoDiagnostico: Number(e.target.value) })} /></label>
            <label>Cotizacion total<input type="number" className="w-full border rounded px-2 py-1" value={ed.cotizacionTotal} onChange={(e) => setEd({ ...ed, cotizacionTotal: Number(e.target.value) })} /></label>
            <label>Garantia<select className="w-full border rounded px-2 py-1" value={ed.tipoGarantia} onChange={(e) => setEd({ ...ed, tipoGarantia: e.target.value })}><option value="NINGUNA">Ninguna</option><option value="EPSON">EPSON</option><option value="TALLER">Taller</option></select></label>
          </div>
          <button onClick={guardarEdicion} className="btn-primary px-4 py-1.5">Guardar cambios</button>
        </div>

        {/* Refacciones / materiales */}
        <div className="card text-sm md:col-span-2">
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

        {/* Cobro en POS (después de refacciones) */}
        <div className="card text-sm md:col-span-2">
          <h2 className="font-semibold mb-2">Cobro</h2>
          {orden.venta ? (
            <div className="p-3 bg-green-50 text-green-800 rounded">
              Orden cobrada — Ticket <b>{orden.venta.folio}</b> por <b>${Number(orden.venta.total).toFixed(2)}</b>
              {orden.estatus !== 'ENTREGADO' && (
                <button onClick={cambiarAEntregado} className="btn-success ml-3 px-3 py-1 text-xs">Marcar entregado</button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="text-slate-500 text-xs">Importe estimado (refacciones + mano de obra, IVA incl.)</div>
                <div className="text-2xl font-bold text-primary-700">${totalCobro.toFixed(2)}</div>
                <div className="text-xs text-slate-400">Refacciones ${partsNet.toFixed(2)} + Mano de obra ${laborNet.toFixed(2)}</div>
                {Number(orden.anticipo) > 0 && (
                  <div className="mt-1 text-xs">
                    <span className="text-emerald-600">Anticipo recibido: ${Number(orden.anticipo).toFixed(2)}</span>
                    <span className="ml-2 font-semibold text-orange-600">Saldo: ${Math.max(0, totalCobro - Number(orden.anticipo)).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <button onClick={irACobrarPos} disabled={baseCobro <= 0} className="btn-success disabled:opacity-50">Cobrar en POS →</button>
              {baseCobro <= 0 && <span className="text-xs text-amber-600">Captura la cotizacion antes de cobrar.</span>}
            </div>
          )}
        </div>

        {/* Bitacora */}
        <div className="card text-sm md:col-span-2">
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
        <div className="card text-sm md:col-span-2">
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
