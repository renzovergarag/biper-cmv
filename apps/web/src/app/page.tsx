export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          BIPER CMV
        </h1>
        <p className="text-lg text-gray-600">
          Sistema de Gestión de Eventos Territoriales
        </p>
        <div className="mt-8">
          <a
            href="/login"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Iniciar Sesión
          </a>
        </div>
      </div>
    </div>
  );
}
