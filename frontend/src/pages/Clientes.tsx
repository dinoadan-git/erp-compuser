import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [showNC, setShowNC] = useState(false);
  const vacio = { nombre: '', tipo: 'MOSTRADOR', telefono: '', email: '', notas: '', facturar: false, cpFiscal: '', rfc: '', regimenFiscal: '', usoCfdi: '' };
  const [f, setF] = useState<any>(vacio);

  const cargar = () => api.get('/clientes', { params: { q } }).then((r) => setClientes(r.data)).catch(() => {});
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [q]);

  async function crear() {
    if (!f.nombre.trim()) { setMsg('Escribe el nombre del cliente'); return; }
    if (f.facturar && (!f.rfc || !f.cpFiscal || !f.regimenFiscal || !f.usoCfdi)) {
      setMsg('Para facturación: RFC, código postal, régimen fiscal y uso de CFDI son obligatorios'); return;
    }
    try {
      await api.post('/clientes', {
        nombre: f.nombre, tipo: f.tipo,
        telefono: f.telefono || undefined, email: f.email || undefined, notas: f.notas || undefined,
        ...(f.facturar ? { rfc: f.rfc, cpFiscal: f.cpFiscal, regimenFiscal: f.regimenFiscal, usoCfdi: f.usoCfdi } : {}),
      });
      setMsg(`Cliente "${f.nombre}" creado`); setF(vacio); setShowForm(false); cargar();
    } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error al crear el cliente'); }
  }

  const tipoPill = (t: string) =>
    t === 'EMPRESA' ? 'pill pill-blue' : t === 'GARANTIA_EPSON' ? 'pill pill-amber' : 'pill pill-gray';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-slate-500">Administra tu directorio de clientes y datos de facturación.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowNC(!showNC); setMsg(''); }} className="btn-ghost">Notas de crédito</button>
          <button onClick={() => { setShowForm(!showForm); setMsg(''); }} className={showForm ? 'btn-ghost' : 'btn-primary'}>
            {showForm ? 'Cancelar' : (<><span className="text-base leading-none">+</span> Nuevo cliente</>)}
          </button>
        </div>
      </div>

      {showNC && <NotasCredito onDone={cargar} />}

      {msg && <div className="mb-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 ring-1 ring-primary-100">{msg}</div>}

      {showForm && (
        <div className="card mb-6">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block md:col-span-2"><span className="lbl">Nombre / Razón social</span>
              <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            </label>
            <label className="block"><span className="lbl">Tipo</span>
              <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                <option value="MOSTRADOR">Mostrador</option><option value="EMPRESA">Empresa</option><option value="GARANTIA_EPSON">Garantía EPSON</option>
              </select>
            </label>
            <label className="block"><span className="lbl">Teléfono</span>
              <input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} placeholder="Para búsqueda y avisos" />
            </label>
            <label className="block"><span className="lbl">Correo electrónico</span>
              <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </label>
            <label className="block"><span className="lbl">Notas</span>
              <input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
            </label>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={f.facturar} onChange={(e) => setF({ ...f, facturar: e.target.checked })} />
            Requiere factura (CFDI)
          </label>
          {f.facturar && (
            <div className="mt-3 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2 ring-1 ring-slate-100">
              <label className="block"><span className="lbl">RFC</span>
                <input value={f.rfc} onChange={(e) => setF({ ...f, rfc: e.target.value.toUpperCase() })} />
              </label>
              <label className="block"><span className="lbl">Código postal (domicilio fiscal)</span>
                <input value={f.cpFiscal} onChange={(e) => setF({ ...f, cpFiscal: e.target.value })} placeholder="Ej. 68000" />
              </label>
              <label className="block"><span className="lbl">Régimen fiscal</span>
                <input value={f.regimenFiscal} onChange={(e) => setF({ ...f, regimenFiscal: e.target.value })} placeholder="Clave SAT: 601, 612, 626…" />
              </label>
              <label className="block"><span className="lbl">Uso del CFDI</span>
                <input value={f.usoCfdi} onChange={(e) => setF({ ...f, usoCfdi: e.target.value.toUpperCase() })} placeholder="Clave compatible con el régimen (G03, P01…)" />
              </label>
              <p className="text-xs text-slate-500 md:col-span-2">Estos datos deben coincidir con la Constancia de Situación Fiscal del cliente.</p>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button onClick={crear} className="btn-success">Guardar cliente</button>
          </div>
        </div>
      )}

      <div className="mb-4 relative max-w-md">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a1 1 0 01-1.42 1.42l-3.08-3.08A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input style={{ paddingLeft: '2.5rem' }} placeholder="Buscar por nombre, teléfono, correo o RFC..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr><th>Nombre</th><th>Teléfono</th><th>Tipo</th><th>RFC</th><th className="text-right">Saldo</th></tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td className="font-medium text-slate-800">{c.nombre}</td>
                <td>{c.telefono ?? '—'}</td>
                <td><span className={tipoPill(c.tipo)}>{c.tipo === 'GARANTIA_EPSON' ? 'Garantía EPSON' : c.tipo.charAt(0) + c.tipo.slice(1).toLowerCase()}</span></td>
                <td>{c.rfc ?? '—'}</td>
                <td className={`text-right font-semibold ${Number(c.saldo) > 0 ? 'text-orange-600' : 'text-slate-500'}`}>${Number(c.saldo).toFixed(2)}</td>
              </tr>
            ))}
            {clientes.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin clientes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Bloque de Notas de Crédito: a partir del folio de una venta, genera la nota
// con dos destinos del valor devuelto: regresar a stock, o abonar al saldo del
// cliente (para aplicar a un servicio o descontar de su estado de cuenta).
function NotasCredito({ onDone }: { onDone: () => void }) {
  const [folio, setFolio] = useState('');
  const [venta, setVenta] = useState<any>(null);
  const [modo, setModo] = useState<'STOCK' | 'SALDO'>('STOCK');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function buscar() {
    setVenta(null); setMsg('');
    if (!folio.trim()) { setMsg('Captura el folio de la venta a devolver.'); return; }
    try {
      const { data } = await api.get('/ventas', { params: { folio: folio.trim() } });
      const v = (data as any[]).find((x) => x.folio?.toLowerCase() === folio.trim().toLowerCase()) || data[0];
      if (!v) { setMsg(`No se encontró la venta ${folio}.`); return; }
      const { data: full } = await api.get(`/ventas/${v.id}`);
      setVenta(full);
      if (!full.clienteId) setModo('STOCK');
    } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error al buscar la venta'); }
  }

  async function generar() {
    if (!venta || busy) return;
    setBusy(true); setMsg('');
    try {
      const { data } = await api.post(`/ventas/${venta.id}/devolucion`, { modo, motivo: motivo || undefined });
      setMsg(modo === 'STOCK'
        ? `Nota de crédito ${data.folio} generada. Productos reingresados a stock.`
        : `Nota de crédito ${data.folio} generada. Se abonó ${Math.abs(Number(data.total)).toFixed(2)} al saldo del cliente.`);
      setVenta(null); setFolio(''); setMotivo(''); onDone();
    } catch (e: any) { setMsg(e?.response?.data?.error ?? 'Error al generar la nota de crédito'); }
    finally { setBusy(false); }
  }

  return (
    <div className="card mb-6">
      <h2 className="mb-1 font-semibold text-slate-800">Notas de crédito</h2>
      <p className="mb-3 text-xs text-slate-500">Captura el folio de la venta a devolver y elige el destino del valor: regresar a inventario o abonar al saldo del cliente.</p>
      {msg && <div className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">{msg}</div>}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block"><span className="lbl">Folio de la venta</span>
          <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="TK-000123 / FA-000045" className="w-56" onKeyDown={(e) => e.key === 'Enter' && buscar()} />
        </label>
        <button onClick={buscar} className="btn-ghost">Buscar venta</button>
      </div>

      {venta && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <div>
              <div className="font-semibold text-slate-800">{venta.folio} · {venta.tipo}</div>
              <div className="text-xs text-slate-500">
                {new Date(venta.creadoEn).toLocaleString('es-MX')} · Cliente: {venta.cliente?.nombre ?? 'Mostrador (sin cliente)'}
              </div>
            </div>
            <div className="text-right"><div className="text-xs text-slate-500">Total</div><div className="text-lg font-bold text-slate-900">${Number(venta.total).toFixed(2)}</div></div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${modo === 'STOCK' ? 'border-primary-400 bg-primary-50' : 'border-slate-200'}`}>
              <input type="radio" className="mt-0.5" checked={modo === 'STOCK'} onChange={() => setModo('STOCK')} />
              <span><span className="font-medium text-slate-800">Regresar a stock</span><br /><span className="text-xs text-slate-500">Reingresa los productos al inventario.</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${modo === 'SALDO' ? 'border-primary-400 bg-primary-50' : 'border-slate-200'} ${!venta.clienteId ? 'opacity-50' : ''}`}>
              <input type="radio" className="mt-0.5" checked={modo === 'SALDO'} disabled={!venta.clienteId} onChange={() => setModo('SALDO')} />
              <span><span className="font-medium text-slate-800">Abonar al saldo del cliente</span><br /><span className="text-xs text-slate-500">{venta.clienteId ? 'Saldo a favor para aplicar a un servicio o descontar de su estado de cuenta.' : 'Requiere que la venta tenga cliente.'}</span></span>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <label className="block flex-1 min-w-[12rem]"><span className="lbl">Motivo (opcional)</span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. producto defectuoso" />
            </label>
            <button onClick={generar} disabled={busy} className="btn-danger disabled:opacity-50">{busy ? 'Generando…' : 'Generar nota de crédito'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
