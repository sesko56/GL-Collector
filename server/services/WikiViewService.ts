import { db } from '../db.js';
import { WikiViewStatRecord } from '../../src/types/index.js';

export class WikiViewService {
  public static getStatisticsForYear(year: number): Array<{
    stat: WikiViewStatRecord;
    pageTitle: string;
    category: string;
    sourceUrl: string;
  }> {
    const state = db.state;
    return state.wikiViewStats
      .filter((s) => s.year === year)
      .slice(0, 200)
      .map((stat) => {
        const page = state.wikiPages.find((w) => w.id === stat.wikiPageId);
        return {
          stat,
          pageTitle: page?.title || 'Page inconnue',
          category: page?.category || 'Divers',
          sourceUrl: page?.sourceUrl || 'https://onepiece.fandom.com/fr/wiki/One_Piece_Encyclop%C3%A9die',
        };
      })
      .sort((a, b) => b.stat.annualViews - a.stat.annualViews);
  }

  public static async updatePageAnnualViews(
    cardId: string,
    year: number,
    annualViews: number
  ): Promise<void> {
    if (annualViews < 0) {
      throw new Error('Le nombre de visites ne peut pas être négatif.');
    }
    await db.transaction((state) => {
      const card = state.cards.find((c) => c.id === cardId);
      if (!card) throw new Error('Carte introuvable.');

      const existingStat = state.wikiViewStats.find(
        (s) => s.wikiPageId === card.wikiPageId && s.year === year
      );
      if (existingStat) {
        existingStat.annualViews = Math.floor(annualViews);
        existingStat.recordedAt = new Date().toISOString();
      } else {
        state.wikiViewStats.push({
          id: `stat-${card.fandomPageId}-${year}`,
          wikiPageId: card.wikiPageId,
          year,
          annualViews: Math.floor(annualViews),
          recordedAt: new Date().toISOString(),
        });
      }
    });
  }
}
