import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@csa.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try { await login(email, password); nav('/'); }
    catch { setError('Credenciales incorrectas. Inténtalo de nuevo.'); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card card-pad w-full max-w-sm space-y-5 shadow-card-lg">
        <div className="flex justify-center">
          <img src="/logo-compuservicios.png" alt="Compuservicios" className="h-12 w-auto" />
        </div>
        <p className="text-center text-xs text-slate-500">
          Centro de Servicio Autorizado <span className="font-semibold text-primary-600">EPSON</span> · <span className="font-semibold text-red-500">Canon</span>
        </p>
        <div className="space-y-3">
          <label className="block"><span className="lbl">Email / Usuario</span>
            <input placeholder="tucorreo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block"><span className="lbl">Contraseña</span>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full">Ingresar</button>
      </form>
    </div>
  );
}
