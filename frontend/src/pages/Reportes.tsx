import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function hoy() { return new Date().toISOString().slice(0, 10); }
function inicioMes() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }

export default function Reportes() {
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoy());
  const [dash, setDash] = useState<any>(null);
  const [util, setUtil] = useState<any>(null);
  const [prod, setProd] = useState<any[]>([]);
  const [gvi, setGvi] = useState<any>(null);

  const params = { desde, hasta };
  function cargar() {
    api.get('/reportes/dashboard', { params }).then((r) => setDash(r.data)).catch(() => {});
    api.get('/reportes/ventas-utilidad', { params }).then((r) => setUtil(r.data)).catch(() => {});
    api.get('/reportes/productividad-tecnicos', { params }).then((r) => setProd(r.data)).catch(() => {});
    api.get('/reportes/gastos-vs-ingresos', { params }).then((r) => setGvi(r.data)).catch(() => {});
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  function descargarCsv(ruta: string) {
    const token = localStorage.getItem('token');
    const url = `/api/reportes/${ruta}${ruta.includes('?') ? '&' : '?'}formato=csv&desde=${desde}&hasta=${hasta}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${ruta.split('?')[0]}.csv`; a.click(); });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reportes y analítica</h1>

      <div className="flex items-end gap-2 mb-4 text-sm">
        <label>Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="block border rounded px-2 py-1" /></label>
        <label>Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="block border rounded px-2 py-1" /></label>
        <button onClick={cargar} className="bg-primary-600 text-white rounded px-4 py-1">Actualizar</button>
      </div>

      {/* KPIs */}
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi t="Ingresos" v={`$${dash.ingresos.toLocaleString()}`} />
          <Kpi t="Ventas" v={dash.numVentas} sub={`Ticket prom. $${dash.ticketPromedio.toLocaleString()}`} />
          <Kpi t="Gastos" v={`$${dash.gastos.toLocaleString()}`} />
          <Kpi t="Utilidad operativa" v={`$${dash.utilidadOperativa.toLocaleString()}`} rojo={dash.utilidadOperativa < 0} />
          <Kpi t="Órdenes activas" v={dash.ordenesActivas} />
          <Kpi t="Inventario valorizado" v={`$${dash.inventarioValorizado.toLocaleString()}`} />
          <Kpi t="Cuentas por cobrar" v={`$${dash.cuentasPorCobrar.toLocaleString()}`} />
          <Kpi t="Cuentas por pagar" v={`$${dash.cuentasPorPagar.toLocaleString()}`} />
        </div>
      )}

      {/* Gastos vs ingresos */}
      {gvi && (
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <h2 className="font-semibold mb-3">Gastos vs ingresos</h2>
          <Barra etiqueta="Ingresos" valor={gvi.ingresos} max={Math.max(gvi.ingresos, gvi.gastos)} color="bg-green-500" />
          <Barra etiqueta="Gastos" valor={gvi.gastos} max={Math.max(gvi.ingresos, gvi.gastos)} color="bg-red-400" />
          <div className="text-sm mt-2">Utilidad: <b className={gvi.utilidad < 0 ? 'text-red-600' : 'text-green-700'}>${gvi.utilidad.toLocaleString()}</b></div>
        </div>
      )}

      {/* Utilidad por producto */}
      {util && (
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Utilidad y margen por producto</h2>
            <button onClick={() => descargarCsv('ventas-utilidad')} className="text-primary-600 text-sm">Exportar CSV</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-right">Cant.</th><th className="px-3 py-2 text-right">Ingreso</th><th className="px-3 py-2 text-right">Costo</th><th className="px-3 py-2 text-right">Utilidad</th><th className="px-3 py-2 text-right">Margen</th></tr></thead>
            <tbody>
              {util.filas.map((f: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1">{f.producto}</td>
                  <td className="px-3 py-1 text-right">{f.cantidad}</td>
                  <td className="px-3 py-1 text-right">${f.ingreso.toLocaleString()}</td>
                  <td className="px-3 py-1 text-right">${f.costo.toLocaleString()}</td>
                  <td className="px-3 py-1 text-right font-medium">${f.utilidad.toLocaleString()}</td>
                  <td className="px-3 py-1 text-right">{f.margen}%</td>
                </tr>
              ))}
              {util.filas.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Sin ventas en el periodo</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Productividad por tecnico */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Productividad por técnico</h2>
          <button onClick={() => descargarCsv('productividad-tecnicos')} className="text-primary-600 text-sm">Exportar CSV</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left"><tr><th className="px-3 py-2">Técnico</th><th className="px-3 py-2 text-right">Entregadas</th><th className="px-3 py-2 text-right">Horas prom.</th><th className="px-3 py-2 text-right">SLA</th></tr></thead>
          <tbody>
            {prod.map((p, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-1">{p.tecnico}</td>
                <td className="px-3 py-1 text-right">{p.entregadas}</td>
                <td className="px-3 py-1 text-right">{p.horasPromedio}h</td>
                <td className="px-3 py-1 text-right">{p.cumplimientoSla != null ? `${p.cumplimientoSla}%` : '—'}</td>
              </tr>
            ))}
            {prod.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">Sin órdenes entregadas en el periodo</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ t, v, sub, rojo }: { t: string; v: string | number; sub?: string; rojo?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-xs text-slate-500">{t}</div>
      <div className={`text-2xl font-bold ${rojo ? 'text-red-600' : 'text-primary-700'}`}>{v}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function Barra({ etiqueta, valor, max, color }: { etiqueta: string; valor: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5"><span>{etiqueta}</span><span>${valor.toLocaleString()}</span></div>
      <div className="h-3 bg-slate-100 rounded"><div className={`h-3 rounded ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
