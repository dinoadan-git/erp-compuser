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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <button onClick={() => { setShowForm(!showForm); setMsg(''); }} className="bg-primary-600 text-white rounded px-4 py-2 text-sm font-medium">
          {showForm ? 'Cancelar' : '+ Nuevo cliente'}
        </button>
      </div>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl shadow p-5 mb-6 text-sm">
          <div className="grid md:grid-cols-3 gap-3">
            <label className="block md:col-span-2">Nombre / Razón social
              <input className="w-full border rounded px-2 py-1" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            </label>
            <label className="block">Tipo
              <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className="w-full border rounded px-2 py-1">
                <option value="MOSTRADOR">Mostrador</option><option value="EMPRESA">Empresa</option><option value="GARANTIA_EPSON">Garantía EPSON</option>
              </select>
            </label>
            <label className="block">Teléfono
              <input className="w-full border rounded px-2 py-1" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} placeholder="Para búsqueda y avisos" />
            </label>
            <label className="block">Correo electrónico
              <input className="w-full border rounded px-2 py-1" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </label>
            <label className="block">Notas
              <input className="w-full border rounded px-2 py-1" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
            </label>
          </div>

          {/* Datos de facturación (opcional) */}
          <label className="flex items-center gap-2 mt-4 font-medium">
            <input type="checkbox" checked={f.facturar} onChange={(e) => setF({ ...f, facturar: e.target.checked })} />
            Requiere factura (CFDI)
          </label>
          {f.facturar && (
            <div className="grid md:grid-cols-2 gap-3 mt-3 p-3 bg-slate-50 rounded-lg">
              <label className="block">RFC
                <input className="w-full border rounded px-2 py-1" value={f.rfc} onChange={(e) => setF({ ...f, rfc: e.target.value.toUpperCase() })} />
              </label>
              <label className="block">Código postal (domicilio fiscal)
                <input className="w-full border rounded px-2 py-1" value={f.cpFiscal} onChange={(e) => setF({ ...f, cpFiscal: e.target.value })} placeholder="Ej. 68000" />
              </label>
              <label className="block">Régimen fiscal
                <input className="w-full border rounded px-2 py-1" value={f.regimenFiscal} onChange={(e) => setF({ ...f, regimenFiscal: e.target.value })} placeholder="Clave SAT: 601, 612, 626…" />
              </label>
              <label className="block">Uso del CFDI
                <input className="w-full border rounded px-2 py-1" value={f.usoCfdi} onChange={(e) => setF({ ...f, usoCfdi: e.target.value.toUpperCase() })} placeholder="Clave compatible con el régimen (G03, P01…)" />
              </label>
              <p className="md:col-span-2 text-xs text-slate-500">Estos datos deben coincidir con la Constancia de Situación Fiscal del cliente.</p>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button onClick={crear} className="bg-green-600 text-white rounded px-5 py-2 text-sm font-medium">Guardar cliente</button>
          </div>
        </div>
      )}

      <input className="border rounded px-3 py-2 text-sm mb-4 w-80" placeholder="Buscar por nombre, teléfono, correo o RFC..."
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Teléfono</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">RFC</th><th className="px-4 py-2">Saldo</th></tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{c.nombre}</td>
                <td className="px-4 py-2">{c.telefono ?? '-'}</td>
                <td className="px-4 py-2">{c.tipo}</td>
                <td className="px-4 py-2">{c.rfc ?? '-'}</td>
                <td className="px-4 py-2">${Number(c.saldo).toFixed(2)}</td>
              </tr>
            ))}
            {clientes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin clientes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
