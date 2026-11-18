export default function Placeholder({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{titulo}</h1>
      <div className="bg-white rounded-xl shadow p-8 text-center text-slate-400">
        Modulo "{titulo}" — andamiaje listo. Pendiente de implementar segun el documento de definicion.
      </div>
    </div>
  );
}
