import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const ROLES = ['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'CAJERO', 'COMPRAS_ALMACEN'];
const TABS = ['Empresa', 'Usuarios', 'Plantillas', 'Folios', 'Auditoría'];

export default function Configuracion() {
  const [tab, setTab] = useState('Empresa');
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Configuración y seguridad</h1>
      <div className="flex gap-2 mb-4 border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Empresa' && <Empresa />}
      {tab === 'Usuarios' && <Usuarios />}
      {tab === 'Plantillas' && <Plantillas />}
      {tab === 'Folios' && <Folios />}
      {tab === 'Auditoría' && <Auditoria />}
    </div>
  );
}

function Empresa() {
  const [e, setE] = useState<any>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/config/empresa').then((r) => setE(r.data)); }, []);
  if (!e) return null;
  const set = (k: string, v: any) => setE({ ...e, [k]: v });
  async function guardar() { await api.put('/config/empresa', { nombre: e.nombre, rfc: e.rfc, regimenFiscal: e.regimenFiscal, cpFiscal: e.cpFiscal, direccion: e.direccion, telefono: e.telefono, email: e.email, diasAbandono: Number(e.diasAbandono) }); setMsg('Guardado'); }
  return (
    <div className="bg-white rounded-xl shadow p-4 max-w-xl space-y-2 text-sm">
      {msg && <div className="p-2 bg-green-50 text-green-700 rounded">{msg}</div>}
      {[['nombre', 'Nombre'], ['rfc', 'RFC'], ['regimenFiscal', 'Régimen fiscal'], ['cpFiscal', 'CP fiscal'], ['direccion', 'Dirección'], ['telefono', 'Teléfono'], ['email', 'Email']].map(([k, label]) => (
        <label key={k} className="block">{label}<input className="w-full border rounded px-2 py-1" value={e[k] ?? ''} onChange={(ev) => set(k, ev.target.value)} /></label>
      ))}
      <label className="block">Días para abandono<input type="number" className="w-full border rounded px-2 py-1" value={e.diasAbandono ?? 0} onChange={(ev) => set('diasAbandono', ev.target.value)} /></label>
      <button onClick={guardar} className="bg-primary-600 text-white rounded px-4 py-1">Guardar</button>
    </div>
  );
}

function Usuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [f, setF] = useState<any>({ nombre: '', email: '', password: '', pin: '', roles: ['RECEPCION'] });
  const [msg, setMsg] = useState('');
  const cargar = () => api.get('/config/usuarios').then((r) => setUsuarios(r.data)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  async function crear() {
    try { await api.post('/config/usuarios', { ...f, pin: f.pin || undefined }); setMsg('Usuario creado'); setF({ nombre: '', email: '', password: '', pin: '', roles: ['RECEPCION'] }); cargar(); }
    catch (err: any) { setMsg(err?.response?.data?.error ?? 'Error'); }
  }
  async function toggle(u: any) { await api.put(`/config/usuarios/${u.id}`, { activo: !u.activo }); cargar(); }
  function toggleRol(r: string) { setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x: string) => x !== r) : [...f.roles, r] }); }
  return (
    <div className="space-y-4">
      {msg && <div className="p-2 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}
      <div className="bg-white rounded-xl shadow p-4 text-sm grid md:grid-cols-5 gap-2 items-end">
        <input className="border rounded px-2 py-1" placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Contraseña" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="PIN (4 díg.)" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} />
        <button onClick={crear} className="bg-primary-600 text-white rounded px-3 py-1">Crear usuario</button>
        <div className="md:col-span-5 flex flex-wrap gap-3">
          {ROLES.map((r) => <label key={r} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.roles.includes(r)} onChange={() => toggleRol(r)} />{r}</label>)}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left"><tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Roles</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2"></th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2">{u.nombre}</td><td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2 text-xs">{u.roles.join(', ')}</td>
                <td className="px-4 py-2">{u.activo ? <span className="text-green-600">activo</span> : <span className="text-slate-400">inactivo</span>}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => toggle(u)} className="text-xs text-primary-600">{u.activo ? 'Desactivar' : 'Activar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Plantillas() {
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [f, setF] = useState<any>({ clave: '', canal: 'WHATSAPP', asunto: '', cuerpo: '' });
  const cargar = () => api.get('/config/plantillas').then((r) => setPlantillas(r.data)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  async function guardar() { if (!f.clave || !f.cuerpo) return; await api.post('/config/plantillas', f); setF({ clave: '', canal: 'WHATSAPP', asunto: '', cuerpo: '' }); cargar(); }
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4 text-sm space-y-2">
        <div className="grid md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" placeholder="Clave (ej. estatus.listo)" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} />
          <select className="border rounded px-2 py-1" value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option></select>
          <input className="border rounded px-2 py-1" placeholder="Asunto (email)" value={f.asunto} onChange={(e) => setF({ ...f, asunto: e.target.value })} />
        </div>
        <textarea className="w-full border rounded px-2 py-1" placeholder="Cuerpo. Usa variables como {cliente}, {folio}, {equipo}" value={f.cuerpo} onChange={(e) => setF({ ...f, cuerpo: e.target.value })} />
        <button onClick={guardar} className="bg-primary-600 text-white rounded px-4 py-1">Guardar plantilla</button>
      </div>
      <div className="bg-white rounded-xl shadow p-4 text-sm">
        {plantillas.map((p) => <div key={p.id} className="border-b py-2"><b>{p.clave}</b> <span className="text-xs text-slate-400">({p.canal})</span><div className="text-slate-600">{p.cuerpo}</div></div>)}
        {plantillas.length === 0 && <div className="text-slate-400">Sin plantillas</div>}
      </div>
    </div>
  );
}

function Folios() {
  const [folios, setFolios] = useState<any[]>([]);
  const cargar = () => api.get('/config/folios').then((r) => setFolios(r.data)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  async function editar(c: any) { const v = prompt(`Valor actual del folio ${c.clave}:`, String(c.valor)); if (v == null) return; await api.put(`/config/folios/${c.clave}`, { valor: Number(v) }); cargar(); }
  return (
    <div className="bg-white rounded-xl shadow p-4 text-sm max-w-md">
      <p className="text-slate-500 mb-2">Consecutivos por documento. Editar con cuidado.</p>
      {folios.map((c) => (
        <div key={c.clave} className="flex justify-between border-b py-2">
          <span>{c.clave}</span><span>#{c.valor} <button onClick={() => editar(c)} className="text-primary-600 text-xs ml-2">editar</button></span>
        </div>
      ))}
    </div>
  );
}

function Auditoria() {
  const [registros, setRegistros] = useState<any[]>([]);
  useEffect(() => { api.get('/config/auditoria').then((r) => setRegistros(r.data)).catch(() => {}); }, []);
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Usuario</th><th className="px-4 py-2">Acción</th><th className="px-4 py-2">Entidad</th></tr></thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.id} className="border-t"><td className="px-4 py-1 text-xs">{new Date(r.creadoEn).toLocaleString()}</td><td className="px-4 py-1">{r.usuario?.nombre ?? '-'}</td><td className="px-4 py-1">{r.accion}</td><td className="px-4 py-1">{r.entidad} {r.entidadId ?? ''}</td></tr>
          ))}
          {registros.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin registros</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
