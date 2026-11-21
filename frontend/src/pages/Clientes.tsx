import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
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
        <button onClick={() => { setShowForm(!showForm); setMsg(''); }} className={showForm ? 'btn-ghost' : 'btn-primary'}>
          {showForm ? 'Cancelar' : (<><span className="text-base leading-none">+</span> Nuevo cliente</>)}
        </button>
      </div>

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
