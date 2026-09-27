import { createApp } from '../server.js';

// Une seule instance Express par exécution serverless ; le catch-all couvre /api/*.
const appPromise = createApp(false);

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
