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
      // Atalhos de campanha (UTMs)
      {
        source: "/tiktok",
        destination: "/links?utm_source=tiktok&utm_medium=bio&utm_campaign=azevedocrypto",
        permanent: false,
      },
      {
        source: "/azevedocrypto",
        destination: "/?utm_source=instagram&utm_medium=bio&utm_campaign=azevedocrypto",
        permanent: false,
      },
      {
        source: "/zeedo",
        destination: "/?utm_source=instagram&utm_medium=bio&utm_campaign=zeedo",
        permanent: false,
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
