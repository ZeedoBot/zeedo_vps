import Link from "next/link";
import Image from "next/image";
import { SiTiktok, SiInstagram } from "react-icons/si";

const LINKS = [
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@zeedobot",
    icon: "tiktok",
    external: true,
  },
  {
    label: "Instagram",
    href: "https://instagram.com/azevedocrypto",
    icon: "instagram",
    external: true,
  },
  {
    label: "Acesso Antecipado",
    href: "/acesso-antecipado",
    icon: "zeedo",
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
          {LINKS.map((link) => {
            const IconComponent = link.icon === "tiktok" ? SiTiktok : link.icon === "instagram" ? SiInstagram : null;
            const linkClass = link.external
              ? "flex items-center justify-center gap-3 w-full py-4 px-5 rounded-xl bg-white/[0.06] border border-zeedo-orange/30 text-white font-medium hover:bg-zeedo-orange/10 hover:border-zeedo-orange/50 transition-all duration-200"
              : "flex items-center justify-center gap-3 w-full py-4 px-5 rounded-xl bg-zeedo-orange/10 border border-zeedo-orange/50 text-zeedo-orange font-medium hover:bg-zeedo-orange/20 transition-all duration-200";
            const iconEl = link.icon === "zeedo" ? (
              <Image src="/zeedo-logo.png?v=4" alt="" width={24} height={24} className="object-contain mix-blend-screen opacity-90" />
            ) : IconComponent ? (
              <IconComponent className="w-6 h-6 shrink-0" />
            ) : null;
            return link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {iconEl}
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={linkClass}>
                {iconEl}
                {link.label}
              </Link>
            );
          })}
        </div>

        <p className="text-center text-white/40 text-xs mt-12">
          zeedo.ia.br
        </p>
      </div>
    </div>
  );
}
