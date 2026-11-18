import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Logo } from '../components/Logo';

const ESTATUS_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido', EN_DIAGNOSTICO: 'En diagnostico', ESPERANDO_AUTORIZACION: 'Esperando autorizacion',
  EN_TRAMITE_GARANTIA_EPSON: 'Tramite garantia EPSON', ESPERANDO_REFACCION: 'Esperando refaccion',
  EN_REPARACION: 'En reparacion', EN_PRUEBAS_CALIDAD: 'En pruebas de calidad',
  LISTO_ENTREGA_REPARADO: 'Listo para entrega (reparado)', LISTO_ENTREGA_SIN_REPARAR: 'Listo para entrega (sin reparar)',
  ENTREGADO: 'Entregado', ABANDONO: 'Abandono', CANCELADO: 'Cancelado',
};

// Consulta publica de estatus (sin login) por folio o token (QR).
export default function Portal() {
  const [folio, setFolio] = useState('');
  const [orden, setOrden] = useState<any>(null);
  const [error, setError] = useState('');

  async function buscar(params: { folio?: string; token?: string }) {
    setError(''); setOrden(null);
    try { const { data } = await api.get('/portal/estatus', { params }); setOrden(data); }
    catch { setError('Orden no encontrada'); }
  }

  // Al abrir con ?token= o ?folio= (p. ej. desde el QR), consulta automatico.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const token = qs.get('token'); const f = qs.get('folio');
    if (token) buscar({ token });
    else if (f) { setFolio(f); buscar({ folio: f }); }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pt-16 px-4">
      <div className="mb-2"><Logo size={48} /></div>
      <h1 className="text-xl font-bold mb-1">Estatus de tu equipo</h1>
      <p className="text-slate-500 mb-6 text-sm">Centro de Servicio Autorizado EPSON · Canon</p>
      <form onSubmit={(e) => { e.preventDefault(); buscar({ folio }); }} className="flex gap-2 mb-6">
        <input className="border rounded px-3 py-2 text-sm w-56" placeholder="Folio (ej. OT-000001)"
          value={folio} onChange={(e) => setFolio(e.target.value)} />
        <button className="bg-primary-600 text-white rounded px-4 text-sm">Consultar</button>
      </form>
      {error && <p className="text-red-600">{error}</p>}
      {orden && (
        <div className="bg-white rounded-xl shadow p-6 w-full max-w-md">
          <div className="font-mono text-lg">{orden.folio}</div>
          <div className="text-slate-600">{orden.equipo?.tipo} {orden.equipo?.marca} {orden.equipo?.modelo}</div>
          <div className="mt-2 inline-block px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
            {ESTATUS_LABEL[orden.estatus] ?? orden.estatus}
          </div>
          <ol className="mt-4 border-l-2 border-primary-200 pl-4 space-y-3">
            {orden.bitacora?.map((b: any, i: number) => (
              <li key={i}>
                <div className="font-medium text-sm">{ESTATUS_LABEL[b.estatus] ?? b.estatus}</div>
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
