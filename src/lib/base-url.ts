export function getBaseUrl() {
  // 1) Tu forces ça toi-même (recommandé)
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (explicit) {
    return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  }

  // 2) En prod Vercel, VERCEL_URL existe mais sans "https://"
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  // 3) Local
  return "http://localhost:3000";
}
