import crypto from 'crypto';
import { computeRarityForPercentile, db } from '../db.js';
import {
  Rarity,
  RarityCalculationRecord,
  RarityRunSummary,
  RarityThresholds,
} from '../../src/types/index.js';

export class RarityService {
  public static async runAnnualRarityCalculation(targetYear?: number): Promise<{
    summary: RarityRunSummary;
    calculations: RarityCalculationRecord[];
  }> {
    return db.transaction((state) => {
      const year = targetYear || state.config.currentRarityYear;
      const thresholds = state.config.rarityThresholds;
      const now = new Date().toISOString();

      const ranked = [...state.cards].sort((a, b) => b.annualViews - a.annualViews);
      const total = ranked.length;
      const distribution: Record<Rarity, number> = {
        MYTHIQUE: 0,
        LEGENDAIRE: 0,
        EPIQUE: 0,
        RARE: 0,
        PEU_COMMUNE: 0,
        COMMUNE: 0,
      };

      state.rarityCalculations = state.rarityCalculations.filter((rc) => rc.year !== year);
      state.rarityRuns = state.rarityRuns.filter((r) => r.year !== year);

      const newCalculations: RarityCalculationRecord[] = [];
      let changedCount = 0;

      ranked.forEach((item, index) => {
        const percentileRank = Number((((index + 1) / total) * 100).toFixed(3));
        const assignedRarity = computeRarityForPercentile(percentileRank, thresholds);
        const previousRarity = item.rarity;

        if (previousRarity !== assignedRarity) {
          changedCount++;
        }

        item.rarity = assignedRarity;
        item.rarityYear = year;
        item.updatedAt = now;

        distribution[assignedRarity]++;

        const calcRecord: RarityCalculationRecord = {
          id: `rc-${item.fandomPageId}-${year}-${crypto.randomUUID().slice(0, 4)}`,
          cardId: item.id,
          cardName: item.name,
          year,
          annualViews: item.annualViews,
          percentileRank,
          previousRarity,
          assignedRarity,
          calculatedAt: now,
        };
        newCalculations.push(calcRecord);
        state.rarityCalculations.push(calcRecord);
      });

      state.config.currentRarityYear = year;
      state.config.lastAnnualCalculationAt = now;

      const summary: RarityRunSummary = {
        id: `run-${year}-${crypto.randomUUID().slice(0, 4)}`,
        year,
        calculatedAt: now,
        totalCards: total,
        changedCount,
        thresholds: { ...thresholds },
        distribution,
      };
      state.rarityRuns.unshift(summary);

      db.logAudit(
        'ADMIN',
        'ANNUAL_RARITY_CALCULATION',
        `Calcul annuel ${year} effectué sur ${total} cartes (${changedCount} changements de rareté).`
      );

      return {
        summary,
        calculations: newCalculations.slice(0, 150),
      };
    });
  }

  public static async updateThresholds(newThresholds: RarityThresholds): Promise<RarityThresholds> {
    if (
      newThresholds.MYTHIQUE <= 0 ||
      newThresholds.LEGENDAIRE <= newThresholds.MYTHIQUE ||
      newThresholds.EPIQUE <= newThresholds.LEGENDAIRE ||
      newThresholds.RARE <= newThresholds.EPIQUE ||
      newThresholds.PEU_COMMUNE <= newThresholds.RARE ||
      newThresholds.PEU_COMMUNE >= 100
    ) {
      throw new Error(
        'Les seuils centiles doivent être strictement croissants (ex: 1% < 5% < 10% < 25% < 50% < 100%).'
      );
    }

    return db.transaction((state) => {
      state.config.rarityThresholds = { ...newThresholds };
      return state.config.rarityThresholds;
    });
  }
}
