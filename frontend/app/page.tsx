import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Zeedo</h1>
        <p className="text-gray-600 mb-8">Bot de trading automatizado para Hyperliquid</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn-primary text-center">
            Entrar
          </Link>
          <Link href="/signup" className="btn-secondary text-center">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}
