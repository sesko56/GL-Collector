import { createApp } from '../../../server.js';

export const config = {
  maxDuration: 60,
};

// Une seule instance Express par exécution serverless ; le catch-all couvre /api/*.
const appPromise = createApp(false);

export default async function handler(req: any, res: any) {
	  console.log('API HIT:', req.method, req.url);
  try {
    // Selon le routeur Vercel, le préfixe /api peut être retiré du chemin.
    if (!String(req.url || '').startsWith('/api/')) {
      req.url = `/api${String(req.url || '/').startsWith('/') ? '' : '/'}${req.url || ''}`;
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('API initialization failed:', error);
    return res.status(500).json({ error: `Initialisation PostgreSQL impossible : ${(error as Error).message}` });
  }
}
