/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Links antigos de acesso antecipado
      {
        source: "/acesso-antecipado",
        destination: "/",
        permanent: true,
      },
      // Variante sem acento (opcional)
      {
        source: "/pagina-inicial",
        destination: "/página-inicial",
        permanent: true,
      },
    ];
  },
};
module.exports = nextConfig;
