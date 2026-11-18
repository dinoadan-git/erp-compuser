import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Fila {
  productoId: number; sku: string | null; nombre: string; costoPromedio: string;
  disponible: number; apartado: number; minimo: number; maximo: number; bajoMinimo: boolean;
}

export default function Inventario() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [kardex, setKardex] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const cargar = () => {
    api.get('/inventario', { params: { q } }).then((r) => setFilas(r.data)).catch(() => {});
    api.get('/inventario/alertas').then((r) => setAlertas(r.data)).catch(() => {});
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [q]);

  async function entrada(f: Fila) {
    const cant = prompt(`Entrada para ${f.nombre}\nCantidad a ingresar:`);
    if (!cant) return;
    const costo = prompt('Costo unitario (opcional):') || undefined;
    await api.post('/inventario/entrada', { productoId: f.productoId, cantidad: Number(cant), costoUnit: costo ? Number(costo) : undefined });
    setMsg(`Entrada registrada para ${f.nombre}`); cargar();
  }
  async function ajuste(f: Fila) {
    const cant = prompt(`Ajuste de ${f.nombre}\nCantidad fisica real:`, String(f.disponible));
    if (cant == null) return;
    const motivo = prompt('Motivo del ajuste:') || 'Ajuste';
    const { data } = await api.post('/inventario/ajuste', { productoId: f.productoId, cantidadFinal: Number(cant), motivo });
    setMsg(`Ajuste: ${f.nombre} ${data.anterior} -> ${data.nuevo} (dif ${data.diferencia})`); cargar();
  }
  async function verKardex(f: Fila) {
    const { data } = await api.get(`/inventario/${f.productoId}/kardex`);
    setKardex(data);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Inventario</h1>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      {alertas.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="font-semibold text-amber-800 mb-2">Alertas de reorden ({alertas.length})</div>
          <ul className="text-sm text-amber-900 space-y-1">
            {alertas.map((a) => (
              <li key={a.productoId}>{a.nombre} — disponible {a.disponible} (mín {a.minimo}), sugerido comprar <b>{a.sugeridoComprar}</b></li>
            ))}
          </ul>
        </div>
      )}

      <input className="border rounded px-3 py-2 text-sm mb-4 w-72" placeholder="Buscar por nombre o SKU..."
        value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-2">Producto</th><th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2 text-right">Disponible</th><th className="px-4 py-2 text-right">Apartado</th>
              <th className="px-4 py-2 text-right">Mín/Máx</th><th className="px-4 py-2 text-right">Costo prom.</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.productoId} className={`border-t ${f.bajoMinimo && f.minimo > 0 ? 'bg-amber-50' : ''}`}>
                <td className="px-4 py-2">{f.nombre}</td>
                <td className="px-4 py-2 font-mono text-xs">{f.sku}</td>
                <td className="px-4 py-2 text-right font-medium">{f.disponible}</td>
                <td className="px-4 py-2 text-right text-slate-500">{f.apartado}</td>
                <td className="px-4 py-2 text-right text-xs text-slate-500">{f.minimo}/{f.maximo}</td>
                <td className="px-4 py-2 text-right">${Number(f.costoPromedio).toFixed(2)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => entrada(f)} className="text-primary-600 text-xs mr-2">+ Entrada</button>
                  <button onClick={() => ajuste(f)} className="text-amber-600 text-xs mr-2">Ajuste</button>
                  <button onClick={() => verKardex(f)} className="text-slate-600 text-xs">Kardex</button>
                </td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Sin productos</td></tr>}
          </tbody>
        </table>
      </div>

      {kardex && (
        <div className="mt-6 bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold">Kardex: {kardex.producto.nombre} (costo prom. ${Number(kardex.producto.costoPromedio).toFixed(2)})</h2>
            <button onClick={() => setKardex(null)} className="text-slate-400 text-sm">cerrar</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2 text-right">Cantidad</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2">Motivo</th></tr>
            </thead>
            <tbody>
              {kardex.kardex.map((m: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1 text-xs">{new Date(m.fecha).toLocaleString()}</td>
                  <td className="px-3 py-1">{m.tipo}</td>
                  <td className="px-3 py-1 text-right">{m.cantidad}</td>
                  <td className="px-3 py-1 text-right font-medium">{m.saldo}</td>
                  <td className="px-3 py-1 text-slate-500">{m.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
