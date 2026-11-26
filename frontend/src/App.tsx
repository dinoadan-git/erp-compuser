import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Ordenes from './pages/Ordenes';
import Portal from './pages/Portal';
import Ventas from './pages/Ventas';
import Caja from './pages/Caja';
import Inventario from './pages/Inventario';
import Compras from './pages/Compras';
import Reportes from './pages/Reportes';
import Gastos from './pages/Gastos';
import Catalogo from './pages/Catalogo';
import Proyectos from './pages/Proyectos';
import Configuracion from './pages/Configuracion';
import Placeholder from './pages/Placeholder';

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<Portal />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/ordenes" element={<Ordenes />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/proyectos" element={<Proyectos />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/config" element={<Configuracion />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
