import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';

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
    catch { setError('Credenciales incorrectas. Intentalo de nuevo.'); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow-md w-80 space-y-4">
        <div className="flex justify-center"><Logo size={44} /></div>
        <p className="text-center text-xs text-slate-500">Centro de Servicio Autorizado <span className="text-sky-600 font-semibold">EPSON</span> · <span className="text-red-500 font-semibold">Canon</span></p>
        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Email / Usuario"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border rounded px-3 py-2 text-sm" type="password" placeholder="Contrasena"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full bg-primary-600 text-white rounded py-2 text-sm font-medium">Ingresar</button>
      </form>
    </div>
  );
}
