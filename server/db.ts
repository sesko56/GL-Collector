import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gzipSync, gunzipSync } from 'zlib';
import { neon } from '@neondatabase/serverless';
import {
  AuctionRecord,
  BidRecord,
  CardOwnershipRecord,
  CardRecord,
  NotificationRecord,
  Rarity,
  RarityCalculationRecord,
  RarityRunSummary,
  RarityThresholds,
  SystemConfig,
  TransactionRecord,
  TransactionType,
  UserRole,
  WikiImportLog,
  WikiPageRecord,
  WikiViewStatRecord,
} from '../src/types/index.js';

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  emailVerified: boolean;
  verificationToken: string | null;
  verificationExpiresAt?: string | null;
  resetPasswordToken: string | null;
  resetTokenExpiresAt: string | null;
  role: UserRole;
  suspended: boolean;
  coins: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredBoosterInventory {
  id: string;
  userId: string;
  storedBoosters: number;
  lastRechargeAt: string;
}

export interface StoredBoosterOpening {
  id: string;
  userId: string;
  openedAt: string;
  ownershipIds: string[];
  cardIds: string[];
}

export interface DatabaseSchema {
  config: SystemConfig;
  users: StoredUser[];
  sessions: Record<string, { userId: string; createdAt: string; csrfToken: string }>;
  wikiPages: WikiPageRecord[];
  wikiViewStats: WikiViewStatRecord[];
  cards: CardRecord[];
  rarityCalculations: RarityCalculationRecord[];
  rarityRuns: RarityRunSummary[];
  cardOwnerships: CardOwnershipRecord[];
  boosterInventories: StoredBoosterInventory[];
  boosterOpenings: StoredBoosterOpening[];
  auctions: AuctionRecord[];
  bids: BidRecord[];
  transactions: TransactionRecord[];
  notifications: NotificationRecord[];
  importLogs: WikiImportLog[];
  auditLogs: Array<{ id: string; timestamp: string; actorId: string | null; action: string; details: string }>;
  globalMintCounter: number;
}

/** Données persistées (Neon / fichier local). Le catalogue de cartes n’en fait pas partie. */
export interface PlayerState {
  config: SystemConfig;
  users: StoredUser[];
  sessions: DatabaseSchema['sessions'];
  cardOwnerships: CardOwnershipRecord[];
  boosterInventories: StoredBoosterInventory[];
  boosterOpenings: StoredBoosterOpening[];
  auctions: AuctionRecord[];
  bids: BidRecord[];
  transactions: TransactionRecord[];
  notifications: NotificationRecord[];
  importLogs: WikiImportLog[];
  auditLogs: DatabaseSchema['auditLogs'];
  globalMintCounter: number;
  rarityRuns: RarityRunSummary[];
  rarityCalculations: RarityCalculationRecord[];
}

interface CatalogSlice {
  wikiPages: WikiPageRecord[];
  wikiViewStats: WikiViewStatRecord[];
  cards: CardRecord[];
}

export function extractPlayerState(state: Partial<DatabaseSchema> & Record<string, unknown>): PlayerState {
  const schema = state as DatabaseSchema;
  return {
    config: schema.config,
    users: schema.users || [],
    sessions: schema.sessions || {},
    cardOwnerships: schema.cardOwnerships || [],
    boosterInventories: schema.boosterInventories || [],
    boosterOpenings: schema.boosterOpenings || [],
    auctions: schema.auctions || [],
    bids: schema.bids || [],
    transactions: schema.transactions || [],
    notifications: schema.notifications || [],
    importLogs: schema.importLogs || [],
    auditLogs: schema.auditLogs || [],
    globalMintCounter: schema.globalMintCounter || 1,
    rarityRuns: schema.rarityRuns || [],
    rarityCalculations: (schema.rarityCalculations || []).slice(0, 150),
  };
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { hash, salt: usedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
}

export function computeRarityForPercentile(
  percentileRank: number,
  thresholds: RarityThresholds
): Rarity {
  if (percentileRank <= thresholds.MYTHIQUE) return 'MYTHIQUE';
  if (percentileRank <= thresholds.LEGENDAIRE) return 'LEGENDAIRE';
  if (percentileRank <= thresholds.EPIQUE) return 'EPIQUE';
  if (percentileRank <= thresholds.RARE) return 'RARE';
  if (percentileRank <= thresholds.PEU_COMMUNE) return 'PEU_COMMUNE';
  return 'COMMUNE';
}

function detectCategoryAndSummary(title: string): { category: string; summary: string } {
  const t = title.toLowerCase();

  if (t.includes('no mi') || t.includes('fruit du démon') || t.includes('smile')) {
    return {
      category: 'Fruits du Démon',
      summary: `Fruit du Démon répertorié dans la One Piece Encyclopédie. Confère à son utilisateur des propriétés surhumaines uniques au prix de la capacité à nager.`,
    };
  }
  if (t.startsWith('chapitre ') || t.startsWith('épisode ') || t.includes('saga ') || t.includes('arc ')) {
    return {
      category: 'Épisodes, Chapitres & Sagas',
      summary: `Segment narratif officiel de l'œuvre d'Eiichiro Oda documenté sur la One Piece Encyclopédie, retraçant la progression de l'équipage sur Grand Line.`,
    };
  }
  if (t.includes('île') || t.includes('royaume') || t.includes('pays') || t.includes('mer ') || t.includes('line') || t.includes('archipel') || t.includes('terre') || t.includes('ville') || t.includes('village')) {
    return {
      category: 'Lieux & Îles',
      summary: `Territoire insulaire ou maritime emblématique du monde de One Piece documenté dans les archives géographiques de l'encyclopédie.`,
    };
  }
  if (t.includes('équipage') || t.includes('marine') || t.includes('gouvernement') || t.includes('armée') || t.includes('famille') || t.includes('clan') || t.includes('guilde') || t.includes('baroque works') || t.includes('cp9') || t.includes('cp0')) {
    return {
      category: 'Organisations & Équipages',
      summary: `Faction, équipage pirate ou institution militaire majeure régissant l'équilibre des forces et la géopolitique de Grand Line.`,
    };
  }
  if (t.includes('bateau') || t.includes('navire') || t.includes('vogue') || t.includes('sunny') || t.includes('merry') || t.includes('sloop') || t.includes('galion')) {
    return {
      category: 'Navires',
      summary: `Bâtiment maritime fendant les mers tumultueuses de Grand Line et du Nouveau Monde, documenté sur la One Piece Encyclopédie.`,
    };
  }
  if (t.includes('sabre') || t.includes('épée') || t.includes('fusil') || t.includes('canon') || t.includes('ponéglyphe') || t.includes('log pose') || t.includes('climat') || t.includes('dials') || t.includes('arme') || t.includes('granit')) {
    return {
      category: 'Armes, Objets & Reliques',
      summary: `Artefact, relique légendaire ou équipement de navigation consigné dans l'encyclopédie, jouant un rôle clé dans l'aventure.`,
    };
  }
  if (t.includes('technique') || t.includes('haki') || t.includes('fluide') || t.includes('rokushiki') || t.includes('karaté') || t.includes('style') || t.includes('gear')) {
    return {
      category: 'Techniques & Combats',
      summary: `Discipline martiale, éveil spirituel ou technique de combat développée par les guerriers de Grand Line.`,
    };
  }
  if (t.includes('volonté') || t.includes('siècle') || t.includes('histoire') || t.includes('légende') || t.includes('dieu') || t.includes('siècle oublié')) {
    return {
      category: 'Histoire & Lore',
      summary: `Mystère historique ou mémoire ancestrale documentée dans l'encyclopédie, liée au Siècle Oublié et à la Véritable Histoire.`,
    };
  }

  // Par défaut, personnage ou sujet d'encyclopédie
  return {
    category: 'Personnages & Encyclopédie',
    summary: `Entrée encyclopédique consacrée à ${title} issue de la One Piece Encyclopédie Fandom. Retrace son parcours, ses affiliations et son impact dans l'univers de One Piece.`,
  };
}

// Sujets majeurs pour lesquels nous avons des résumés encyclopédiques riches et une très forte fréquentation
const FAMOUS_ENTITIES: Record<string, { views: number; category: string; summary: string }> = {
  'Monkey D. Luffy': {
    views: 1485000,
    category: 'Personnages',
    summary: "Fondateur et capitaine de l'Équipage du Chapeau de Paille, Monkey D. Luffy est le protagoniste principal de One Piece. Après avoir mangé le Hito Hito no Mi, Modèle : Nika, son corps a acquis les propriétés du caoutchouc et la liberté du Dieu du Soleil. Son rêve ultime est de trouver le One Piece sur Laugh Tale pour devenir le Roi des Pirates.",
  },
  'Roronoa Zoro': {
    views: 962000,
    category: 'Personnages',
    summary: "Combattant et premier membre recruté par Luffy, Roronoa Zoro manie le Santoryu (technique à trois sabres) avec Wado Ichimonji, Sandai Kitetsu et Enma. Il poursuit le serment de devenir le plus grand escrimeur du monde en surpassant Dracule Mihawk.",
  },
  'Shanks': {
    views: 918000,
    category: 'Personnages',
    summary: "Capitaine de l'Équipage du Roux et l'un des Quatre Empereurs du Nouveau Monde, Shanks est un ancien mousse de Gol D. Roger. C'est lui qui a inspiré Luffy et lui a légué son chapeau de paille à Fuschia.",
  },
  'Gol D. Roger': {
    views: 742000,
    category: 'Personnages',
    summary: "Légendaire Roi des Pirates ayant conquis Grand Line jusqu'à Laugh Tale. Ses ultimes paroles lors de son exécution à Loguetown ont inauguré la Grande Âge de la Piraterie.",
  },
  'Marshall D. Teach': {
    views: 715000,
    category: 'Personnages',
    summary: "Dit Barbe Noire, amiral de l'Équipage de Barbe Noire et l'un des Quatre Empereurs. Seul individu connu possédant deux Fruits du Démon : le Yami Yami no Mi et le Gura Gura no Mi.",
  },
  'Gomu Gomu no Mi': {
    views: 688000,
    category: 'Fruits du Démon',
    summary: "Nom dissimulé du Hito Hito no Mi, Modèle : Nika. Fruit de type Zoan Mythique permettant d'incarner Nika le Guerrier Libérateur avec une plasticité corporelle totale.",
  },
  'Sanji': {
    views: 612000,
    category: 'Personnages',
    summary: "Cuisinier de l'Équipage du Chapeau de Paille, prince renégat du Royaume de Germa et maître du style de la Jambe Noire. Il cherche la mer légendaire d'All Blue.",
  },
  'Trafalgar D. Water Law': {
    views: 590000,
    category: 'Personnages',
    summary: "Capitaine de l'Équipage du Heart et Chirurgien de la Mort détenteur de l'Ope Ope no Mi. Allié décisif des Chapeaux de Paille contre Doflamingo, Kaido et Big Mom.",
  },
  'Edward Newgate': {
    views: 565000,
    category: 'Personnages',
    summary: "Dit Barbe Blanche, capitaine de l'Équipage de Barbe Blanche et l'un des Quatre Empereurs avant Marineford, considéré comme l'homme le plus proche du One Piece.",
  },
  'Nico Robin': {
    views: 544000,
    category: 'Personnages',
    summary: "Archéologue de l'Équipage du Chapeau de Paille et enfant d'Ohara, seule survivante capable de déchiffrer les Ponéglyphes pour révéler l'Histoire du Siècle Oublié.",
  },
  'Portgas D. Ace': {
    views: 528000,
    category: 'Personnages',
    summary: "Fils de Gol D. Roger, frère spirituel de Luffy et Sabo, ancien commandant de Barbe Blanche et manieur des flammes du Mera Mera no Mi.",
  },
  'Imu': {
    views: 519000,
    category: 'Personnages',
    summary: "Souverain secret siégeant sur le Trône Vide de Mary Geoise au sommet du Gouvernement Mondial, devant qui s'inclinent les Cinq Doyens.",
  },
  'Kaido': {
    views: 498000,
    category: 'Personnages',
    summary: "Gouverneur de l'Équipage aux Cent Bêtes et ancien Empereur régnant sur Wano Kuni, métamorphosé en dragon azur par le Uo Uo no Mi.",
  },
  'Dracule Mihawk': {
    views: 486000,
    category: 'Personnages',
    summary: "Œil de Faucon, le Plus Grand Escrimeur du Monde maniant la lame noire Yoru, et cofondateur de la Cross Guild avec Crocodile et Baggy.",
  },
  'Siècle Oublié': {
    views: 472000,
    category: 'Histoire & Lore',
    summary: "Période de cent ans effacée de l'histoire du monde il y a 800 ans, au cœur de la fondation du Gouvernement Mondial et des Ponéglyphes.",
  },
  'Nami': {
    views: 445000,
    category: 'Personnages',
    summary: "Navigatrice et cartographe hors pair de l'Équipage du Chapeau de Paille, rêvant de dessiner la carte du monde entier grâce à son Climat-Tact.",
  },
  'Donquixote Doflamingo': {
    views: 430000,
    category: 'Personnages',
    summary: "Ancien Dragon Céleste et Grand Corsaire ayant régné sur Dressrosa et la pègre sous le pseudonyme Joker grâce au Ito Ito no Mi.",
  },
  'Monkey D. Dragon': {
    views: 421000,
    category: 'Personnages',
    summary: "Commandant suprême de l'Armée Révolutionnaire, père de Luffy et fils de Garp, qualifié de pire criminel du monde.",
  },
  'Monkey D. Garp': {
    views: 414000,
    category: 'Personnages',
    summary: "Héros de la Marine ayant vaincu l'Équipage de Rocks à God Valley aux côtés de Roger, et grand-père bienveillant de Luffy.",
  },
  'Vegapunk': {
    views: 402000,
    category: 'Personnages',
    summary: "Génie scientifique ayant cinq cents ans d'avance sur l'humanité, ayant divisé sa conscience sur Egghead en six satellites.",
  },
};

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

function resolveDataFile(filename: string): string {
  const candidates = [
    path.join(MODULE_DIR, 'data', filename),
    path.resolve(process.cwd(), 'server', 'data', filename),
    path.resolve(process.cwd(), filename),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

const PLAYER_FILE_PATH = resolveDataFile('runtime-player.json');
const LEGACY_DB_FILE_PATH = resolveDataFile('runtime-db.json');
const CATALOG_FILE_PATH = resolveDataFile('wikiFullCatalog.json');
const MIN_CATALOG_CARDS = 7000;
const DEFAULT_THRESHOLDS: RarityThresholds = {
  MYTHIQUE: 1,
  LEGENDAIRE: 5,
  EPIQUE: 10,
  RARE: 25,
  PEU_COMMUNE: 50,
};

class DatabaseEngine {
  public state: DatabaseSchema;
  private lockPromise: Promise<void> = Promise.resolve();
  private readonly databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  private readonly sql = this.databaseUrl ? neon(this.databaseUrl) : null;
  private readonly readyPromise: Promise<void>;

  constructor() {
    const catalog = this.createCatalog();
    const player = this.loadPlayerState() ?? this.createEmptyPlayerState(catalog);
    this.state = this.assemble(catalog, player);
    this.readyPromise = this.sql ? this.hydrateFromPostgres() : Promise.resolve();
  }

  /** Connecte Neon (comptes / collections) et vérifie que le catalogue est bien bundlé. */
  public async ready(): Promise<void> {
    if (process.env.VERCEL && !this.sql) {
      throw new Error('La variable de connexion Neon est manquante. Ajoutez DATABASE_URL dans les paramètres Vercel.');
    }
    if (process.env.VERCEL && this.state.cards.length < MIN_CATALOG_CARDS) {
      throw new Error(
        `Catalogue introuvable (${this.state.cards.length} cartes). Vérifiez que server/data/wikiFullCatalog.json est déployé.`
      );
    }
    return this.readyPromise;
  }

  private catalogSlice(): CatalogSlice {
    return {
      cards: this.state.cards,
      wikiPages: this.state.wikiPages,
      wikiViewStats: this.state.wikiViewStats,
    };
  }

  private assemble(catalog: CatalogSlice, player: PlayerState): DatabaseSchema {
    this.applyThresholds(catalog.cards, player.config);
    return {
      ...player,
      cards: catalog.cards,
      wikiPages: catalog.wikiPages,
      wikiViewStats: catalog.wikiViewStats,
    };
  }

  private applyThresholds(cards: CardRecord[], config: SystemConfig): void {
    const thresholds = config?.rarityThresholds || DEFAULT_THRESHOLDS;
    const year = config?.currentRarityYear || new Date().getFullYear();
    const ranked = [...cards].sort((a, b) => b.annualViews - a.annualViews);
    const total = ranked.length || 1;
    ranked.forEach((item, index) => {
      const percentileRank = Number((((index + 1) / total) * 100).toFixed(3));
      item.rarity = computeRarityForPercentile(percentileRank, thresholds);
      item.rarityYear = year;
    });
  }

  private async hydrateFromPostgres(): Promise<void> {
    if (!this.sql) return;
    await this.sql`CREATE TABLE IF NOT EXISTS gl_collector_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL DEFAULT 1,
      payload TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await this.sql`ALTER TABLE gl_collector_state ADD COLUMN IF NOT EXISTS payload TEXT`;
    const initialPayload = this.encodePlayer(this.state);
    await this.sql`INSERT INTO gl_collector_state (id, version, payload)
      VALUES (1, 1, ${initialPayload})
      ON CONFLICT (id) DO NOTHING`;
    const rows = await this.sql`SELECT payload FROM gl_collector_state WHERE id = 1` as Array<{ payload: string | null }>;
    if (!rows[0]?.payload) return;

    const decoded = this.decodePayload(rows[0].payload);
    const legacyCatalog = Array.isArray(decoded.cards) && (decoded.cards as unknown[]).length > 0;
    const player = extractPlayerState(decoded);
    this.state = this.assemble(this.catalogSlice(), player);
    if (legacyCatalog) {
      await this.sql`UPDATE gl_collector_state
        SET payload = ${this.encodePlayer(this.state)}, version = version + 1, updated_at = NOW()
        WHERE id = 1`;
    }
  }

  private encodePlayer(state: DatabaseSchema): string {
    return gzipSync(JSON.stringify(extractPlayerState(state))).toString('base64');
  }

  private decodePayload(payload: string): Partial<DatabaseSchema> & Record<string, unknown> {
    try {
      return JSON.parse(gunzipSync(Buffer.from(payload, 'base64')).toString('utf-8'));
    } catch {
      return JSON.parse(payload);
    }
  }

  public async transaction<T>(fn: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
    let release: () => void = () => {};
    const prevLock = this.lockPromise;
    this.lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    await prevLock;
    try {
      await this.ready();
      if (this.sql) return await this.postgresTransaction(fn);
      const snapshot = JSON.stringify(this.state);
      try {
        const result = await fn(this.state);
        this.persist();
        return result;
      } catch (err) {
        this.state = JSON.parse(snapshot);
        throw err;
      }
    } finally {
      release();
    }
  }

  /**
   * Neon est partagé par plusieurs fonctions Vercel : le numéro de version évite
   * qu'une écriture concurrente n'écrase la progression d'un autre joueur.
   */
  private async postgresTransaction<T>(fn: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
    if (!this.sql) throw new Error('Connexion PostgreSQL indisponible.');
    for (let attempt = 0; attempt < 3; attempt++) {
      const rows = await this.sql`SELECT version, payload FROM gl_collector_state WHERE id = 1` as Array<{ version: number | string; payload: string }>;
      const row = rows[0];
      if (!row) throw new Error('État PostgreSQL introuvable.');
      const snapshot = this.decodePayload(row.payload);
      this.state = this.assemble(this.catalogSlice(), extractPlayerState(snapshot));
      const result = await fn(this.state);
      const saved = await this.sql`UPDATE gl_collector_state
        SET payload = ${this.encodePlayer(this.state)}, version = version + 1, updated_at = NOW()
        WHERE id = 1 AND version = ${Number(row.version)}
        RETURNING version`;
      if (saved.length > 0) return result;
    }
    throw new Error('Une autre opération est en cours. Réessayez dans un instant.');
  }

  public persist(): void {
    if (this.sql) return;
    try {
      const dir = path.dirname(PLAYER_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(PLAYER_FILE_PATH, JSON.stringify(extractPlayerState(this.state), null, 2), 'utf-8');
    } catch {
      // Memory fallback
    }
  }

  public logAudit(actorId: string | null, action: string, details: string): void {
    this.state.auditLogs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actorId,
      action,
      details,
    });
    if (this.state.auditLogs.length > 300) {
      this.state.auditLogs.length = 300;
    }
  }

  private loadPlayerState(): PlayerState | null {
    const candidates = [PLAYER_FILE_PATH, LEGACY_DB_FILE_PATH];
    for (const filePath of candidates) {
      try {
        if (!fs.existsSync(filePath)) continue;
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<DatabaseSchema> & Record<string, unknown>;
        if (parsed?.users && parsed?.config) {
          return extractPlayerState(parsed);
        }
      } catch {
        // Ignore
      }
    }
    return null;
  }

  private createCatalog(): CatalogSlice {
    const thresholds = DEFAULT_THRESHOLDS;

    // Charger l'intégralité des 7959 articles de One Piece Fandom FR
    let rawCatalog: Array<{ fandomPageId: number; title: string }> = [];
    if (fs.existsSync(CATALOG_FILE_PATH)) {
      try {
        rawCatalog = JSON.parse(fs.readFileSync(CATALOG_FILE_PATH, 'utf-8'));
      } catch {
        // Fallback
      }
    }

    if (rawCatalog.length === 0) {
      for (const title of Object.keys(FAMOUS_ENTITIES)) {
        rawCatalog.push({ fandomPageId: Math.floor(1000 + Math.random() * 9000), title });
      }
    }

    const sortedItems = rawCatalog.map((item, index) => {
      const famous = FAMOUS_ENTITIES[item.title];
      let views = 0;
      let category = '';
      let summary = '';

      if (famous) {
        views = famous.views;
        category = famous.category;
        summary = famous.summary;
      } else {
        const detected = detectCategoryAndSummary(item.title);
        category = detected.category;
        summary = detected.summary;
        const rank = index + 1;
        const baseViews = Math.round(1800000 / Math.pow(rank + 10, 0.65));
        const variance = ((item.fandomPageId * 17) % 2500) - 1200;
        views = Math.max(350, baseViews + variance);
      }

      return {
        fandomPageId: item.fandomPageId,
        title: item.title,
        views,
        category,
        summary,
      };
    }).sort((a, b) => b.views - a.views);

    const wikiPages: WikiPageRecord[] = [];
    const wikiViewStats: WikiViewStatRecord[] = [];
    const cards: CardRecord[] = [];
    const total = sortedItems.length || 1;

    sortedItems.forEach((item, index) => {
      const wikiPageId = `wp-${item.fandomPageId}`;
      const cardId = `card-${item.fandomPageId}`;
      const encoded = encodeURIComponent(item.title.replace(/ /g, '_'));
      const sourceUrl = `https://onepiece.fandom.com/fr/wiki/${encoded}`;
      const percentileRank = Number((((index + 1) / total) * 100).toFixed(3));
      const assignedRarity = computeRarityForPercentile(percentileRank, thresholds);

      wikiPages.push({
        id: wikiPageId,
        fandomPageId: item.fandomPageId,
        title: item.title,
        summary: item.summary,
        category: item.category,
        sourceUrl,
        lastSyncedAt: '2026-01-01T00:00:00.000Z',
      });

      wikiViewStats.push({
        id: `stat-${item.fandomPageId}-2026`,
        wikiPageId,
        year: 2026,
        annualViews: item.views,
        recordedAt: '2026-01-01T00:00:00.000Z',
      });

      cards.push({
        id: cardId,
        wikiPageId,
        fandomPageId: item.fandomPageId,
        name: item.title,
        description: item.summary,
        category: item.category,
        sourceUrl,
        rarity: assignedRarity,
        annualViews: item.views,
        rarityYear: 2026,
        active: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    return { wikiPages, wikiViewStats, cards };
  }

  private createEmptyPlayerState(catalog: CatalogSlice): PlayerState {
    const now = new Date();
    const p1 = hashPassword('GrandLine2026!');
    const userId = 'user-capitaine';
    const config: SystemConfig = {
      rarityThresholds: { ...DEFAULT_THRESHOLDS },
      currentRarityYear: now.getFullYear(),
      lastAnnualCalculationAt: now.toISOString(),
      cardsPerBooster: 5,
      boosterRechargeMinutes: 10,
      maxBoosters: 10,
      boosterProbabilities: {
        COMMUNE: 60,
        PEU_COMMUNE: 25,
        RARE: 10,
        EPIQUE: 4,
        LEGENDAIRE: 0.9,
        MYTHIQUE: 0.1,
      },
    };

    return {
      config,
      users: [
        {
          id: userId,
          email: 'capitaine@onepiece-cards.fr',
          username: 'Capitaine_Archiviste',
          passwordHash: p1.hash,
          passwordSalt: p1.salt,
          emailVerified: true,
          verificationToken: null,
          resetPasswordToken: null,
          resetTokenExpiresAt: null,
          role: 'ADMIN',
          suspended: false,
          coins: 1000,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
      sessions: {},
      cardOwnerships: [],
      boosterInventories: [
        {
          id: 'bi-1',
          userId,
          storedBoosters: 10,
          lastRechargeAt: now.toISOString(),
        },
      ],
      boosterOpenings: [],
      auctions: [],
      bids: [],
      transactions: [
        {
          id: 'tx-welcome',
          userId,
          username: 'Capitaine_Archiviste',
          amount: 1000,
          type: 'BONUS_BIENVENUE',
          reference: 'Dotation de bienvenue — Inscription',
          balanceBefore: 0,
          balanceAfter: 1000,
          createdAt: now.toISOString(),
        },
      ],
      notifications: [
        {
          id: 'notif-welcome',
          userId,
          type: 'BOOSTER_DISPONIBLE',
          message: 'Bienvenue sur GL Collector ! Vous avez 10 boosters prêts à être ouverts.',
          read: false,
          createdAt: now.toISOString(),
        },
      ],
      importLogs: [
        {
          id: 'imp-fandom-full',
          startedAt: '2026-01-01T00:00:00.000Z',
          completedAt: '2026-01-01T00:00:05.000Z',
          source: 'GL Collector Database Index',
          pagesImported: catalog.cards.length,
          pagesUpdated: 0,
          pagesSkipped: 0,
          errors: [],
          status: 'SUCCES',
        },
      ],
      rarityCalculations: [],
      rarityRuns: [
        {
          id: 'run-2026',
          year: 2026,
          calculatedAt: '2026-01-01T00:00:00.000Z',
          totalCards: catalog.cards.length,
          changedCount: 0,
          thresholds: { ...DEFAULT_THRESHOLDS },
          distribution: {
            MYTHIQUE: catalog.cards.filter((c) => c.rarity === 'MYTHIQUE').length,
            LEGENDAIRE: catalog.cards.filter((c) => c.rarity === 'LEGENDAIRE').length,
            EPIQUE: catalog.cards.filter((c) => c.rarity === 'EPIQUE').length,
            RARE: catalog.cards.filter((c) => c.rarity === 'RARE').length,
            PEU_COMMUNE: catalog.cards.filter((c) => c.rarity === 'PEU_COMMUNE').length,
            COMMUNE: catalog.cards.filter((c) => c.rarity === 'COMMUNE').length,
          },
        },
      ],
      auditLogs: [
        {
          id: 'aud-seed',
          timestamp: now.toISOString(),
          actorId: 'SYSTEM',
          action: 'FULL_WIKI_INITIALIZATION',
          details: `Catalogue embarqué : ${catalog.cards.length} cartes.`,
        },
      ],
      globalMintCounter: 1,
    };
  }
}

export const db = new DatabaseEngine();
