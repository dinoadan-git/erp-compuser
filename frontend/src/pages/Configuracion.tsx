import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const ROLES = ['ADMINISTRADOR', 'RECEPCION', 'TECNICO', 'CAJERO', 'COMPRAS_ALMACEN'];
const TABS = ['Empresa', 'Usuarios', 'Plantillas', 'WhatsApp', 'Folios', 'Auditoría'];

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
      {tab === 'WhatsApp' && <WhatsAppHsm />}
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
  async function guardar() {
    await api.put('/config/empresa', {
      nombre: e.nombre, rfc: e.rfc, regimenFiscal: e.regimenFiscal, cpFiscal: e.cpFiscal,
      direccion: e.direccion, telefono: e.telefono, telefono2: e.telefono2, whatsapp: e.whatsapp,
      email: e.email, sitioWeb: e.sitioWeb, facebook: e.facebook, instagram: e.instagram,
      diasAbandono: Number(e.diasAbandono),
    });
    setMsg('Guardado');
  }
  const campos: [string, string][] = [
    ['nombre', 'Nombre'], ['rfc', 'RFC'], ['regimenFiscal', 'Régimen fiscal'], ['cpFiscal', 'CP fiscal'],
    ['direccion', 'Dirección / domicilio'], ['telefono', 'Teléfono'], ['telefono2', 'Teléfono 2'],
    ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['sitioWeb', 'Sitio web'],
    ['facebook', 'Facebook'], ['instagram', 'Instagram'],
  ];
  return (
    <div className="card max-w-2xl text-sm">
      {msg && <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{msg}</div>}
      <p className="mb-3 text-xs text-slate-500">Estos datos aparecen en el encabezado de los tickets y comprobantes.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {campos.map(([k, label]) => (
          <label key={k} className="block"><span className="lbl">{label}</span>
            <input value={e[k] ?? ''} onChange={(ev) => set(k, ev.target.value)} />
          </label>
        ))}
        <label className="block"><span className="lbl">Días para abandono</span>
          <input type="number" value={e.diasAbandono ?? 0} onChange={(ev) => set('diasAbandono', ev.target.value)} />
        </label>
      </div>
      <button onClick={guardar} className="btn-primary mt-4">Guardar</button>
    </div>
  );
}

function Usuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [f, setF] = useState<any>({ nombre: '', email: '', password: '', pin: '', roles: ['RECEPCION'] });
  const [edit, setEdit] = useState<any>(null); // usuario en edicion
  const [msg, setMsg] = useState('');
  const cargar = () => api.get('/config/usuarios').then((r) => setUsuarios(r.data)).catch(() => {});
  useEffect(() => { cargar(); }, []);
  async function crear() {
    try { await api.post('/config/usuarios', { ...f, pin: f.pin || undefined }); setMsg('Usuario creado'); setF({ nombre: '', email: '', password: '', pin: '', roles: ['RECEPCION'] }); cargar(); }
    catch (err: any) { setMsg(err?.response?.data?.error ?? 'Error'); }
  }
  async function toggle(u: any) { await api.put(`/config/usuarios/${u.id}`, { activo: !u.activo }); cargar(); }
  function toggleRol(r: string) { setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x: string) => x !== r) : [...f.roles, r] }); }

  function abrirEdicion(u: any) { setEdit({ id: u.id, nombre: u.nombre, email: u.email, roles: [...u.roles], password: '', pin: '' }); setMsg(''); }
  function toggleRolEdit(r: string) { setEdit({ ...edit, roles: edit.roles.includes(r) ? edit.roles.filter((x: string) => x !== r) : [...edit.roles, r] }); }
  async function guardarEdicion() {
    const body: any = { nombre: edit.nombre, roles: edit.roles };
    if (edit.password) body.password = edit.password;
    if (edit.pin) body.pin = edit.pin;
    try { await api.put(`/config/usuarios/${edit.id}`, body); setMsg('Usuario actualizado'); setEdit(null); cargar(); }
    catch (err: any) { setMsg(err?.response?.data?.error ?? 'Error'); }
  }

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

      {/* Panel de edicion (cambiar contraseña, PIN, roles, nombre) */}
      {edit && (
        <div className="bg-white rounded-xl shadow p-4 text-sm border-2 border-primary-300">
          <div className="flex justify-between items-center mb-2">
            <b>Editar usuario: {edit.email}</b>
            <button onClick={() => setEdit(null)} className="text-slate-400 text-xs">cerrar</button>
          </div>
          <div className="grid md:grid-cols-4 gap-2 items-end">
            <label className="block">Nombre<input className="w-full border rounded px-2 py-1" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></label>
            <label className="block">Nueva contraseña<input className="w-full border rounded px-2 py-1" type="password" placeholder="(dejar en blanco = sin cambio)" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></label>
            <label className="block">Nuevo PIN<input className="w-full border rounded px-2 py-1" placeholder="4 dígitos (opcional)" value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value })} /></label>
            <button onClick={guardarEdicion} className="bg-primary-600 text-white rounded px-3 py-1">Guardar cambios</button>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {ROLES.map((r) => <label key={r} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={edit.roles.includes(r)} onChange={() => toggleRolEdit(r)} />{r}</label>)}
          </div>
          <p className="text-xs text-slate-400 mt-2">La contraseña debe tener al menos 6 caracteres. Deja los campos en blanco para no cambiarlos.</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left"><tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Roles</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2 text-right">Acciones</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2">{u.nombre}</td><td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2 text-xs">{u.roles.join(', ')}</td>
                <td className="px-4 py-2">{u.activo ? <span className="text-green-600">activo</span> : <span className="text-slate-400">inactivo</span>}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => abrirEdicion(u)} className="text-xs text-primary-600 mr-3">Editar</button>
                  <button onClick={() => toggle(u)} className="text-xs text-slate-500">{u.activo ? 'Desactivar' : 'Activar'}</button>
                </td>
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

function WhatsAppHsm() {
  const EVENTOS = [
    { k: 'recepcion', t: 'Recepcion de equipo', params: '{{1}} cliente · {{2}} equipo · {{3}} folio' },
    { k: 'autorizacion', t: 'Autorizacion de diagnostico', params: '{{1}} cliente · {{2}} equipo · {{3}} folio · {{4}} total' },
    { k: 'listo', t: 'Listo para entrega', params: '{{1}} cliente · {{2}} equipo · {{3}} folio' },
    { k: 'ticket', t: 'Entrega de ticket', params: '{{1}} cliente · {{2}} folio · {{3}} total' },
    { k: 'factura', t: 'Entrega de factura', params: '{{1}} cliente · {{2}} folio · {{3}} total' },
  ];
  const [cfg, setCfg] = useState<Record<string, { name?: string; lang?: string }>>({});
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/config/parametros/whatsapp.templates').then((r) => setCfg(r.data || {})).catch(() => {}); }, []);
  const set = (k: string, campo: string, v: string) => setCfg({ ...cfg, [k]: { ...(cfg[k] || {}), [campo]: v } });
  async function guardar() { await api.put('/config/parametros/whatsapp.templates', { valor: cfg }); setMsg('Plantillas guardadas'); }

  return (
    <div className="bg-white rounded-xl shadow p-4 text-sm space-y-3">
      {msg && <div className="p-2 bg-green-50 text-green-700 rounded">{msg}</div>}
      <p className="text-slate-500">
        Captura el <b>nombre exacto</b> de cada plantilla aprobada en Meta y su idioma (ej. <code>es_MX</code>).
        Crea en Meta plantillas con los parametros en el orden indicado. Si dejas el nombre vacio, ese evento se envia como texto libre (solo funciona dentro de la ventana de 24 h).
      </p>
      {EVENTOS.map((e) => (
        <div key={e.k} className="border rounded p-3">
          <div className="font-medium">{e.t}</div>
          <div className="text-xs text-slate-400 mb-2">Parametros de la plantilla: {e.params}</div>
          <div className="grid md:grid-cols-2 gap-2">
            <input className="border rounded px-2 py-1" placeholder="Nombre de la plantilla (Meta)" value={cfg[e.k]?.name || ''} onChange={(ev) => set(e.k, 'name', ev.target.value)} />
            <input className="border rounded px-2 py-1" placeholder="Idioma (ej. es_MX)" value={cfg[e.k]?.lang || ''} onChange={(ev) => set(e.k, 'lang', ev.target.value)} />
          </div>
        </div>
      ))}
      <button onClick={guardar} className="bg-primary-600 text-white rounded px-4 py-1">Guardar plantillas</button>
      <p className="text-xs text-slate-400">Ademas configura en el servidor: <code>WHATSAPP_TOKEN</code>, <code>WHATSAPP_PHONE_ID</code> y <code>WHATSAPP_COUNTRY_CODE</code>.</p>
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
