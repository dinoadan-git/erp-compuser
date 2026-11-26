import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PRIMARY = [
  { to: '/', label: 'Dashboard' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/ordenes', label: 'Órdenes' },
  { to: '/ventas', label: 'Ventas (POS)' },
  { to: '/caja', label: 'Caja' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/reportes', label: 'Reportes' },
];

const MAS = [
  { to: '/catalogo', label: 'Productos y servicios' },
  { to: '/compras', label: 'Compras' },
  { to: '/proyectos', label: 'Proyectos' },
  { to: '/gastos', label: 'Gastos' },
  { to: '/config', label: 'Configuración' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [masOpen, setMasOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // mobile
  const masRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMasOpen(false); setMenuOpen(false); }, [loc.pathname]);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (masRef.current && !masRef.current.contains(e.target as Node)) setMasOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const rol = user?.roles?.[0] ? user.roles[0].charAt(0).toUpperCase() + user.roles[0].slice(1).toLowerCase() : '';
  const masActivo = MAS.some((m) => loc.pathname.startsWith(m.to) && m.to !== '/');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          {/* Logo */}
          <NavLink to="/" className="flex shrink-0 items-center">
            <img src="/logo-compuservicios.png" alt="Compuservicios" className="h-9 w-auto" />
          </NavLink>

          {/* Nav escritorio */}
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {PRIMARY.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.to === '/'} className={navClass}>
                {m.label}
              </NavLink>
            ))}
            <div className="relative" ref={masRef}>
              <button
                onClick={() => setMasOpen((v) => !v)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  masActivo ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Más
                <svg className={`h-4 w-4 transition ${masOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {masOpen && (
                <div className="absolute right-0 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card-lg">
                  {MAS.map((m) => (
                    <NavLink
                      key={m.to}
                      to={m.to}
                      className={({ isActive }) =>
                        `block px-4 py-2 text-sm ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`
                      }
                    >
                      {m.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Usuario escritorio */}
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-slate-800">{user?.nombre}</div>
              <div className="text-xs text-slate-400">{rol}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
              {user?.nombre?.charAt(0).toUpperCase()}
            </div>
            <button onClick={() => { logout(); nav('/login'); }} className="btn-ghost px-3 py-1.5 text-xs">
              Salir
            </button>
          </div>

          {/* Botón móvil */}
          <button onClick={() => setMenuOpen((v) => !v)} className="btn-ghost ml-auto px-3 py-2 lg:hidden" aria-label="Menú">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Menú móvil */}
        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            <nav className="grid gap-1">
              {[...PRIMARY, ...MAS].map((m) => (
                <NavLink key={m.to} to={m.to} end={m.to === '/'} className={navClass}>
                  {m.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">{user?.nombre}</div>
                <div className="text-xs text-slate-400">{rol}</div>
              </div>
              <button onClick={() => { logout(); nav('/login'); }} className="btn-ghost px-3 py-1.5 text-xs">Salir</button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
