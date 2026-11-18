import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const TIPOS = ['CONSUMIBLE', 'REFACCION', 'EQUIPO_COMPUTO', 'SERVICIO'];
const LISTAS = ['PUBLICO', 'EMPRESA', 'MAYOREO'] as const;

export default function Catalogo() {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState<any>({ tipo: 'CONSUMIBLE', nombre: '', sku: '', codigoBarras: '', categoriaId: '', marcaId: '', claveProdServSat: '', claveUnidadSat: '', tasaIva: 16, publicarEnTienda: false, precios: { PUBLICO: '', EMPRESA: '', MAYOREO: '' } });

  const cargar = () => {
    api.get('/catalogo/productos', { params: { q } }).then((r) => setProductos(r.data)).catch(() => {});
    api.get('/catalogo/categorias').then((r) => setCategorias(r.data)).catch(() => {});
    api.get('/catalogo/marcas').then((r) => setMarcas(r.data)).catch(() => {});
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [q]);

  async function addCategoria() { const n = prompt('Nueva categoría:'); if (n) { await api.post('/catalogo/categorias', { nombre: n }); cargar(); } }
  async function addMarca() { const n = prompt('Nueva marca:'); if (n) { await api.post('/catalogo/marcas', { nombre: n }); cargar(); } }

  async function crear() {
    if (!form.nombre) return;
    const precios = LISTAS.filter((l) => form.precios[l] !== '').map((l) => ({ lista: l, precio: Number(form.precios[l]) }));
    await api.post('/catalogo/productos', {
      tipo: form.tipo, nombre: form.nombre, sku: form.sku || undefined, codigoBarras: form.codigoBarras || undefined,
      categoriaId: form.categoriaId || undefined, marcaId: form.marcaId || undefined,
      claveProdServSat: form.claveProdServSat || undefined, claveUnidadSat: form.claveUnidadSat || undefined,
      tasaIva: Number(form.tasaIva), publicarEnTienda: form.publicarEnTienda, precios,
    });
    setMsg(`Producto "${form.nombre}" creado`);
    setForm({ ...form, nombre: '', sku: '', codigoBarras: '', precios: { PUBLICO: '', EMPRESA: '', MAYOREO: '' } });
    cargar();
  }

  async function toggleActivo(p: any, activo: boolean) { await api.patch(`/catalogo/productos/${p.id}/activo`, { activo }); cargar(); }
  async function addCompat(p: any) {
    const marca = prompt('Marca del equipo compatible:'); if (!marca) return;
    const modelo = prompt('Modelo:'); if (!modelo) return;
    await api.post(`/catalogo/productos/${p.id}/compatibilidades`, { marca, modelo });
    setMsg(`Compatibilidad agregada a ${p.nombre}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Productos y servicios</h1>
      {msg && <div className="mb-4 p-3 bg-primary-50 text-primary-800 rounded text-sm">{msg}</div>}

      {/* Nuevo producto */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">Nuevo producto / servicio</h2>
        <div className="grid md:grid-cols-4 gap-2 text-sm">
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="border rounded px-2 py-1">
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="Código de barras" value={form.codigoBarras} onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })} />
          <div className="flex gap-1">
            <select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} className="border rounded px-2 py-1 flex-1">
              <option value="">Categoría...</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button onClick={addCategoria} className="bg-slate-200 rounded px-2" title="Nueva categoría">+</button>
          </div>
          <div className="flex gap-1">
            <select value={form.marcaId} onChange={(e) => setForm({ ...form, marcaId: e.target.value })} className="border rounded px-2 py-1 flex-1">
              <option value="">Marca...</option>{marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <button onClick={addMarca} className="bg-slate-200 rounded px-2" title="Nueva marca">+</button>
          </div>
          <input className="border rounded px-2 py-1" placeholder="Clave Prod/Serv SAT" value={form.claveProdServSat} onChange={(e) => setForm({ ...form, claveProdServSat: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="Clave Unidad SAT" value={form.claveUnidadSat} onChange={(e) => setForm({ ...form, claveUnidadSat: e.target.value })} />
          <input type="number" className="border rounded px-2 py-1" placeholder="IVA %" value={form.tasaIva} onChange={(e) => setForm({ ...form, tasaIva: e.target.value })} />
          {LISTAS.map((l) => (
            <input key={l} type="number" className="border rounded px-2 py-1" placeholder={`Precio ${l.toLowerCase()}`} value={form.precios[l]} onChange={(e) => setForm({ ...form, precios: { ...form.precios, [l]: e.target.value } })} />
          ))}
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.publicarEnTienda} onChange={(e) => setForm({ ...form, publicarEnTienda: e.target.checked })} /> Publicar en tienda</label>
          <button onClick={crear} className="bg-primary-600 text-white rounded px-3 py-1 md:col-span-1">Crear producto</button>
        </div>
      </div>

      <input className="border rounded px-3 py-2 text-sm mb-4 w-72" placeholder="Buscar por nombre, SKU o código..." value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left"><tr>
            <th className="px-4 py-2">Producto</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Categoría</th>
            <th className="px-4 py-2">Marca</th><th className="px-4 py-2 text-right">Precio público</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2"></th>
          </tr></thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.nombre}{p.publicarEnTienda ? ' 🛒' : ''}<div className="text-xs text-slate-400">{p.sku}</div></td>
                <td className="px-4 py-2 text-xs">{p.tipo}</td>
                <td className="px-4 py-2">{p.categoria ?? '-'}</td>
                <td className="px-4 py-2">{p.marca ?? '-'}</td>
                <td className="px-4 py-2 text-right">${Number(p.precioPublico).toFixed(2)}</td>
                <td className="px-4 py-2 text-right">{Number(p.disponible)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {p.tipo !== 'SERVICIO' && <button onClick={() => addCompat(p)} className="text-primary-600 text-xs mr-2">+ Compat.</button>}
                  <button onClick={() => toggleActivo(p, false)} className="text-red-500 text-xs">Desactivar</button>
                </td>
              </tr>
            ))}
            {productos.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Sin productos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
