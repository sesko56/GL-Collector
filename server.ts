import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { db, StoredUser } from './server/db.js';
import { AuctionService } from './server/services/AuctionService.js';
import { BoosterService } from './server/services/BoosterService.js';
import { CollectionService } from './server/services/CollectionService.js';
import { NotificationService } from './server/services/NotificationService.js';
import { RarityService } from './server/services/RarityService.js';
import { UserService } from './server/services/UserService.js';
import { WikiImportService } from './server/services/WikiImportService.js';
import { WikiViewService } from './server/services/WikiViewService.js';

interface AuthenticatedRequest extends Request {
  user?: StoredUser;
  sessionToken?: string;
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const recentIdempotencyKeys = new Map<string, number>();

function rateLimitMiddleware(maxRequests = 150, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'local'}:${req.path}`;
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > maxRequests) {
        res.status(429).json({ error: 'Trop de requêtes. Veuillez patienter.' });
        return;
      }
    }

    const idempotencyKey = req.header('x-idempotency-key');
    if (idempotencyKey && req.method === 'POST') {
      const prevTime = recentIdempotencyKeys.get(idempotencyKey);
      if (prevTime && now - prevTime < 5000) {
        res.status(409).json({ error: 'Opération en cours de traitement.' });
        return;
      }
      recentIdempotencyKeys.set(idempotencyKey, now);
    }
    next();
  };
}

function attachUserMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : req.header('x-session-token')?.trim();

  if (token && db.state.sessions[token]) {
    const sess = db.state.sessions[token];
    const foundUser = db.state.users.find((u) => u.id === sess.userId);
    if (foundUser && !foundUser.suspended) {
      req.user = foundUser;
      req.sessionToken = token;
    }
  }
  next();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Veuillez vous connecter.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Accès administrateur requis.' });
    return;
  }
  next();
}

/** Crée l'API réutilisable localement et par la fonction serverless Vercel. */
export async function createApp(includeFrontend = false) {
  await db.ready();
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', rateLimitMiddleware(), attachUserMiddleware);

  // Bootstrap
  app.get('/api/bootstrap', async (req: AuthenticatedRequest, res: Response) => {
    try {
      await AuctionService.listAuctions();
      const activeUser = req.user || null;
      const publicProfile = activeUser ? UserService.toPublicProfileInTx(db.state, activeUser) : null;

      const showcaseCards = [...db.state.cards]
        .filter((c) => c.active)
        .sort((a, b) => b.annualViews - a.annualViews)
        .slice(0, 12);

      const demoAccounts: Array<{ id: string; username: string; role: string; coins: number }> = [];

      res.json({
        user: publicProfile,
        config: db.state.config,
        showcaseCards,
        totalCatalogCards: db.state.cards.filter((c) => c.active).length,
        openAuctionsCount: db.state.auctions.filter((a) => a.status === 'OUVERTE').length,
        demoAccounts,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Live article text fetch from onepiece.fandom.com/fr
  app.get('/api/cards/article-text', async (req: Request, res: Response) => {
    const title = String(req.query.title || '');
    if (!title) {
      res.json({ text: '' });
      return;
    }
    const text = await WikiImportService.fetchArticleWikitext(title);
    res.json({ text });
  });

  // Auth routes
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { username, password, confirmPassword } = req.body;
      const result = await UserService.register({
        username: String(username || ''),
        password: String(password || ''),
        confirmPassword: String(confirmPassword || ''),
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body;
      const result = await UserService.login({
        identifier: String(identifier || ''),
        password: String(password || ''),
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/quick-switch', async (req: Request, res: Response) => {
    res.status(403).json({ error: 'Le changement rapide de compte est désactivé pour protéger les joueurs.' });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    if (req.sessionToken && db.state.sessions[req.sessionToken]) {
      delete db.state.sessions[req.sessionToken];
      db.persist();
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      await UserService.changePassword(
        req.user!.id,
        String(currentPassword || ''),
        String(newPassword || ''),
        String(confirmPassword || '')
      );
      res.json({ ok: true, message: 'Mot de passe modifié.' });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/delete-account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { password } = req.body;
      await UserService.deleteAccount(req.user!.id, String(password || ''));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Boosters
  app.get('/api/boosters/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const state = BoosterService.getBoosterState(req.user!.id);
      res.json({
        boosterState: state,
        probabilities: db.state.config.boosterProbabilities,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/boosters/open', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await BoosterService.openBooster(req.user!.id);
      const userProfile = UserService.toPublicProfileInTx(db.state, req.user!);
      res.json({ ...result, user: userProfile });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  
  // Collection (with pagination across 7,959 articles)
  app.get('/api/collection', async (req: AuthenticatedRequest, res: Response) => {
    try {
      await db.ready();

      const { search, rarity, category, ownership, sort, page, limit } = req.query;
      const overview = CollectionService.getUserCollection(req.user?.id || null, {
        search: typeof search === 'string' ? search : undefined,
        rarity: (typeof rarity === 'string' ? rarity : 'ALL') as any,
        category: typeof category === 'string' ? category : undefined,
        ownership: (typeof ownership === 'string' ? ownership : 'ALL') as any,
        sort: (typeof sort === 'string' ? sort : 'VIEWS_DESC') as any,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 36,
      });
      res.json(overview);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });



  // Auctions
  app.get('/api/auctions', async (_req: Request, res: Response) => {
    try {
      const auctions = await AuctionService.listAuctions();
      res.json({ auctions });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auctions/create', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { cardOwnershipId, startingPrice, durationMinutes } = req.body;
      const auction = await AuctionService.createAuction({
        sellerId: req.user!.id,
        cardOwnershipId: String(cardOwnershipId || ''),
        startingPrice: Number(startingPrice),
        durationMinutes: Number(durationMinutes || 60),
      });
      const userProfile = UserService.toPublicProfileInTx(db.state, req.user!);
      res.status(201).json({ auction, user: userProfile });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auctions/:id/bid', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { amount } = req.body;
      const auction = await AuctionService.placeBid({
        auctionId: req.params.id,
        bidderId: req.user!.id,
        amount: Number(amount),
      });
      const userProfile = UserService.toPublicProfileInTx(db.state, req.user!);
      res.json({ auction, user: userProfile });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auctions/:id/settle', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const auction = await AuctionService.settleAuctionNow(req.params.id, req.user!.id);
      const userProfile = UserService.toPublicProfileInTx(db.state, req.user!);
      res.json({ auction, user: userProfile });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auctions/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      const auction = await AuctionService.cancelAuction(req.params.id, req.user!.id, isAdmin);
      const userProfile = UserService.toPublicProfileInTx(db.state, req.user!);
      res.json({ auction, user: userProfile });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Transactions & Notifications
  app.get('/api/transactions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const list = db.state.transactions.filter((t) => t.userId === req.user!.id);
    res.json({ transactions: list });
  });

  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const notifications = NotificationService.getForUser(req.user!.id);
    res.json({ notifications });
  });

  app.post('/api/notifications/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { notificationId } = req.body || {};
    const notifications = await NotificationService.markAsRead(req.user!.id, notificationId);
    res.json({ notifications });
  });

  // Admin
  app.get('/api/admin/overview', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const users = db.state.users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      suspended: u.suspended,
      coins: u.coins,
      createdAt: u.createdAt,
      ownedCount: db.state.cardOwnerships.filter((co) => co.userId === u.id).length,
      auctionsCount: db.state.auctions.filter((a) => a.sellerId === u.id).length,
      txCount: db.state.transactions.filter((t) => t.userId === u.id).length,
    }));

    res.json({
      config: db.state.config,
      users,
      cardsCount: db.state.cards.length,
      sampleCards: db.state.cards.slice(0, 50),
      importLogs: db.state.importLogs,
      rarityRuns: db.state.rarityRuns,
      auctions: db.state.auctions,
      transactions: db.state.transactions.slice(0, 100),
      auditLogs: db.state.auditLogs.slice(0, 50),
    });
  });

  app.post('/api/admin/rarity/calculate', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { year } = req.body || {};
      const result = await RarityService.runAnnualRarityCalculation(year ? Number(year) : undefined);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/rarity/thresholds', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { thresholds } = req.body;
      const updated = await RarityService.updateThresholds(thresholds);
      res.json({ thresholds: updated });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/boosters/config', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { cardsPerBooster, boosterRechargeMinutes, maxBoosters, probabilities } = req.body;
      await db.transaction((state) => {
        if (cardsPerBooster) state.config.cardsPerBooster = Number(cardsPerBooster);
        if (boosterRechargeMinutes) state.config.boosterRechargeMinutes = Number(boosterRechargeMinutes);
        if (maxBoosters) state.config.maxBoosters = Number(maxBoosters);
        if (probabilities) state.config.boosterProbabilities = probabilities;
      });
      res.json({ config: db.state.config });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/import', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { searchQuery, limit } = req.body || {};
      const log = await WikiImportService.syncFromFandom({ searchQuery, limit });
      res.json({ log });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  if (includeFrontend) {
    // Vite middleware / Static (uniquement pour l'exécution locale).
    if (process.env.NODE_ENV !== 'production') {
	const { createServer: createViteServer } = await import('vite');		
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }
  }

  return app;
}

async function startServer() {
  const app = await createApp(true);
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GL Collector server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) startServer();
