import crypto from 'crypto';
import { db } from '../db.js';
import { CardRecord, WikiImportLog, WikiPageRecord } from '../../src/types/index.js';

export class WikiImportService {
  private static readonly FANDOM_API_BASE = 'https://onepiece.fandom.com/fr/api.php';
  private static readonly FANDOM_WIKI_BASE = 'https://onepiece.fandom.com/fr/wiki/';

  public static async fetchArticleWikitext(title: string): Promise<string> {
    try {
      const url = `${this.FANDOM_API_BASE}?action=query&titles=${encodeURIComponent(
        title
      )}&prop=revisions&rvprop=content&rvslots=main&format=json`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json() as { query?: { pages?: Record<string, { revisions?: Array<{ slots?: { main?: { '*'?: string } } }> }> } };
        const page = Object.values(json.query?.pages || {})[0];
        const raw = page?.revisions?.[0]?.slots?.main?.['*'] || '';
        // Nettoyage rapide des balises et modèles pour obtenir le paragraphe d'introduction
        const cleaned = raw
          .replace(/\{\{[^}]*\}\}/g, '')
          .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
          .replace(/<[^>]*>/g, '')
          .replace(/'''?/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned.length > 50) {
          return cleaned.slice(0, 800);
        }
      }
    } catch {
      // Fallback
    }
    return '';
  }

  public static async syncFromFandom(options?: {
    searchQuery?: string;
    limit?: number;
  }): Promise<WikiImportLog> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    let pagesImported = 0;
    let pagesUpdated = 0;
    const pagesSkipped = 0;

    const query = (options?.searchQuery || '').trim();
    const limit = Math.min(50, Math.max(1, options?.limit || 10));

    try {
      const url = `${this.FANDOM_API_BASE}?action=query&list=search&srsearch=${encodeURIComponent(
        query || 'One Piece'
      )}&srlimit=${limit}&format=json`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json() as { query?: { search?: Array<{ pageid: number; title: string }> } };
        const results = json.query?.search || [];

        await db.transaction((state) => {
          const now = new Date().toISOString();
          for (const item of results) {
            const existing = state.cards.find(
              (c) => c.fandomPageId === item.pageid || c.name.toLowerCase() === item.title.toLowerCase()
            );
            if (existing) {
              existing.name = item.title;
              existing.updatedAt = now;
              pagesUpdated++;
            } else {
              const wpId = `wp-${item.pageid}`;
              const cardId = `card-${item.pageid}`;
              const enc = encodeURIComponent(item.title.replace(/ /g, '_'));

              state.wikiPages.push({
                id: wpId,
                fandomPageId: item.pageid,
                title: item.title,
                summary: `Fiche encyclopédique consacrée à ${item.title}.`,
                category: 'Encyclopédie GL',
                sourceUrl: `${this.FANDOM_WIKI_BASE}${enc}`,
                lastSyncedAt: now,
              });

              state.cards.push({
                id: cardId,
                wikiPageId: wpId,
                fandomPageId: item.pageid,
                name: item.title,
                description: `Fiche encyclopédique consacrée à ${item.title}.`,
                category: 'Encyclopédie GL',
                sourceUrl: `${this.FANDOM_WIKI_BASE}${enc}`,
                rarity: 'COMMUNE',
                annualViews: 15000,
                rarityYear: state.config.currentRarityYear,
                active: true,
                updatedAt: now,
              });
              pagesImported++;
            }
          }
        });
      }
    } catch (e) {
      errors.push((e as Error).message);
    }

    const log: WikiImportLog = {
      id: `imp-${crypto.randomUUID().slice(0, 8)}`,
      startedAt,
      completedAt: new Date().toISOString(),
      source: 'GL Collector Database',
      pagesImported,
      pagesUpdated,
      pagesSkipped,
      errors,
      status: errors.length === 0 ? 'SUCCES' : 'PARTIEL',
    };

    db.state.importLogs.unshift(log);
    return log;
  }
}
