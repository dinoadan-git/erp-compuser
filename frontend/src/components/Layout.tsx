import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODULOS = [
  { to: '/', label: 'Dashboard' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/ordenes', label: 'Ordenes de trabajo' },
  { to: '/catalogo', label: 'Productos y servicios' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/compras', label: 'Compras' },
  { to: '/ventas', label: 'Ventas (POS)' },
  { to: '/proyectos', label: 'Proyectos' },
  { to: '/gastos', label: 'Gastos' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/config', label: 'Configuracion' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-4 py-4 text-lg font-bold border-b border-slate-700">CSA EPSON</div>
        <nav className="flex-1 overflow-y-auto py-2">
          {MODULOS.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.to === '/'}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'bg-primary-600 text-white' : 'hover:bg-slate-800'}`
              }
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-slate-700 text-sm">
          <div className="font-medium">{user?.nombre}</div>
          <div className="text-slate-400 text-xs">{user?.roles.join(', ')}</div>
          <button onClick={() => { logout(); nav('/login'); }} className="mt-2 text-xs text-primary-100 underline">
            Cerrar sesion
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto"><Outlet /></main>
    </div>
  );
}
