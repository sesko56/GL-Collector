import crypto from 'crypto';
import { DatabaseSchema, db } from '../db.js';
import {
  BoosterOpeningResult,
  BoosterProbabilities,
  BoosterState,
  CardOwnershipRecord,
  CardRecord,
  Rarity,
} from '../../src/types/index.js';
import { NotificationService } from './NotificationService.js';

export class BoosterService {
  public static synchronizeUserBoostersInTx(state: DatabaseSchema, userId: string): BoosterState {
    const maxBoosters = state.config.maxBoosters;
    const rechargeMinutes = state.config.boosterRechargeMinutes;
    const intervalMs = rechargeMinutes * 60 * 1000;
    const nowMs = Date.now();

    let inv = state.boosterInventories.find((b) => b.userId === userId);
    if (!inv) {
      inv = {
        id: `bi-${crypto.randomUUID().slice(0, 8)}`,
        userId,
        storedBoosters: 5,
        lastRechargeAt: new Date(nowMs).toISOString(),
      };
      state.boosterInventories.push(inv);
    }

    if (inv.storedBoosters >= maxBoosters) {
      inv.storedBoosters = maxBoosters;
      inv.lastRechargeAt = new Date(nowMs).toISOString();
      return {
        availableBoosters: inv.storedBoosters,
        maxBoosters,
        secondsUntilNextBooster: null,
        rechargeMinutes,
        cardsPerBooster: state.config.cardsPerBooster,
        lastRechargeAt: inv.lastRechargeAt,
      };
    }

    const lastMs = new Date(inv.lastRechargeAt).getTime();
    const elapsedMs = Math.max(0, nowMs - lastMs);
    const earned = Math.floor(elapsedMs / intervalMs);

    if (earned > 0) {
      const previousCount = inv.storedBoosters;
      const nextCount = Math.min(maxBoosters, inv.storedBoosters + earned);
      inv.storedBoosters = nextCount;

      if (nextCount >= maxBoosters) {
        inv.lastRechargeAt = new Date(nowMs).toISOString();
      } else {
        inv.lastRechargeAt = new Date(lastMs + earned * intervalMs).toISOString();
      }

      if (nextCount > previousCount) {
        NotificationService.pushInTx(
          state,
          userId,
          'BOOSTER_DISPONIBLE',
          `Votre booster est disponible (${nextCount}/${maxBoosters} en réserve).`
        );
      }
    }

    let secondsUntilNextBooster: number | null = null;
    if (inv.storedBoosters < maxBoosters) {
      const updatedLastMs = new Date(inv.lastRechargeAt).getTime();
      const remainingMs = Math.max(0, intervalMs - (nowMs - updatedLastMs));
      secondsUntilNextBooster = Math.ceil(remainingMs / 1000);
    }

    return {
      availableBoosters: inv.storedBoosters,
      maxBoosters,
      secondsUntilNextBooster,
      rechargeMinutes,
      cardsPerBooster: state.config.cardsPerBooster,
      lastRechargeAt: inv.lastRechargeAt,
    };
  }

  public static getBoosterState(userId: string): BoosterState {
    return this.synchronizeUserBoostersInTx(db.state, userId);
  }

  private static rollRarity(probabilities: BoosterProbabilities): Rarity {
    const order: Rarity[] = [
      'MYTHIQUE',
      'LEGENDAIRE',
      'EPIQUE',
      'RARE',
      'PEU_COMMUNE',
      'COMMUNE',
    ];
    const totalWeight = order.reduce((acc, r) => acc + (probabilities[r] || 0), 0);
    const roll = Math.random() * (totalWeight > 0 ? totalWeight : 100);
    let cumulative = 0;
    for (const rarity of order) {
      cumulative += probabilities[rarity] || 0;
      if (roll <= cumulative) {
        return rarity;
      }
    }
    return 'COMMUNE';
  }

  public static async openBooster(userId: string): Promise<BoosterOpeningResult> {
    return db.transaction((state) => {
      const user = state.users.find((u) => u.id === userId);
      if (!user) throw new Error('Utilisateur introuvable.');
      if (user.suspended) throw new Error('Ce compte est suspendu.');

      const currentState = this.synchronizeUserBoostersInTx(state, userId);
      if (currentState.availableBoosters <= 0) {
        throw new Error(
          `Aucun booster disponible. Prochain booster dans ${currentState.secondsUntilNextBooster ?? 600} secondes.`
        );
      }

      const inv = state.boosterInventories.find((b) => b.userId === userId)!;
      const wasAtMax = inv.storedBoosters >= state.config.maxBoosters;
      inv.storedBoosters -= 1;
      if (wasAtMax) {
        inv.lastRechargeAt = new Date().toISOString();
      }

      const activeCards = state.cards.filter((c) => c.active);
      if (activeCards.length === 0) {
        throw new Error("Aucune carte active n'est disponible dans l'encyclopédie.");
      }

      const cardsByRarity = new Map<Rarity, CardRecord[]>();
      for (const c of activeCards) {
        const list = cardsByRarity.get(c.rarity) || [];
        list.push(c);
        cardsByRarity.set(c.rarity, list);
      }

      const openingId = `open-${crypto.randomUUID().slice(0, 8)}`;
      const openedAt = new Date().toISOString();
      const countToDraw = state.config.cardsPerBooster;

      const drawnItems: BoosterOpeningResult['drawnItems'] = [];
      const ownershipIds: string[] = [];
      const cardIds: string[] = [];

      for (let i = 0; i < countToDraw; i++) {
        const rolledRarity = this.rollRarity(state.config.boosterProbabilities);
        let pool = cardsByRarity.get(rolledRarity);
        if (!pool || pool.length === 0) {
          pool = activeCards;
        }
        const chosenCard = pool[Math.floor(Math.random() * pool.length)];

        const userOwnedForCard = state.cardOwnerships.filter(
          (co) => co.userId === userId && co.cardId === chosenCard.id
        );
        const isNewDiscovery = userOwnedForCard.length === 0;
        const maxSerial = userOwnedForCard.reduce(
          (max, item) => Math.max(max, item.serialNumber),
          0
        );
        const serialNumber = maxSerial + 1;

        const ownership: CardOwnershipRecord = {
          id: `own-${state.globalMintCounter}`,
          userId,
          cardId: chosenCard.id,
          serialNumber,
          globalMintNumber: state.globalMintCounter++,
          lockedForAuction: false,
          acquiredAt: openedAt,
          boosterOpeningId: openingId,
        };

        state.cardOwnerships.push(ownership);
        ownershipIds.push(ownership.id);
        cardIds.push(chosenCard.id);

        drawnItems.push({
          ownership,
          card: chosenCard,
          isNewDiscovery,
          totalOwnedAfter: userOwnedForCard.length + 1,
        });
      }

      state.boosterOpenings.unshift({
        id: openingId,
        userId,
        openedAt,
        ownershipIds,
        cardIds,
      });

      const notable = drawnItems
        .filter((d) => d.card.rarity === 'MYTHIQUE' || d.card.rarity === 'LEGENDAIRE' || d.card.rarity === 'EPIQUE')
        .map((d) => `${d.card.name} (${d.card.rarity})`);

      const notifMsg =
        notable.length > 0
          ? `Vous avez reçu une nouvelle carte remarquable : ${notable.join(', ')} lors de l'ouverture d'un booster.`
          : `Vous avez reçu ${drawnItems.length} nouvelles cartes dans votre collection.`;

      NotificationService.pushInTx(state, userId, 'NOUVELLE_CARTE', notifMsg);
      db.logAudit(
        userId,
        'BOOSTER_OPENED',
        `Ouverture booster ${openingId} : ${drawnItems.map((d) => `${d.card.name} #${d.ownership.serialNumber}`).join(', ')}`
      );

      const updatedBoosterState = this.synchronizeUserBoostersInTx(state, userId);

      return {
        openingId,
        openedAt,
        drawnItems,
        boosterState: updatedBoosterState,
      };
    });
  }
}
