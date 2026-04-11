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
      // Rotas antigas da landing → raiz
      {
        source: "/pagina-inicial",
        destination: "/",
        permanent: true,
      },
      {
        source: "/página-inicial",
        destination: "/",
        permanent: true,
      },
    ];
  },
};
module.exports = nextConfig;
