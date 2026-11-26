import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const CATEGORIAS = ['renta', 'luz', 'agua', 'internet', 'nomina', 'viaticos', 'papeleria', 'mantenimiento', 'otros'];
const CENTROS = [['TALLER', 'Taller'], ['MOSTRADOR', 'Mostrador'], ['PROYECTOS', 'Proyectos']];
const money = (n: any) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Quincena que contiene a hoy.
function quincenaActual() {
  const h = new Date(); const y = h.getFullYear(), m = h.getMonth();
  if (h.getDate() <= 15) return { desde: ymd(new Date(y, m, 1)), hasta: ymd(new Date(y, m, 15)) };
  return { desde: ymd(new Date(y, m, 16)), hasta: ymd(new Date(y, m + 1, 0)) };
}

export default function Gastos() {
  const [tab, setTab] = useState<'gastos' | 'nomina'>('gastos');
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Gastos y nómina</h1>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button onClick={() => setTab('gastos')} className={`rounded-md px-3 py-1 ${tab === 'gastos' ? 'bg-white font-medium shadow' : 'text-slate-500'}`}>Gastos</button>
          <button onClick={() => setTab('nomina')} className={`rounded-md px-3 py-1 ${tab === 'nomina' ? 'bg-white font-medium shadow' : 'text-slate-500'}`}>Nómina</button>
        </div>
      </div>
      {tab === 'gastos' ? <GastosTab /> : <NominaTab />}
    </div>
  );
}

function GastosTab() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [caja, setCaja] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const q0 = quincenaActual();
  const mesIni = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  // filtros
  const [f, setF] = useState({ categoria: '', centroCosto: '', desde: mesIni, hasta: q0.hasta, q: '' });

  // form gasto
  const vacio = { categoria: 'renta', centroCosto: 'TALLER', descripcion: '', monto: '', esCajaChica: false };
  const [g, setG] = useState<any>(vacio);

  const cargar = () => {
    const params: any = { desde: f.desde, hasta: f.hasta };
    if (f.categoria) params.categoria = f.categoria;
    if (f.centroCosto) params.centroCosto = f.centroCosto;
    if (f.q) params.q = f.q;
    api.get('/gastos', { params }).then((r) => setGastos(r.data)).catch(() => {});
    api.get('/gastos/resumen', { params: { desde: f.desde, hasta: f.hasta } }).then((r) => setResumen(r.data)).catch(() => {});
    api.get('/gastos/caja-chica').then((r) => setCaja(r.data)).catch(() => {});
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [f.categoria, f.centroCosto, f.desde, f.hasta]);

  async function crearGasto() {
    if (!g.descripcion || !g.monto) { setMsg('Captura descripción y monto'); return; }
    await api.post('/gastos', { categoria: g.categoria, centroCosto: g.centroCosto, descripcion: g.descripcion, monto: Number(g.monto), esCajaChica: g.esCajaChica });
    setG(vacio); setMsg('Gasto registrado'); cargar();
  }
  async function reponer() { const m = prompt('Monto a reponer a caja chica:'); if (!m) return; await api.post('/gastos/caja-chica/reposicion', { monto: Number(m), nota: 'Reposición' }); cargar(); }
  async function fijarFondo() { const v = prompt('Fondo fijo de caja chica:', caja?.caja?.fondo ?? '0'); if (v == null) return; await api.put('/gastos/caja-chica/fondo', { fondo: Number(v) }); cargar(); }

  const totalFiltrado = gastos.reduce((s, x) => s + Number(x.monto), 0);

  return (
    <div>
      {msg && <div className="mb-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 ring-1 ring-primary-100">{msg}</div>}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold text-slate-800">Nuevo gasto</h2>
          <select value={g.categoria} onChange={(e) => setG({ ...g, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select value={g.centroCosto} onChange={(e) => setG({ ...g, centroCosto: e.target.value })}>{CENTROS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input placeholder="Descripción" value={g.descripcion} onChange={(e) => setG({ ...g, descripcion: e.target.value })} />
          <input type="number" placeholder="Monto" value={g.monto} onChange={(e) => setG({ ...g, monto: e.target.value })} />
          <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked={g.esCajaChica} onChange={(e) => setG({ ...g, esCajaChica: e.target.checked })} /> Pagado de caja chica</label>
          <button onClick={crearGasto} className="btn-primary w-full">Registrar</button>
        </div>

        <div className="card text-sm">
          <h2 className="mb-2 font-semibold text-slate-800">Caja chica</h2>
          <div className="text-slate-500">Fondo: {money(caja?.caja?.fondo)}</div>
          <div className="text-2xl font-bold text-slate-900">{money(caja?.caja?.saldo)}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={reponer} className="btn-success px-3 py-1.5">Reponer</button>
            <button onClick={fijarFondo} className="btn-ghost px-3 py-1.5">Fijar fondo</button>
          </div>
          <div className="mt-2 text-xs text-slate-400">{caja?.reposiciones?.length ?? 0} reposiciones</div>
        </div>

        <div className="card text-sm">
          <h2 className="mb-2 font-semibold text-slate-800">Resumen del periodo</h2>
          <div className="text-2xl font-bold text-slate-900">{money(resumen?.total)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(resumen?.porCategoria ?? []).map((c: any) => <span key={c.categoria} className="pill pill-gray">{c.categoria}: {money(c.total)}</span>)}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="block"><span className="lbl">Categoría</span>
            <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}><option value="">Todas</option>{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </label>
          <label className="block"><span className="lbl">Centro de costo</span>
            <select value={f.centroCosto} onChange={(e) => setF({ ...f, centroCosto: e.target.value })}><option value="">Todos</option>{CENTROS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="block"><span className="lbl">Desde</span><input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
          <label className="block"><span className="lbl">Hasta</span><input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
          <label className="block"><span className="lbl">Descripción</span>
            <div className="flex gap-1">
              <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && cargar()} placeholder="Buscar…" />
              <button onClick={cargar} className="btn-ghost whitespace-nowrap px-3">Buscar</button>
            </div>
          </label>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Centro</th><th>Descripción</th><th className="text-right">Monto</th></tr></thead>
          <tbody>
            {gastos.map((x) => (
              <tr key={x.id}>
                <td className="whitespace-nowrap text-xs">{new Date(x.fecha).toLocaleDateString('es-MX')}</td>
                <td><span className="pill pill-gray">{x.categoria}{x.esCajaChica ? ' · CC' : ''}</span></td>
                <td className="text-xs">{x.centroCosto}</td>
                <td>{x.descripcion}</td>
                <td className="text-right font-medium">{money(x.monto)}</td>
              </tr>
            ))}
            {gastos.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin gastos en el filtro</td></tr>}
          </tbody>
          {gastos.length > 0 && (
            <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td className="px-4 py-2" colSpan={4}>Total ({gastos.length} gasto(s))</td>
              <td className="px-4 py-2 text-right text-primary-700">{money(totalFiltrado)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function NominaTab() {
  const q0 = quincenaActual();
  const [desde, setDesde] = useState(q0.desde);
  const [hasta, setHasta] = useState(q0.hasta);
  const [pct, setPct] = useState('0');
  const [nomina, setNomina] = useState<any>(null);
  const [msg, setMsg] = useState('');

  // Cargar el porcentaje global configurado al entrar.
  useEffect(() => { api.get('/gastos/nomina/config').then((r) => setPct(String(r.data.porcentaje ?? 0))).catch(() => {}); }, []);

  async function calcular() {
    const { data } = await api.get('/gastos/nomina/calcular', { params: { desde, hasta, porcentaje: Number(pct) } });
    setNomina(data); setMsg('');
  }
  async function guardarPct() {
    await api.put('/gastos/nomina/config', { porcentaje: Number(pct) });
    setMsg(`Porcentaje global guardado: ${pct}%`); if (nomina) calcular();
  }
  async function registrar() {
    if (!nomina) return;
    await api.post('/gastos/nomina', { desde, hasta, porcentaje: Number(pct), descripcion: `Nómina quincena ${desde} a ${hasta} (${pct}%)` });
    setMsg('Nómina registrada como gasto'); setNomina(null);
  }

  function setQuincena(cual: 1 | 2) {
    const h = new Date(); const y = h.getFullYear(), m = h.getMonth();
    if (cual === 1) { setDesde(ymd(new Date(y, m, 1))); setHasta(ymd(new Date(y, m, 15))); }
    else { setDesde(ymd(new Date(y, m, 16))); setHasta(ymd(new Date(y, m + 1, 0))); }
    setNomina(null);
  }

  return (
    <div>
      {msg && <div className="mb-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 ring-1 ring-primary-100">{msg}</div>}

      <div className="card mb-4">
        <h2 className="font-semibold text-slate-800">Cálculo de nómina quincenal</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">
          Comisión sobre el <b>servicio</b> de las órdenes <b>cobradas</b> en el periodo: mano de obra + diagnóstico.
          <b> No</b> incluye refacciones ni insumos del inventario.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="lbl">Desde</span><input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setNomina(null); }} /></label>
          <label className="block"><span className="lbl">Hasta</span><input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setNomina(null); }} /></label>
          <div className="flex gap-1">
            <button onClick={() => setQuincena(1)} className="btn-ghost px-3 py-1.5 text-xs">1ª quincena</button>
            <button onClick={() => setQuincena(2)} className="btn-ghost px-3 py-1.5 text-xs">2ª quincena</button>
          </div>
          <label className="block"><span className="lbl">% comisión (global)</span>
            <div className="flex items-center gap-1">
              <input type="number" min={0} max={100} step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} className="w-24" />
              <span className="text-slate-500">%</span>
              <button onClick={guardarPct} className="btn-ghost whitespace-nowrap px-2 py-1.5 text-xs" title="Guardar como predeterminado">Guardar %</button>
            </div>
          </label>
          <button onClick={calcular} className="btn-primary">Previsualizar</button>
        </div>
      </div>

      {nomina && (<>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Tile k="Base de servicio" v={money(nomina.base)} sub={`${nomina.ordenesCobradas} orden(es) cobrada(s)`} />
          <Tile k={`Nómina a pagar (${nomina.porcentaje}%)`} v={money(nomina.nomina)} fuerte />
          <Tile k="Técnicos" v={String(nomina.porTecnico.length)} sub="con órdenes en el periodo" />
        </div>

        <div className="card mb-4 p-0 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3"><h3 className="font-semibold text-slate-800">Por técnico</h3></div>
          <table className="tbl">
            <thead><tr><th>Técnico</th><th className="text-right">Órdenes</th><th className="text-right">Base de servicio</th><th className="text-right">Pago ({nomina.porcentaje}%)</th></tr></thead>
            <tbody>
              {nomina.porTecnico.map((t: any) => (
                <tr key={t.tecnicoId ?? 't0'}>
                  <td className="font-medium text-slate-800">{t.nombre}</td>
                  <td className="text-right">{t.ordenes}</td>
                  <td className="text-right">{money(t.baseServicio)}</td>
                  <td className="text-right font-semibold text-primary-700">{money(t.pago)}</td>
                </tr>
              ))}
              {nomina.porTecnico.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sin órdenes cobradas en el periodo</td></tr>}
            </tbody>
          </table>
        </div>

        {nomina.detalle.length > 0 && (
          <details className="card mb-4">
            <summary className="cursor-pointer font-semibold text-slate-800">Detalle de órdenes ({nomina.detalle.length})</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="tbl min-w-[560px]">
                <thead><tr><th>Ticket</th><th>Orden</th><th>Fecha cobro</th><th>Técnico</th><th className="text-right">Servicio</th></tr></thead>
                <tbody>
                  {nomina.detalle.map((d: any, i: number) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{d.ventaFolio}</td>
                      <td className="font-mono text-xs">{d.ordenFolio}</td>
                      <td className="text-xs">{new Date(d.fecha).toLocaleDateString('es-MX')}</td>
                      <td>{d.tecnico}</td>
                      <td className="text-right">{money(d.servicio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <button onClick={registrar} className="btn-success">Registrar nómina como gasto</button>
      </>)}
    </div>
  );
}

function Tile({ k, v, sub, fuerte }: { k: string; v: string; sub?: string; fuerte?: boolean }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-400">{k}</div>
      <div className={`${fuerte ? 'text-3xl text-primary-700' : 'text-2xl text-slate-900'} font-bold`}>{v}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
