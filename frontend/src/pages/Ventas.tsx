import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Prod { id: number; sku: string | null; nombre: string; tasaIva: number; precioPublico: number; disponible: number }
interface Linea { productoId: number; nombre: string; cantidad: number; precioUnit: number; tasaIva: number }

export default function Ventas() {
  const [caja, setCaja] = useState<any>(null);
  const [fondo, setFondo] = useState('0');
  const [arqueo, setArqueo] = useState('');
  const [q, setQ] = useState('');
  const [prods, setProds] = useState<Prod[]>([]);
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [forma, setForma] = useState('EFECTIVO');
  const [msg, setMsg] = useState('');

  const cargarCaja = () => api.get('/ventas/caja/actual').then((r) => setCaja(r.data)).catch(() => {});
  useEffect(() => { cargarCaja(); }, []);
  useEffect(() => { if (q.trim()) api.get('/catalogo/productos', { params: { q } }).then((r) => setProds(r.data)); else setProds([]); }, [q]);

  const subtotal = carrito.reduce((s, l) => s + l.cantidad * l.precioUnit, 0);
  const iva = carrito.reduce((s, l) => s + l.cantidad * l.precioUnit * (l.tasaIva / 100), 0);
  const total = subtotal + iva;

  function agregar(p: Prod) {
    setCarrito((c) => {
      const ex = c.find((l) => l.productoId === p.id);
      if (ex) return c.map((l) => l.productoId === p.id ? { ...l, cantidad: l.cantidad + 1 } : l);
      return [...c, { productoId: p.id, nombre: p.nombre, cantidad: 1, precioUnit: Number(p.precioPublico), tasaIva: Number(p.tasaIva) }];
    });
    setQ(''); setProds([]);
  }

  async function abrirCaja() {
    await api.post('/ventas/caja/abrir', { fondoApertura: Number(fondo) });
    cargarCaja();
  }
  async function cerrarCaja() {
    const { data } = await api.post('/ventas/caja/cerrar', { arqueo: Number(arqueo) });
    setMsg(`Caja cerrada. Esperado efectivo: $${data.esperadoEfectivo} · Diferencia: $${data.corte.diferencia}`);
    setArqueo(''); cargarCaja();
  }
  async function cobrar() {
    try {
      const { data } = await api.post('/ventas', {
        tipo: 'TICKET',
        items: carrito.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, precioUnit: l.precioUnit })),
        pagos: [{ forma, monto: Number(total.toFixed(2)) }],
      });
      setMsg(`Venta ${data.folio} registrada por $${data.total}`);
      setCarrito([]);
    } catch (e: any) {
      setMsg(e?.response?.data?.error ?? 'Error al cobrar');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Ventas (POS)</h1>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      {/* Barra de caja */}
      <div className="mb-4 bg-white rounded-xl shadow p-4 flex items-center gap-4 text-sm">
        {caja ? (
          <>
            <span className="font-medium text-green-700">Caja abierta</span>
            <span className="text-slate-500">Fondo: ${Number(caja.fondoApertura).toFixed(2)} · Retiros: ${Number(caja.retiros).toFixed(2)}</span>
            <input className="border rounded px-2 py-1 w-32" placeholder="Arqueo $" value={arqueo} onChange={(e) => setArqueo(e.target.value)} />
            <button onClick={cerrarCaja} className="bg-slate-700 text-white rounded px-3 py-1">Cerrar caja</button>
          </>
        ) : (
          <>
            <span className="text-slate-500">Caja cerrada</span>
            <input className="border rounded px-2 py-1 w-32" placeholder="Fondo $" value={fondo} onChange={(e) => setFondo(e.target.value)} />
            <button onClick={abrirCaja} className="bg-primary-600 text-white rounded px-3 py-1">Abrir caja</button>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Buscador de productos */}
        <div className="bg-white rounded-xl shadow p-4">
          <input className="w-full border rounded px-3 py-2 text-sm mb-2" placeholder="Buscar producto por nombre, SKU o codigo de barras..."
            value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="divide-y max-h-80 overflow-y-auto">
            {prods.map((p) => (
              <li key={p.id} className="py-2 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-xs text-slate-400">{p.sku} · stock {Number(p.disponible)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span>${Number(p.precioPublico).toFixed(2)}</span>
                  <button onClick={() => agregar(p)} className="bg-primary-600 text-white rounded px-2 py-1 text-xs">Agregar</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Carrito */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-col">
          <h2 className="font-semibold mb-2">Venta actual</h2>
          <div className="flex-1 divide-y">
            {carrito.map((l) => (
              <div key={l.productoId} className="py-2 flex justify-between items-center text-sm">
                <div>{l.nombre}</div>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={l.cantidad}
                    onChange={(e) => setCarrito((c) => c.map((x) => x.productoId === l.productoId ? { ...x, cantidad: Number(e.target.value) } : x))}
                    className="w-14 border rounded px-1 py-0.5" />
                  <span className="w-20 text-right">${(l.cantidad * l.precioUnit).toFixed(2)}</span>
                  <button onClick={() => setCarrito((c) => c.filter((x) => x.productoId !== l.productoId))} className="text-red-500 text-xs">quitar</button>
                </div>
              </div>
            ))}
            {carrito.length === 0 && <div className="text-slate-400 text-sm py-6 text-center">Carrito vacio</div>}
          </div>
          <div className="mt-3 border-t pt-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>IVA</span><span>${iva.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>${total.toFixed(2)}</span></div>
            <select value={forma} onChange={(e) => setForma(e.target.value)} className="w-full border rounded px-2 py-1 mt-2">
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="CREDITO">Credito</option>
            </select>
            <button onClick={cobrar} disabled={!caja || carrito.length === 0}
              className="w-full bg-green-600 disabled:bg-slate-300 text-white rounded py-2 mt-2 font-medium">
              Cobrar
            </button>
            {!caja && <p className="text-xs text-amber-600 text-center">Abre la caja para cobrar</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
