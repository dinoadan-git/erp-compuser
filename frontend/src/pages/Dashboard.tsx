import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Dashboard() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  useEffect(() => { api.get('/ordenes').then((r) => setOrdenes(r.data)).catch(() => {}); }, []);

  const porEstatus = ordenes.reduce<Record<string, number>>((acc, o) => {
    acc[o.estatus] = (acc[o.estatus] ?? 0) + 1; return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card titulo="Ordenes activas" valor={ordenes.filter((o) => !['ENTREGADO','CANCELADO'].includes(o.estatus)).length} />
        <Card titulo="Entregadas" valor={porEstatus['ENTREGADO'] ?? 0} />
        <Card titulo="En reparacion" valor={porEstatus['EN_REPARACION'] ?? 0} />
        <Card titulo="Esperando autorizacion" valor={porEstatus['ESPERANDO_AUTORIZACION'] ?? 0} />
      </div>
    </div>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div className="text-3xl font-bold text-primary-700">{valor}</div>
    </div>
  );
}
