export default function AgentDashboard() {
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Modo Escucha
      </h2>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-600">Conectado</span>
        </div>
        <p className="text-gray-500 text-sm">
          Esperando eventos...
        </p>
      </div>
    </div>
  );
}
