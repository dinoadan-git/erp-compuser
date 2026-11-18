import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const ESTATUS_LABEL: Record<string, string> = {
  RECIBIDO: 'Recibido', EN_DIAGNOSTICO: 'En diagnostico', ESPERANDO_AUTORIZACION: 'Esperando autorizacion',
  EN_TRAMITE_GARANTIA_EPSON: 'Tramite garantia EPSON', ESPERANDO_REFACCION: 'Esperando refaccion',
  EN_REPARACION: 'En reparacion', EN_PRUEBAS_CALIDAD: 'En pruebas de calidad',
  LISTO_ENTREGA_REPARADO: 'Listo (reparado)', LISTO_ENTREGA_SIN_REPARAR: 'Listo (sin reparar)',
  ENTREGADO: 'Entregado', ABANDONO: 'Abandono', CANCELADO: 'Cancelado',
};

const TIPOS_EQUIPO = ['Impresora', 'Multifuncional', 'Laptop', 'Computadora de Escritorio', 'Proyector', 'Otro'];

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');

  const vacio = {
    clienteId: '', nuevoCliente: false, clienteNombre: '', clienteTipo: 'MOSTRADOR',
    equipoId: '', nuevoEquipo: true, eqTipo: 'Impresora', eqMarca: '', eqModelo: '', eqSerie: '',
    falla: '', estadoFisico: '', tipoGarantia: 'NINGUNA', tecnicoId: '',
  };
  const [f, setF] = useState<any>(vacio);

  const cargar = () => api.get('/ordenes').then((r) => setOrdenes(r.data)).catch(() => {});
  useEffect(() => {
    cargar();
    api.get('/clientes').then((r) => setClientes(r.data)).catch(() => {});
    api.get('/ordenes/tecnicos').then((r) => setTecnicos(r.data)).catch(() => {});
  }, []);

  // Al elegir un cliente existente, cargar sus equipos.
  useEffect(() => {
    if (f.clienteId && !f.nuevoCliente) {
      api.get(`/clientes/${f.clienteId}`).then((r) => {
        setEquipos(r.data.equipos || []);
        setF((p: any) => ({ ...p, nuevoEquipo: (r.data.equipos || []).length === 0 }));
      }).catch(() => setEquipos([]));
    } else { setEquipos([]); }
    // eslint-disable-next-line
  }, [f.clienteId, f.nuevoCliente]);

  async function guardar() {
    try {
      // 1) Cliente (existente o nuevo)
      let clienteId = Number(f.clienteId);
      if (f.nuevoCliente) {
        if (!f.clienteNombre.trim()) { setMsg('Escribe el nombre del cliente'); return; }
        const { data } = await api.post('/clientes', { nombre: f.clienteNombre, tipo: f.clienteTipo });
        clienteId = data.id;
      }
      if (!clienteId) { setMsg('Selecciona o crea un cliente'); return; }

      // 2) Equipo (existente o nuevo)
      let equipoId = Number(f.equipoId);
      if (f.nuevoEquipo || !equipoId) {
        const { data } = await api.post('/equipos', {
          clienteId, tipo: f.eqTipo, marca: f.eqMarca || undefined,
          modelo: f.eqModelo || undefined, numeroSerie: f.eqSerie || undefined,
        });
        equipoId = data.id;
      }

      // 3) Orden
      if (!f.falla.trim()) { setMsg('Describe la falla reportada'); return; }
      const { data: orden } = await api.post('/ordenes', {
        clienteId, equipoId, fallaReportada: f.falla, estadoFisico: f.estadoFisico || undefined,
        tipoGarantia: f.tipoGarantia, tecnicoId: f.tecnicoId ? Number(f.tecnicoId) : undefined,
      });
      setMsg(`Orden ${orden.folio} creada`);
      setF(vacio); setShowForm(false);
      cargar();
      api.get('/clientes').then((r) => setClientes(r.data));
    } catch (e: any) {
      setMsg(e?.response?.data?.error ?? 'Error al crear la orden');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Ordenes de trabajo</h1>
        <button onClick={() => { setShowForm(!showForm); setMsg(''); }} className="bg-primary-600 text-white rounded px-4 py-2 text-sm font-medium">
          {showForm ? 'Cancelar' : '+ Nueva orden'}
        </button>
      </div>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <h2 className="font-semibold mb-3">Recepcion de equipo</h2>
          <div className="grid md:grid-cols-2 gap-5 text-sm">
            {/* Cliente */}
            <div>
              <div className="font-medium mb-1">Cliente</div>
              {!f.nuevoCliente ? (
                <>
                  <select value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value, equipoId: '' })} className="w-full border rounded px-2 py-1">
                    <option value="">Selecciona un cliente...</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <button onClick={() => setF({ ...f, nuevoCliente: true, clienteId: '' })} className="text-primary-600 text-xs mt-1">+ Cliente nuevo</button>
                </>
              ) : (
                <div className="space-y-1">
                  <input className="w-full border rounded px-2 py-1" placeholder="Nombre del cliente" value={f.clienteNombre} onChange={(e) => setF({ ...f, clienteNombre: e.target.value })} />
                  <select value={f.clienteTipo} onChange={(e) => setF({ ...f, clienteTipo: e.target.value })} className="w-full border rounded px-2 py-1">
                    <option value="MOSTRADOR">Mostrador</option><option value="EMPRESA">Empresa</option><option value="GARANTIA_EPSON">Garantia EPSON</option>
                  </select>
                  <button onClick={() => setF({ ...f, nuevoCliente: false })} className="text-slate-500 text-xs">usar cliente existente</button>
                </div>
              )}
            </div>

            {/* Equipo */}
            <div>
              <div className="font-medium mb-1">Equipo</div>
              {!f.nuevoEquipo && equipos.length > 0 ? (
                <>
                  <select value={f.equipoId} onChange={(e) => setF({ ...f, equipoId: e.target.value })} className="w-full border rounded px-2 py-1">
                    <option value="">Selecciona un equipo...</option>
                    {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.tipo} {eq.marca} {eq.modelo} ({eq.numeroSerie || 's/n'})</option>)}
                  </select>
                  <button onClick={() => setF({ ...f, nuevoEquipo: true, equipoId: '' })} className="text-primary-600 text-xs mt-1">+ Equipo nuevo</button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  <select value={f.eqTipo} onChange={(e) => setF({ ...f, eqTipo: e.target.value })} className="border rounded px-2 py-1">
                    {TIPOS_EQUIPO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="border rounded px-2 py-1" placeholder="Marca" value={f.eqMarca} onChange={(e) => setF({ ...f, eqMarca: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Modelo" value={f.eqModelo} onChange={(e) => setF({ ...f, eqModelo: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="No. de serie" value={f.eqSerie} onChange={(e) => setF({ ...f, eqSerie: e.target.value })} />
                  {equipos.length > 0 && <button onClick={() => setF({ ...f, nuevoEquipo: false })} className="text-slate-500 text-xs col-span-2 text-left">usar equipo existente</button>}
                </div>
              )}
            </div>

            {/* Falla y detalles */}
            <div className="md:col-span-2">
              <div className="font-medium mb-1">Falla reportada</div>
              <textarea className="w-full border rounded px-2 py-1" rows={2} placeholder="Describe la falla que reporta el cliente" value={f.falla} onChange={(e) => setF({ ...f, falla: e.target.value })} />
            </div>
            <div>
              <div className="font-medium mb-1">Estado fisico / accesorios</div>
              <input className="w-full border rounded px-2 py-1" placeholder="Ej. con cable, sin tapa, rayones" value={f.estadoFisico} onChange={(e) => setF({ ...f, estadoFisico: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="font-medium mb-1">Garantia</div>
                <select value={f.tipoGarantia} onChange={(e) => setF({ ...f, tipoGarantia: e.target.value })} className="w-full border rounded px-2 py-1">
                  <option value="NINGUNA">Ninguna</option><option value="EPSON">EPSON</option><option value="TALLER">Taller</option>
                </select>
              </div>
              <div>
                <div className="font-medium mb-1">Tecnico</div>
                <select value={f.tecnicoId} onChange={(e) => setF({ ...f, tecnicoId: e.target.value })} className="w-full border rounded px-2 py-1">
                  <option value="">Sin asignar</option>
                  {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={guardar} className="bg-green-600 text-white rounded px-5 py-2 text-sm font-medium">Recibir y crear orden</button>
          </div>
        </div>
      )}

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
