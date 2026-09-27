import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL est manquante. Copiez l’URL Neon depuis Vercel (Settings → Environment Variables) dans un .env local.'
  );
}

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const playerPath = path.join(dataDir, 'runtime-player.json');
const legacyPath = path.join(dataDir, 'runtime-db.json');
const sourcePath = fs.existsSync(playerPath) ? playerPath : legacyPath;
if (!fs.existsSync(sourcePath)) {
  throw new Error(`Aucun fichier de progression trouvé (${playerPath} ou ${legacyPath}).`);
}

const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf-8')) as Record<string, unknown>;
const player = {
  config: raw.config,
  users: raw.users || [],
  sessions: raw.sessions || {},
  cardOwnerships: raw.cardOwnerships || [],
  boosterInventories: raw.boosterInventories || [],
  boosterOpenings: raw.boosterOpenings || [],
  auctions: raw.auctions || [],
  bids: raw.bids || [],
  transactions: raw.transactions || [],
  notifications: raw.notifications || [],
  importLogs: raw.importLogs || [],
  auditLogs: raw.auditLogs || [],
  globalMintCounter: raw.globalMintCounter || 1,
  rarityRuns: raw.rarityRuns || [],
  rarityCalculations: Array.isArray(raw.rarityCalculations)
    ? raw.rarityCalculations.slice(0, 150)
    : [],
};

const payload = gzipSync(JSON.stringify(player)).toString('base64');
const sql = neon(databaseUrl);

await sql`CREATE TABLE IF NOT EXISTS gl_collector_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
await sql`ALTER TABLE gl_collector_state ADD COLUMN IF NOT EXISTS payload TEXT`;
await sql`INSERT INTO gl_collector_state (id, version, payload)
  VALUES (1, 1, ${payload})
  ON CONFLICT (id) DO UPDATE SET
    payload = EXCLUDED.payload,
    version = gl_collector_state.version + 1,
    updated_at = NOW()`;

const users = Array.isArray(player.users) ? player.users.length : 0;
const owned = Array.isArray(player.cardOwnerships) ? player.cardOwnerships.length : 0;
console.log(`Neon mis à jour (progression seulement) : ${users} comptes, ${owned} cartes possédées.`);
