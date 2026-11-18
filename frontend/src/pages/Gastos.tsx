import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const CATEGORIAS = ['renta', 'luz', 'nomina', 'viaticos', 'otros'];

export default function Gastos() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [caja, setCaja] = useState<any>(null);
  const [msg, setMsg] = useState('');

  // form gasto
  const [categoria, setCategoria] = useState('renta');
  const [centroCosto, setCentroCosto] = useState('TALLER');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [esCajaChica, setEsCajaChica] = useState(false);
  // nomina
  const [pct, setPct] = useState('15');
  const [nomina, setNomina] = useState<any>(null);

  const cargar = () => {
    api.get('/gastos').then((r) => setGastos(r.data)).catch(() => {});
    api.get('/gastos/resumen').then((r) => setResumen(r.data)).catch(() => {});
    api.get('/gastos/caja-chica').then((r) => setCaja(r.data)).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);

  async function crearGasto() {
    if (!descripcion || !monto) return;
    await api.post('/gastos', { categoria, centroCosto, descripcion, monto: Number(monto), esCajaChica });
    setDescripcion(''); setMonto(''); setEsCajaChica(false); setMsg('Gasto registrado'); cargar();
  }
  async function reponer() {
    const m = prompt('Monto a reponer a caja chica:');
    if (!m) return;
    await api.post('/gastos/caja-chica/reposicion', { monto: Number(m), nota: 'Reposición' });
    cargar();
  }
  async function fijarFondo() {
    const f = prompt('Fondo fijo de caja chica:', caja?.caja?.fondo ?? '0');
    if (f == null) return;
    await api.put('/gastos/caja-chica/fondo', { fondo: Number(f) }); cargar();
  }
  async function calcularNomina() {
    const { data } = await api.get('/gastos/nomina/calcular', { params: { porcentaje: Number(pct) } });
    setNomina(data);
  }
  async function registrarNomina() {
    if (!nomina) return;
    const hoy = new Date(); const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
    await api.post('/gastos/nomina', { desde, hasta: new Date().toISOString().slice(0, 10), porcentaje: Number(pct) });
    setMsg('Nómina registrada como gasto'); setNomina(null); cargar();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Gastos</h1>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {/* Nuevo gasto */}
        <div className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
          <h2 className="font-semibold">Nuevo gasto</h2>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full border rounded px-2 py-1">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={centroCosto} onChange={(e) => setCentroCosto(e.target.value)} className="w-full border rounded px-2 py-1">
            <option value="TALLER">Taller</option><option value="MOSTRADOR">Mostrador</option><option value="PROYECTOS">Proyectos</option>
          </select>
          <input className="w-full border rounded px-2 py-1" placeholder="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          <input type="number" className="w-full border rounded px-2 py-1" placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={esCajaChica} onChange={(e) => setEsCajaChica(e.target.checked)} /> Pagado de caja chica</label>
          <button onClick={crearGasto} className="w-full bg-primary-600 text-white rounded py-1">Registrar</button>
        </div>

        {/* Caja chica */}
        <div className="bg-white rounded-xl shadow p-4 text-sm">
          <h2 className="font-semibold mb-2">Caja chica</h2>
          <div>Fondo: ${Number(caja?.caja?.fondo ?? 0).toFixed(2)}</div>
          <div className="text-lg font-bold">Saldo: ${Number(caja?.caja?.saldo ?? 0).toFixed(2)}</div>
          <div className="flex gap-2 mt-2">
            <button onClick={reponer} className="bg-green-600 text-white rounded px-3 py-1">Reponer</button>
            <button onClick={fijarFondo} className="bg-slate-600 text-white rounded px-3 py-1">Fijar fondo</button>
          </div>
          <div className="text-xs text-slate-400 mt-2">{caja?.reposiciones?.length ?? 0} reposiciones</div>
        </div>

        {/* Nomina */}
        <div className="bg-white rounded-xl shadow p-4 text-sm">
          <h2 className="font-semibold mb-2">Nómina (% de lo cobrado en órdenes)</h2>
          <div className="flex gap-2 items-center">
            <input type="number" value={pct} onChange={(e) => setPct(e.target.value)} className="w-20 border rounded px-2 py-1" />%
            <button onClick={calcularNomina} className="bg-primary-600 text-white rounded px-3 py-1">Calcular</button>
          </div>
          {nomina && (
            <div className="mt-2">
              <div>Base cobrada: ${Number(nomina.base).toFixed(2)} ({nomina.ordenesCobradas} órdenes)</div>
              <div className="font-bold">Nómina: ${Number(nomina.nomina).toFixed(2)}</div>
              <button onClick={registrarNomina} className="mt-1 bg-green-600 text-white rounded px-3 py-1">Registrar como gasto</button>
            </div>
          )}
        </div>
      </div>

      {resumen && (
        <div className="bg-white rounded-xl shadow p-4 mb-6 text-sm">
          <h2 className="font-semibold mb-2">Resumen del periodo · Total ${Number(resumen.total).toFixed(2)}</h2>
          <div className="flex flex-wrap gap-2">
            {resumen.porCategoria.map((c: any) => <span key={c.categoria} className="px-2 py-1 bg-slate-100 rounded">{c.categoria}: ${c.total.toFixed(2)}</span>)}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Categoría</th><th className="px-4 py-2">Centro</th><th className="px-4 py-2">Descripción</th><th className="px-4 py-2 text-right">Monto</th></tr></thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id} className="border-t">
                <td className="px-4 py-2 text-xs">{new Date(g.fecha).toLocaleDateString()}</td>
                <td className="px-4 py-2">{g.categoria}{g.esCajaChica ? ' · CC' : ''}</td>
                <td className="px-4 py-2 text-xs">{g.centroCosto}</td>
                <td className="px-4 py-2">{g.descripcion}</td>
                <td className="px-4 py-2 text-right">${Number(g.monto).toFixed(2)}</td>
              </tr>
            ))}
            {gastos.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin gastos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
