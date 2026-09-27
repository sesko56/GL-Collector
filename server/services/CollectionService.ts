import { db } from '../db.js';
import { CardRecord, PopulatedCardOwnership, Rarity } from '../../src/types/index.js';

export interface CollectionOverview {
  totalOwnedCopies: number;
  uniqueOwnedCards: number;
  totalCatalogCards: number;
  byRarity: Record<Rarity, { ownedUnique: number; totalCatalog: number; totalCopies: number }>;
  categories: string[];
  cards: Array<{
    card: CardRecord;
    ownedCount: number;
    availableCount: number;
    lockedCount: number;
    instances: PopulatedCardOwnership[];
  }>;
}

export class CollectionService {
  public static getUserCollection(
    userId: string | null,
    options?: {
      search?: string;
      rarity?: Rarity | 'ALL';
      category?: string;
      ownership?: 'ALL' | 'OWNED' | 'DUPLICATES' | 'MISSING';
      sort?: 'VIEWS_DESC' | 'RARITY_DESC' | 'NAME_ASC' | 'OWNED_DESC';
      page?: number;
      limit?: number;
    }
  ): CollectionOverview & { totalFiltered: number; page: number; totalPages: number } {
    const state = db.state;
    const activeCards = state.cards.filter((c) => c.active);
    const userOwnerships = userId
      ? state.cardOwnerships.filter((co) => co.userId === userId)
      : [];

    const ownershipMap = new Map<string, PopulatedCardOwnership[]>();
    for (const own of userOwnerships) {
      const card = state.cards.find((c) => c.id === own.cardId);
      if (!card) continue;
      const list = ownershipMap.get(own.cardId) || [];
      list.push({ ...own, card });
      ownershipMap.set(own.cardId, list);
    }

    const byRarity: CollectionOverview['byRarity'] = {
      MYTHIQUE: { ownedUnique: 0, totalCatalog: 0, totalCopies: 0 },
      LEGENDAIRE: { ownedUnique: 0, totalCatalog: 0, totalCopies: 0 },
      EPIQUE: { ownedUnique: 0, totalCatalog: 0, totalCopies: 0 },
      RARE: { ownedUnique: 0, totalCatalog: 0, totalCopies: 0 },
      PEU_COMMUNE: { ownedUnique: 0, totalCatalog: 0, totalCopies: 0 },
      COMMUNE: { ownedUnique: 0, totalCatalog: 0, totalCopies: 0 },
    };

    const categoriesSet = new Set<string>();
    let uniqueOwnedCards = 0;

    for (const card of activeCards) {
      categoriesSet.add(card.category);
      byRarity[card.rarity].totalCatalog += 1;
      const instances = ownershipMap.get(card.id) || [];
      if (instances.length > 0) {
        uniqueOwnedCards += 1;
        byRarity[card.rarity].ownedUnique += 1;
        byRarity[card.rarity].totalCopies += instances.length;
      }
    }

    // Filtrage dynamique pour gérer avec fluidité les 7959 cartes
    const q = (options?.search || '').trim().toLowerCase();
    const rarityF = options?.rarity || 'ALL';
    const catF = options?.category || 'ALL';
    const ownF = options?.ownership || 'ALL';
    const sortF = options?.sort || 'VIEWS_DESC';
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(12, options?.limit || 36));

    const rarityRanks: Record<Rarity, number> = {
      MYTHIQUE: 6,
      LEGENDAIRE: 5,
      EPIQUE: 4,
      RARE: 3,
      PEU_COMMUNE: 2,
      COMMUNE: 1,
    };

    const filtered = activeCards.filter((card) => {
      if (rarityF !== 'ALL' && card.rarity !== rarityF) return false;
      if (catF !== 'ALL' && card.category !== catF) return false;

      const instances = ownershipMap.get(card.id) || [];
      const ownedCount = instances.length;

      if (ownF === 'OWNED' && ownedCount === 0) return false;
      if (ownF === 'DUPLICATES' && ownedCount < 2) return false;
      if (ownF === 'MISSING' && ownedCount > 0) return false;

      if (q) {
        const inName = card.name.toLowerCase().includes(q);
        const inCat = card.category.toLowerCase().includes(q);
        if (!inName && !inCat) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      const ownA = (ownershipMap.get(a.id) || []).length;
      const ownB = (ownershipMap.get(b.id) || []).length;

      if (sortF === 'VIEWS_DESC') return b.annualViews - a.annualViews;
      if (sortF === 'RARITY_DESC') {
        const rDiff = rarityRanks[b.rarity] - rarityRanks[a.rarity];
        if (rDiff !== 0) return rDiff;
        return b.annualViews - a.annualViews;
      }
      if (sortF === 'OWNED_DESC') {
        if (ownB !== ownA) return ownB - ownA;
        return b.annualViews - a.annualViews;
      }
      return a.name.localeCompare(b.name, 'fr');
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedCards = filtered.slice(startIndex, startIndex + limit);

    const cardsResult = paginatedCards.map((card) => {
      const instances = (ownershipMap.get(card.id) || []).sort(
        (a, b) => a.serialNumber - b.serialNumber
      );
      const lockedCount = instances.filter((i) => i.lockedForAuction).length;
      return {
        card,
        ownedCount: instances.length,
        availableCount: instances.length - lockedCount,
        lockedCount,
        instances,
      };
    });

    return {
      totalOwnedCopies: userOwnerships.length,
      uniqueOwnedCards,
      totalCatalogCards: activeCards.length,
      byRarity,
      categories: Array.from(categoriesSet).sort(),
      cards: cardsResult,
      totalFiltered,
      page,
      totalPages,
    };
  }
}
