import Link from "next/link";
import Image from "next/image";

const LINKS = [
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@zeedobot",
    icon: "🎵",
    external: true,
  },
  {
    label: "Instagram",
    href: "https://instagram.com/azevedocrypto",
    icon: "📷",
    external: true,
  },
  {
    label: "Acesso Antecipado",
    href: "/acesso-antecipado",
    icon: "🚀",
    external: false,
  },
];

export default function LinksPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center mb-12">
          <Image
            src="/zeedo-logo.png?v=4"
            alt="Zeedo"
            width={80}
            height={80}
            className="mb-4 opacity-90"
          />
          <span className="text-white/80 text-sm font-medium tracking-wide">Zeedo</span>
        </div>

        <div className="space-y-3">
          {LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 px-5 rounded-xl bg-white/[0.06] border border-zeedo-orange/30 text-white font-medium hover:bg-zeedo-orange/10 hover:border-zeedo-orange/50 transition-all duration-200"
              >
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-center gap-3 w-full py-4 px-5 rounded-xl bg-zeedo-orange/10 border border-zeedo-orange/50 text-zeedo-orange font-medium hover:bg-zeedo-orange/20 transition-all duration-200"
              >
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </Link>
            )
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-12">
          zeedo.ai.br
        </p>
      </div>
    </div>
  );
}
