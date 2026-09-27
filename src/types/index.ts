export type Rarity =
  | 'MYTHIQUE'
  | 'LEGENDAIRE'
  | 'EPIQUE'
  | 'RARE'
  | 'PEU_COMMUNE'
  | 'COMMUNE';

export type AuctionStatus =
  | 'OUVERTE'
  | 'TERMINEE'
  | 'VENDUE'
  | 'EXPIREE'
  | 'ANNULEE';

export type TransactionType =
  | 'BONUS_BIENVENUE'
  | 'RESERVATION_ENCHERE'
  | 'REMBOURSEMENT_SURENCHERE'
  | 'VENTE_ENCHERE'
  | 'ANNULATION_ENCHERE';

export type UserRole = 'JOUEUR' | 'ADMIN';

export interface WikiPageRecord {
  id: string;
  fandomPageId: number;
  title: string;
  summary: string;
  category: string;
  sourceUrl: string;
  lastSyncedAt: string;
}

export interface WikiViewStatRecord {
  id: string;
  wikiPageId: string;
  year: number;
  annualViews: number;
  recordedAt: string;
}

export interface CardRecord {
  id: string;
  wikiPageId: string;
  fandomPageId: number;
  name: string;
  description: string;
  category: string;
  sourceUrl: string;
  rarity: Rarity;
  annualViews: number;
  rarityYear: number;
  active: boolean;
  updatedAt: string;
}

export interface RarityCalculationRecord {
  id: string;
  cardId: string;
  cardName: string;
  year: number;
  annualViews: number;
  percentileRank: number;
  previousRarity: Rarity | null;
  assignedRarity: Rarity;
  calculatedAt: string;
}

export interface RarityRunSummary {
  id: string;
  year: number;
  calculatedAt: string;
  totalCards: number;
  changedCount: number;
  thresholds: RarityThresholds;
  distribution: Record<Rarity, number>;
}

export interface CardOwnershipRecord {
  id: string;
  userId: string;
  cardId: string;
  serialNumber: number;
  globalMintNumber: number;
  lockedForAuction: boolean;
  acquiredAt: string;
  boosterOpeningId?: string;
}

export interface PopulatedCardOwnership extends CardOwnershipRecord {
  card: CardRecord;
}

export interface BoosterState {
  availableBoosters: number;
  maxBoosters: number;
  secondsUntilNextBooster: number | null;
  rechargeMinutes: number;
  cardsPerBooster: number;
  lastRechargeAt: string;
}

export interface BoosterOpeningResult {
  openingId: string;
  openedAt: string;
  drawnItems: Array<{
    ownership: CardOwnershipRecord;
    card: CardRecord;
    isNewDiscovery: boolean;
    totalOwnedAfter: number;
  }>;
  boosterState: BoosterState;
}

export interface BidRecord {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderUsername: string;
  amount: number;
  createdAt: string;
}

export interface AuctionRecord {
  id: string;
  cardId: string;
  cardOwnershipId: string;
  serialNumber: number;
  sellerId: string;
  sellerUsername: string;
  startingPrice: number;
  currentBid: number;
  currentBidderId: string | null;
  currentBidderUsername: string | null;
  startDate: string;
  endDate: string;
  status: AuctionStatus;
  card: CardRecord;
  bids: BidRecord[];
}

export interface TransactionRecord {
  id: string;
  userId: string;
  username: string;
  amount: number;
  type: TransactionType;
  reference: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'SURENCHERE' | 'ENCHERE_REMPORTEE' | 'ENCHERE_TERMINEE' | 'NOUVELLE_CARTE' | 'BOOSTER_DISPONIBLE' | 'SYSTEME';
  message: string;
  read: boolean;
  createdAt: string;
}

export interface RarityThresholds {
  MYTHIQUE: number;    // default 1 (Top 1%)
  LEGENDAIRE: number;  // default 5 (Top 5%)
  EPIQUE: number;      // default 10 (Top 10%)
  RARE: number;        // default 25 (Top 25%)
  PEU_COMMUNE: number; // default 50 (Top 50%)
}

export interface BoosterProbabilities {
  COMMUNE: number;     // default 60
  PEU_COMMUNE: number; // default 25
  RARE: number;        // default 10
  EPIQUE: number;      // default 4
  LEGENDAIRE: number;  // default 0.9
  MYTHIQUE: number;    // default 0.1
}

export interface SystemConfig {
  rarityThresholds: RarityThresholds;
  currentRarityYear: number;
  lastAnnualCalculationAt: string;
  cardsPerBooster: number;
  boosterRechargeMinutes: number;
  maxBoosters: number;
  boosterProbabilities: BoosterProbabilities;
}

export interface WikiImportLog {
  id: string;
  startedAt: string;
  completedAt: string;
  source: string;
  pagesImported: number;
  pagesUpdated: number;
  pagesSkipped: number;
  errors: string[];
  status: 'SUCCES' | 'PARTIEL' | 'ERREUR';
}

export interface PublicUserProfile {
  id: string;
  username: string;
  role: UserRole;
  suspended: boolean;
  coins: number;
  createdAt: string;
  boosterState: BoosterState;
  stats: {
    totalCards: number;
    uniqueCards: number;
    totalCatalogCards: number;
    activeAuctionsCount: number;
    unreadNotificationsCount: number;
  };
}
