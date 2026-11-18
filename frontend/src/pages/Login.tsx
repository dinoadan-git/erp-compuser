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
    catch { setError('Credenciales incorrectas. Intentalo de nuevo.'); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow-md w-80 space-y-4">
        <h1 className="text-xl font-bold text-center">CSA EPSON</h1>
        <p className="text-center text-sm text-slate-500">Centro de Servicio Autorizado</p>
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
