import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const ESTATUS_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido', EN_DIAGNOSTICO: 'En diagnostico', ESPERANDO_AUTORIZACION: 'Esperando autorizacion',
  EN_TRAMITE_GARANTIA_EPSON: 'Tramite garantia EPSON', ESPERANDO_REFACCION: 'Esperando refaccion',
  EN_REPARACION: 'En reparacion', EN_PRUEBAS_CALIDAD: 'En pruebas de calidad',
  LISTO_ENTREGA_REPARADO: 'Listo (reparado)', LISTO_ENTREGA_SIN_REPARAR: 'Listo (sin reparar)',
  ENTREGADO: 'Entregado', ABANDONO: 'Abandono', CANCELADO: 'Cancelado',
};

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  useEffect(() => { api.get('/ordenes').then((r) => setOrdenes(r.data)).catch(() => {}); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Ordenes de trabajo</h1>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr><th className="px-4 py-2">Folio</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Equipo</th><th className="px-4 py-2">Tecnico</th><th className="px-4 py-2">Estatus</th></tr>
          </thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2 font-mono">{o.folio}</td>
                <td className="px-4 py-2">{o.cliente?.nombre}</td>
                <td className="px-4 py-2">{o.equipo?.marca} {o.equipo?.modelo}</td>
                <td className="px-4 py-2">{o.tecnico?.nombre ?? 'Sin asignar'}</td>
                <td className="px-4 py-2"><span className="px-2 py-1 rounded bg-primary-50 text-primary-700 text-xs">{ESTATUS_LABEL[o.estatus] ?? o.estatus}</span></td>
              </tr>
            ))}
            {ordenes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin ordenes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
