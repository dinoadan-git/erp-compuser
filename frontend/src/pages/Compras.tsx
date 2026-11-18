import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Prov { id: number; nombre: string; esEpson: boolean; saldo: string }
interface Prod { id: number; nombre: string; sku: string | null }
interface LineaOC { productoId: number; nombre: string; cantidad: number; costoUnit: number }

const ESTATUS: Record<string, string> = {
  BORRADOR: 'Borrador', ENVIADA: 'Enviada', PARCIAL: 'Parcial', RECIBIDA: 'Recibida', CANCELADA: 'Cancelada',
};

export default function Compras() {
  const [provs, setProvs] = useState<Prov[]>([]);
  const [ocs, setOcs] = useState<any[]>([]);
  const [sugeridas, setSugeridas] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  // alta proveedor
  const [nuevoProv, setNuevoProv] = useState('');
  // nueva OC
  const [provSel, setProvSel] = useState<number | ''>('');
  const [q, setQ] = useState('');
  const [prods, setProds] = useState<Prod[]>([]);
  const [lineas, setLineas] = useState<LineaOC[]>([]);

  const cargar = () => {
    api.get('/compras/proveedores').then((r) => setProvs(r.data)).catch(() => {});
    api.get('/compras/ordenes').then((r) => setOcs(r.data)).catch(() => {});
    api.get('/compras/requisiciones/sugeridas').then((r) => setSugeridas(r.data)).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (q.trim()) api.get('/catalogo/productos', { params: { q } }).then((r) => setProds(r.data)); else setProds([]); }, [q]);

  const totalOC = lineas.reduce((s, l) => s + l.cantidad * l.costoUnit, 0) * 1.16;

  async function addProv() {
    if (!nuevoProv.trim()) return;
    await api.post('/compras/proveedores', { nombre: nuevoProv });
    setNuevoProv(''); cargar();
  }
  function addLinea(p: Prod) {
    setLineas((l) => l.some((x) => x.productoId === p.id) ? l : [...l, { productoId: p.id, nombre: p.nombre, cantidad: 1, costoUnit: 0 }]);
    setQ(''); setProds([]);
  }
  async function crearOC() {
    if (!provSel || lineas.length === 0) return;
    await api.post('/compras/ordenes', { proveedorId: provSel, enviar: true, items: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, costoUnit: l.costoUnit })) });
    setMsg('Orden de compra creada'); setLineas([]); setProvSel(''); cargar();
  }
  async function recibirTodo(ocId: number) {
    const { data: oc } = await api.get(`/compras/ordenes/${ocId}`);
    const recibidos = oc.detalles
      .map((d: any) => ({ detalleId: d.id, cantidad: Number(d.cantidad) - Number(d.cantidadRecibida) }))
      .filter((r: any) => r.cantidad > 0);
    if (recibidos.length === 0) { setMsg('Nada pendiente por recibir'); return; }
    const { data } = await api.post(`/compras/ordenes/${ocId}/recepcion`, { recibidos });
    setMsg(`Recepción: ${data.estatus} · por pagar $${data.porPagar}`); cargar();
  }
  async function pagar(oc: any) {
    const monto = prompt(`Pago a proveedor (OC ${oc.folio})\nMonto:`, String(oc.total));
    if (!monto) return;
    await api.post(`/compras/ordenes/${oc.id}/pago`, { monto: Number(monto) });
    setMsg('Pago registrado'); cargar();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Compras</h1>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      {sugeridas.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <div className="font-semibold text-amber-800 mb-1">Requisiciones sugeridas por faltantes ({sugeridas.length})</div>
          <ul className="text-amber-900 space-y-0.5">
            {sugeridas.map((s) => <li key={s.productoId}>{s.nombre}: comprar <b>{s.cantidadSugerida}</b> (disp {s.disponible} / mín {s.minimo})</li>)}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Nueva OC */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Nueva orden de compra</h2>
          <select value={provSel} onChange={(e) => setProvSel(Number(e.target.value) || '')} className="w-full border rounded px-2 py-1 text-sm mb-2">
            <option value="">Selecciona proveedor...</option>
            {provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.esEpson ? ' (EPSON)' : ''}</option>)}
          </select>
          <input className="w-full border rounded px-2 py-1 text-sm mb-1" placeholder="Buscar producto..." value={q} onChange={(e) => setQ(e.target.value)} />
          {prods.length > 0 && (
            <ul className="border rounded mb-2 max-h-32 overflow-y-auto text-sm">
              {prods.map((p) => <li key={p.id} onClick={() => addLinea(p)} className="px-2 py-1 hover:bg-slate-100 cursor-pointer">{p.nombre}</li>)}
            </ul>
          )}
          {lineas.map((l) => (
            <div key={l.productoId} className="flex items-center gap-2 text-sm mb-1">
              <span className="flex-1 truncate">{l.nombre}</span>
              <input type="number" min={1} value={l.cantidad} onChange={(e) => setLineas((ls) => ls.map((x) => x.productoId === l.productoId ? { ...x, cantidad: Number(e.target.value) } : x))} className="w-16 border rounded px-1" />
              <input type="number" min={0} placeholder="costo" value={l.costoUnit || ''} onChange={(e) => setLineas((ls) => ls.map((x) => x.productoId === l.productoId ? { ...x, costoUnit: Number(e.target.value) } : x))} className="w-20 border rounded px-1" />
              <button onClick={() => setLineas((ls) => ls.filter((x) => x.productoId !== l.productoId))} className="text-red-500 text-xs">x</button>
            </div>
          ))}
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm font-medium">Total c/IVA: ${totalOC.toFixed(2)}</span>
            <button onClick={crearOC} disabled={!provSel || lineas.length === 0} className="bg-primary-600 disabled:bg-slate-300 text-white rounded px-3 py-1 text-sm">Crear OC</button>
          </div>
        </div>

        {/* Proveedores */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Proveedores</h2>
          <div className="flex gap-2 mb-2">
            <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Nuevo proveedor..." value={nuevoProv} onChange={(e) => setNuevoProv(e.target.value)} />
            <button onClick={addProv} className="bg-slate-700 text-white rounded px-3 text-sm">Agregar</button>
          </div>
          <ul className="text-sm divide-y max-h-48 overflow-y-auto">
            {provs.map((p) => (
              <li key={p.id} className="py-1 flex justify-between">
                <span>{p.nombre}{p.esEpson ? ' · EPSON' : ''}</span>
                <span className={Number(p.saldo) > 0 ? 'text-red-600' : 'text-slate-400'}>${Number(p.saldo).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Ordenes de compra */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Proveedor</th><th className="px-4 py-2">Estatus</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {ocs.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2 font-mono">{o.folio}</td>
                <td className="px-4 py-2">{o.proveedor?.nombre}</td>
                <td className="px-4 py-2"><span className="px-2 py-0.5 rounded bg-slate-100 text-xs">{ESTATUS[o.estatus] ?? o.estatus}</span></td>
                <td className="px-4 py-2 text-right">${Number(o.total).toFixed(2)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {['ENVIADA', 'PARCIAL', 'BORRADOR'].includes(o.estatus) && <button onClick={() => recibirTodo(o.id)} className="text-primary-600 text-xs mr-2">Recibir todo</button>}
                  <button onClick={() => pagar(o)} className="text-green-600 text-xs">Pagar</button>
                </td>
              </tr>
            ))}
            {ocs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin órdenes de compra</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
