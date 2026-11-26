import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const money = (n: any) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default function Caja() {
  const [caja, setCaja] = useState<any>(null);
  const [fondo, setFondo] = useState('0');
  const [arqueo, setArqueo] = useState('');
  const [msg, setMsg] = useState('');
  // Ventana semanal (paginación de 7 días) para el historial de cortes.
  const [finSemana, setFinSemana] = useState(() => new Date());
  const [cortes, setCortes] = useState<any[]>([]);

  const iniSemana = new Date(finSemana); iniSemana.setDate(iniSemana.getDate() - 6);

  const cargarCaja = () => api.get('/ventas/caja/actual').then((r) => setCaja(r.data)).catch(() => {});
  const cargarCortes = () => api.get('/ventas/caja/cortes', { params: { desde: ymd(iniSemana), hasta: ymd(finSemana) } })
    .then((r) => setCortes(r.data)).catch(() => {});
  useEffect(() => { cargarCaja(); }, []);
  useEffect(() => { cargarCortes(); /* eslint-disable-next-line */ }, [finSemana]);

  async function abrir() {
    try { await api.post('/ventas/caja/abrir', { fondoApertura: Number(fondo) }); setMsg('Caja abierta'); cargarCaja(); cargarCortes(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }
  async function cerrar() {
    try {
      const { data } = await api.post('/ventas/caja/cerrar', { arqueo: Number(arqueo) });
      setMsg(`Caja cerrada. Esperado efectivo: ${money(data.esperadoEfectivo)} · Diferencia: ${money(data.corte.diferencia)}`);
      setArqueo(''); cargarCaja(); cargarCortes();
    } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }
  async function movimiento(tipo: 'ingreso' | 'retiro') {
    const etiqueta = tipo === 'ingreso' ? 'Abono / ingreso de efectivo' : 'Retiro de efectivo';
    const v = window.prompt(`${etiqueta} — monto:`);
    if (!v) return;
    try { await api.post(`/ventas/caja/${tipo}`, { monto: Number(v) }); setMsg(`${etiqueta}: ${money(v)}`); cargarCaja(); cargarCortes(); }
    catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error'); }
  }

  const semanaActual = ymd(finSemana) === ymd(new Date());
  const rango = `${iniSemana.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} – ${finSemana.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Caja</h1>
        <p className="text-sm text-slate-500">Apertura, cierre, abonos y retiros de efectivo, e historial de cortes.</p>
      </div>
      {msg && <div className="mb-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 ring-1 ring-primary-100">{msg}</div>}

      {/* Estado de la caja */}
      <div className="card mb-6">
        {caja ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="pill pill-green">Caja abierta</span>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <Dato k="Fondo" v={money(caja.fondoApertura)} />
              <Dato k="Efectivo ventas" v={money(caja.resumen?.efectivo)} />
              <Dato k="Abonos" v={money(caja.ingresos)} />
              <Dato k="Retiros" v={money(caja.retiros)} />
              <Dato k="Tarjeta" v={money(caja.resumen?.tarjeta)} />
              <Dato k="Anticipos (efvo)" v={money(caja.resumen?.anticiposEfectivo)} />
              <Dato k="En caja (esperado)" v={money(caja.resumen?.esperadoEfectivo)} fuerte />
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button onClick={() => movimiento('ingreso')} className="btn-ghost text-xs">+ Abono a caja</button>
              <button onClick={() => movimiento('retiro')} className="btn-ghost text-xs">− Retiro</button>
              <input className="w-28" placeholder="Arqueo $" value={arqueo} onChange={(e) => setArqueo(e.target.value)} />
              <button onClick={cerrar} className="btn-danger">Cerrar caja</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="pill pill-gray">Caja cerrada</span>
            <span className="text-sm text-slate-500">Abre la caja para poder cobrar en efectivo.</span>
            <div className="ml-auto flex items-center gap-2">
              <input className="w-32" placeholder="Fondo inicial $" value={fondo} onChange={(e) => setFondo(e.target.value)} />
              <button onClick={abrir} className="btn-primary">Abrir caja</button>
            </div>
          </div>
        )}
      </div>

      {/* Historial de cortes (paginado por semana) */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-800">Historial de cortes</h2>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => { const d = new Date(finSemana); d.setDate(d.getDate() - 7); setFinSemana(d); }} className="btn-ghost px-2 py-1">← Semana anterior</button>
            <span className="min-w-[11rem] text-center font-medium text-slate-600">{rango}</span>
            <button onClick={() => { const d = new Date(finSemana); d.setDate(d.getDate() + 7); setFinSemana(d); }} disabled={semanaActual} className="btn-ghost px-2 py-1 disabled:opacity-40">Semana siguiente →</button>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="tbl min-w-[920px]">
          <thead>
            <tr><th>Apertura</th><th>Cierre</th><th>Usuario</th><th className="text-right">Fondo</th><th className="text-right">Efectivo</th><th className="text-right">Tarjeta</th><th className="text-right">Abonos</th><th className="text-right">Retiros</th><th className="text-right">Esperado</th><th className="text-right">Arqueo</th><th className="text-right">Dif.</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {cortes.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap text-xs">{new Date(c.abiertoEn).toLocaleString('es-MX')}</td>
                <td className="whitespace-nowrap text-xs">{c.cerradoEn ? new Date(c.cerradoEn).toLocaleString('es-MX') : '—'}</td>
                <td>{c.usuario?.nombre ?? '—'}</td>
                <td className="text-right">{money(c.fondoApertura)}</td>
                <td className="text-right">{money(c.calc?.efectivo)}</td>
                <td className="text-right">{money(c.calc?.tarjeta)}</td>
                <td className="text-right">{money(c.ingresos)}</td>
                <td className="text-right">{money(c.retiros)}</td>
                <td className="text-right font-medium">{money(c.calc?.esperadoEfectivo)}</td>
                <td className="text-right">{c.arqueo != null ? money(c.arqueo) : '—'}</td>
                <td className={`text-right font-semibold ${Number(c.diferencia) < 0 ? 'text-red-600' : Number(c.diferencia) > 0 ? 'text-amber-600' : 'text-slate-500'}`}>{c.diferencia != null ? money(c.diferencia) : '—'}</td>
                <td><span className={`pill ${c.cerradoEn ? 'pill-gray' : 'pill-green'}`}>{c.cerradoEn ? 'Cerrada' : 'Abierta'}</span></td>
              </tr>
            ))}
            {cortes.length === 0 && <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">Sin cortes en esta semana</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function Dato({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{k}</div>
      <div className={fuerte ? 'font-bold text-slate-900' : 'text-slate-700'}>{v}</div>
    </div>
  );
}
