import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const vacio = { nombre: '', tipo: 'MOSTRADOR', rfc: '', regimenFiscal: '', notas: '' };
  const [f, setF] = useState<any>(vacio);

  const cargar = () => api.get('/clientes', { params: { q } }).then((r) => setClientes(r.data)).catch(() => {});
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [q]);

  async function crear() {
    if (!f.nombre.trim()) { setMsg('Escribe el nombre del cliente'); return; }
    try {
      await api.post('/clientes', { nombre: f.nombre, tipo: f.tipo, rfc: f.rfc || undefined, regimenFiscal: f.regimenFiscal || undefined, notas: f.notas || undefined });
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
        <div className="bg-white rounded-xl shadow p-5 mb-6 grid md:grid-cols-3 gap-3 text-sm">
          <label className="block md:col-span-2">Nombre / Razon social
            <input className="w-full border rounded px-2 py-1" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
          <label className="block">Tipo
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className="w-full border rounded px-2 py-1">
              <option value="MOSTRADOR">Mostrador</option><option value="EMPRESA">Empresa</option><option value="GARANTIA_EPSON">Garantia EPSON</option>
            </select>
          </label>
          <label className="block">RFC
            <input className="w-full border rounded px-2 py-1" value={f.rfc} onChange={(e) => setF({ ...f, rfc: e.target.value })} />
          </label>
          <label className="block">Regimen fiscal
            <input className="w-full border rounded px-2 py-1" value={f.regimenFiscal} onChange={(e) => setF({ ...f, regimenFiscal: e.target.value })} />
          </label>
          <label className="block">Notas
            <input className="w-full border rounded px-2 py-1" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
          </label>
          <div className="md:col-span-3 flex justify-end">
            <button onClick={crear} className="bg-green-600 text-white rounded px-5 py-2 text-sm font-medium">Guardar cliente</button>
          </div>
        </div>
      )}

      <input className="border rounded px-3 py-2 text-sm mb-4 w-72" placeholder="Buscar por nombre o RFC..."
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">RFC</th><th className="px-4 py-2">Saldo</th></tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{c.nombre}</td>
                <td className="px-4 py-2">{c.tipo}</td>
                <td className="px-4 py-2">{c.rfc ?? '-'}</td>
                <td className="px-4 py-2">${Number(c.saldo).toFixed(2)}</td>
              </tr>
            ))}
            {clientes.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin clientes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
