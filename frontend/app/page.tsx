import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zeedo-white dark:bg-zeedo-black">
      <div className="text-center max-w-md">
        <Image
          src="/zeedo-logo.png?v=4"
          alt="Zeedo Bot"
          width={240}
          height={240}
          priority
          className="mx-auto mb-6 mix-blend-multiply dark:mix-blend-screen"
        />
        <h1 className="text-2xl font-semibold text-zeedo-black dark:text-zeedo-white mb-2">Zeedo</h1>
        <p className="text-zeedo-black/70 dark:text-zeedo-white/70 mb-8">Você vive a vida. O Zeedo vive o mercado.<br />Sem emoção, sem cansaço. Apenas a matemática trabalhando por você.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn-primary text-center">
            Entrar
          </Link>
          <Link href="/signup" className="btn-secondary text-center">
            Criar conta
          </Link>
        </div>
        <p className="mt-8 text-xs text-zeedo-black/50 dark:text-zeedo-white/50 text-center">
          <Link href="/termos" className="hover:text-zeedo-orange hover:underline">Termos de Uso</Link>
          {" · "}
          <Link href="/privacidade" className="hover:text-zeedo-orange hover:underline">Política de Privacidade</Link>
        </p>
      </div>
    </div>
  );
}
