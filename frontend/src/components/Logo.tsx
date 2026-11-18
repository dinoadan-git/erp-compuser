// Marca Compuservicios: arco tricolor (verde/azul/rojo) + logotipo.
export function Logo({ size = 34, light = false }: { size?: number; light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size * 0.82} viewBox="0 0 48 40" aria-hidden>
        <path d="M5 33 A19 19 0 0 1 43 33" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
        <path d="M11 33 A13 13 0 0 1 37 33" fill="none" stroke="#0ea5e9" strokeWidth="5" strokeLinecap="round" />
        <path d="M17 33 A7 7 0 0 1 31 33" fill="none" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="leading-none">
        <div className={`font-bold tracking-tight ${light ? 'text-white' : 'text-slate-800'}`} style={{ fontSize: size * 0.5 }}>
          Compuser<span className={light ? 'text-sky-200' : 'text-slate-400'}>vicios</span>
        </div>
      </div>
    </div>
  );
}
