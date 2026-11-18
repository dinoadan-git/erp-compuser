import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/clientes', { params: { q } }).then((r) => setClientes(r.data)).catch(() => {}); }, [q]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Clientes</h1>
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
