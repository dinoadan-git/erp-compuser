import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const ESTATUS = ['COTIZACION', 'EN_CURSO', 'PAUSADO', 'CERRADO', 'CANCELADO'];

export default function Proyectos() {
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [polizas, setPolizas] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', clienteId: '', total: '', alcance: '' });

  const cargarLista = () => {
    api.get('/proyectos').then((r) => setProyectos(r.data)).catch(() => {});
    api.get('/proyectos/polizas/lista').then((r) => setPolizas(r.data)).catch(() => {});
  };
  const abrir = (id: number) => api.get(`/proyectos/${id}`).then((r) => setSel(r.data)).catch(() => {});
  useEffect(() => { cargarLista(); }, []);

  async function crear() {
    if (!nuevo.nombre || !nuevo.clienteId) { setMsg('Nombre y cliente (ID) requeridos'); return; }
    await api.post('/proyectos', { nombre: nuevo.nombre, clienteId: Number(nuevo.clienteId), total: Number(nuevo.total || 0), alcance: nuevo.alcance });
    setNuevo({ nombre: '', clienteId: '', total: '', alcance: '' }); setMsg('Proyecto creado'); cargarLista();
  }
  async function cambiarEstatus(e: string) { await api.put(`/proyectos/${sel.id}`, { estatus: e }); abrir(sel.id); cargarLista(); }
  async function addEtapa() {
    const nombre = prompt('Nombre de la etapa:'); if (!nombre) return;
    const avance = prompt('Avance % (0-100):', '0'); const resp = prompt('Responsable:') || undefined;
    await api.post(`/proyectos/${sel.id}/etapas`, { nombre, avance: Number(avance || 0), responsable: resp }); abrir(sel.id);
  }
  async function addVisita() {
    const fecha = prompt('Fecha de visita (YYYY-MM-DD):'); if (!fecha) return;
    const nota = prompt('Nota:') || undefined;
    await api.post(`/proyectos/${sel.id}/visitas`, { fecha, nota }); abrir(sel.id);
  }
  async function addMaterial() {
    const productoId = prompt('ID de producto a consumir:'); if (!productoId) return;
    const cantidad = prompt('Cantidad:'); if (!cantidad) return;
    try { await api.post(`/proyectos/${sel.id}/materiales`, { productoId: Number(productoId), cantidad: Number(cantidad) }); abrir(sel.id); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }
  async function addPago() {
    const concepto = prompt('Concepto (ANTICIPO / AVANCE / CIERRE):', 'ANTICIPO'); if (!concepto) return;
    const monto = prompt('Monto:'); if (!monto) return;
    await api.post(`/proyectos/${sel.id}/pagos`, { concepto: concepto.toUpperCase(), monto: Number(monto) }); abrir(sel.id);
  }
  async function addPoliza() {
    const nombre = prompt('Nombre de la póliza:'); if (!nombre) return;
    const clienteId = prompt('ID cliente:'); if (!clienteId) return;
    const inicio = prompt('Inicio (YYYY-MM-DD):', new Date().toISOString().slice(0, 10)); if (!inicio) return;
    await api.post('/proyectos/polizas', { nombre, clienteId: Number(clienteId), inicio, total: 0 }); cargarLista();
  }
  async function addServicio(polizaId: number) {
    const fecha = prompt('Fecha servicio (YYYY-MM-DD):'); if (!fecha) return;
    const descripcion = prompt('Descripción:'); if (!descripcion) return;
    await api.post(`/proyectos/polizas/${polizaId}/servicios`, { fecha, descripcion }); cargarLista();
  }
  async function realizarServicio(id: number) { await api.post(`/proyectos/servicios/${id}/realizado`); cargarLista(); }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Proyectos y servicios especiales</h1>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* Nuevo proyecto */}
        <div className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
          <h2 className="font-semibold">Nuevo proyecto</h2>
          <input className="w-full border rounded px-2 py-1" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <input className="w-full border rounded px-2 py-1" placeholder="ID cliente" value={nuevo.clienteId} onChange={(e) => setNuevo({ ...nuevo, clienteId: e.target.value })} />
          <input type="number" className="w-full border rounded px-2 py-1" placeholder="Total cotizado" value={nuevo.total} onChange={(e) => setNuevo({ ...nuevo, total: e.target.value })} />
          <textarea className="w-full border rounded px-2 py-1" placeholder="Alcance" value={nuevo.alcance} onChange={(e) => setNuevo({ ...nuevo, alcance: e.target.value })} />
          <button onClick={crear} className="w-full bg-primary-600 text-white rounded py-1">Crear</button>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow p-4 md:col-span-2">
          <h2 className="font-semibold mb-2">Proyectos</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left"><tr><th className="px-3 py-1">Folio</th><th className="px-3 py-1">Nombre</th><th className="px-3 py-1">Cliente</th><th className="px-3 py-1">Estatus</th><th className="px-3 py-1 text-right">Total</th></tr></thead>
            <tbody>
              {proyectos.map((p) => (
                <tr key={p.id} className="border-t cursor-pointer hover:bg-slate-50" onClick={() => abrir(p.id)}>
                  <td className="px-3 py-1 font-mono">{p.folio}</td><td className="px-3 py-1">{p.nombre}</td>
                  <td className="px-3 py-1">{p.cliente?.nombre}</td><td className="px-3 py-1 text-xs">{p.estatus}</td>
                  <td className="px-3 py-1 text-right">${Number(p.total).toLocaleString()}</td>
                </tr>
              ))}
              {proyectos.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Sin proyectos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle del proyecto seleccionado */}
      {sel && (
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-semibold text-lg">{sel.folio} · {sel.nombre}</h2>
              <p className="text-sm text-slate-500">{sel.cliente?.nombre} · {sel.alcance}</p>
            </div>
            <div className="text-right text-sm">
              <select value={sel.estatus} onChange={(e) => cambiarEstatus(e.target.value)} className="border rounded px-2 py-1 mb-1">
                {ESTATUS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <div>Total ${Number(sel.total).toLocaleString()} · Pagado ${Number(sel.pagado).toLocaleString()} · <b>Saldo ${Number(sel.saldo).toLocaleString()}</b></div>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <Panel titulo="Etapas" onAdd={addEtapa}>
              {sel.etapas.map((e: any) => (
                <div key={e.id} className="mb-2">
                  <div className="flex justify-between"><span>{e.nombre}</span><span>{e.avance}%</span></div>
                  <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-primary-500 rounded" style={{ width: `${e.avance}%` }} /></div>
                  <div className="text-xs text-slate-400">{e.responsable ?? ''} · {Number(e.horas)}h</div>
                </div>
              ))}
            </Panel>
            <Panel titulo="Visitas" onAdd={addVisita}>
              {sel.visitas.map((v: any) => <div key={v.id} className="text-xs mb-1">{new Date(v.fecha).toLocaleDateString()} — {v.nota}</div>)}
            </Panel>
            <Panel titulo="Materiales" onAdd={addMaterial}>
              {sel.materiales.map((m: any) => <div key={m.id} className="text-xs mb-1">{m.producto.nombre} × {Number(m.cantidad)}</div>)}
            </Panel>
            <Panel titulo="Pagos" onAdd={addPago}>
              {sel.pagos.map((p: any) => <div key={p.id} className="text-xs mb-1">{p.concepto}: ${Number(p.monto).toLocaleString()}</div>)}
            </Panel>
          </div>
        </div>
      )}

      {/* Polizas de mantenimiento */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Pólizas de mantenimiento</h2>
          <button onClick={addPoliza} className="text-primary-600 text-sm">+ Nueva póliza</button>
        </div>
        {polizas.map((p) => (
          <div key={p.id} className="border-t py-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{p.nombre} · {p.cliente?.nombre}</span>
              <button onClick={() => addServicio(p.id)} className="text-primary-600 text-xs">+ Servicio</button>
            </div>
            {p.servicios.map((s: any) => (
              <div key={s.id} className="flex justify-between text-xs text-slate-600 pl-2">
                <span>{new Date(s.fecha).toLocaleDateString()} — {s.descripcion}</span>
                {s.realizado ? <span className="text-green-600">✓ realizado</span> : <button onClick={() => realizarServicio(s.id)} className="text-primary-600">marcar realizado</button>}
              </div>
            ))}
          </div>
        ))}
        {polizas.length === 0 && <div className="text-slate-400 text-sm py-2">Sin pólizas</div>}
      </div>
    </div>
  );
}

function Panel({ titulo, onAdd, children }: { titulo: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="border rounded p-2">
      <div className="flex justify-between items-center mb-1"><span className="font-medium">{titulo}</span><button onClick={onAdd} className="text-primary-600 text-xs">+</button></div>
      {children}
    </div>
  );
}
