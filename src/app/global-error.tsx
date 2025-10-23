'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  return (
    <html lang="fr">
      <body>
        <div style={{ padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Erreur globale</h1>
          <p style={{ opacity: 0.7, marginTop: 8 }}>On recharge l’application.</p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
