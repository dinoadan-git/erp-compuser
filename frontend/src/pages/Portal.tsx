import { useState } from 'react';
import { api } from '../lib/api';

// Consulta publica de estatus (sin login) por folio o token QR.
export default function Portal() {
  const [folio, setFolio] = useState('');
  const [orden, setOrden] = useState<any>(null);
  const [error, setError] = useState('');

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setOrden(null);
    try { const { data } = await api.get('/portal/estatus', { params: { folio } }); setOrden(data); }
    catch { setError('Orden no encontrada'); }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pt-16 px-4">
      <h1 className="text-2xl font-bold mb-2">Estatus de tu equipo</h1>
      <p className="text-slate-500 mb-6 text-sm">Centro de Servicio Autorizado EPSON</p>
      <form onSubmit={consultar} className="flex gap-2 mb-6">
        <input className="border rounded px-3 py-2 text-sm w-56" placeholder="Folio (ej. OT-000001)"
          value={folio} onChange={(e) => setFolio(e.target.value)} />
        <button className="bg-primary-600 text-white rounded px-4 text-sm">Consultar</button>
      </form>
      {error && <p className="text-red-600">{error}</p>}
      {orden && (
        <div className="bg-white rounded-xl shadow p-6 w-full max-w-md">
          <div className="font-mono text-lg">{orden.folio}</div>
          <div className="text-slate-600">{orden.equipo?.tipo} {orden.equipo?.marca} {orden.equipo?.modelo}</div>
          <ol className="mt-4 border-l-2 border-primary-200 pl-4 space-y-3">
            {orden.bitacora?.map((b: any, i: number) => (
              <li key={i}>
                <div className="font-medium text-sm">{b.estatus}</div>
                {b.nota && <div className="text-xs text-slate-500">{b.nota}</div>}
                <div className="text-xs text-slate-400">{new Date(b.creadoEn).toLocaleString()}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
