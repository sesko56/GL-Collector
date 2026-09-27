import crypto from 'crypto';
import { DatabaseSchema, db } from '../db.js';
import { AuctionRecord, BidRecord } from '../../src/types/index.js';
import { NotificationService } from './NotificationService.js';
import { UserService } from './UserService.js';

export class AuctionService {
  public static settleExpiredAuctionsInTx(state: DatabaseSchema): number {
    const nowMs = Date.now();
    let settledCount = 0;

    for (const auction of state.auctions) {
      if (auction.status === 'OUVERTE' && new Date(auction.endDate).getTime() <= nowMs) {
        this.finalizeSingleAuctionInTx(state, auction);
        settledCount++;
      }
    }
    return settledCount;
  }

  public static finalizeSingleAuctionInTx(state: DatabaseSchema, auction: AuctionRecord): AuctionRecord {
    if (auction.status !== 'OUVERTE') {
      return auction;
    }

    const ownership = state.cardOwnerships.find((co) => co.id === auction.cardOwnershipId);
    const seller = state.users.find((u) => u.id === auction.sellerId);

    if (auction.currentBidderId) {
      const winner = state.users.find((u) => u.id === auction.currentBidderId);

      if (seller) {
        UserService.recordCoinTransactionInTx(
          state,
          seller,
          auction.currentBid,
          'VENTE_ENCHERE',
          `Vente aux enchères #${auction.id} — ${auction.card.name} #${auction.serialNumber}`
        );
        NotificationService.pushInTx(
          state,
          seller.id,
          'ENCHERE_TERMINEE',
          `Votre enchère est terminée : ${auction.card.name} #${auction.serialNumber} a été vendue pour ${auction.currentBid} Pièces.`
        );
      }

      if (ownership && winner) {
        const winnerExisting = state.cardOwnerships.filter(
          (co) => co.userId === winner.id && co.cardId === ownership.cardId
        );
        const nextSerial =
          winnerExisting.reduce((max, item) => Math.max(max, item.serialNumber), 0) + 1;

        ownership.userId = winner.id;
        ownership.serialNumber = nextSerial;
        ownership.lockedForAuction = false;
        ownership.acquiredAt = new Date().toISOString();

        NotificationService.pushInTx(
          state,
          winner.id,
          'ENCHERE_REMPORTEE',
          `Vous avez remporté l'enchère : ${auction.card.name} #${nextSerial} a rejoint votre collection pour ${auction.currentBid} Pièces.`
        );
      } else if (ownership) {
        ownership.lockedForAuction = false;
      }

      auction.status = 'VENDUE';
    } else {
      if (ownership) {
        ownership.lockedForAuction = false;
      }
      auction.status = 'EXPIREE';
      if (seller) {
        NotificationService.pushInTx(
          state,
          seller.id,
          'ENCHERE_TERMINEE',
          `Votre enchère est terminée sans offre : ${auction.card.name} #${auction.serialNumber} a été déverrouillée dans votre collection.`
        );
      }
    }

    return auction;
  }

  public static async listAuctions(): Promise<AuctionRecord[]> {
    return db.transaction((state) => {
      this.settleExpiredAuctionsInTx(state);
      return [...state.auctions].sort((a, b) => {
        if (a.status === 'OUVERTE' && b.status !== 'OUVERTE') return -1;
        if (a.status !== 'OUVERTE' && b.status === 'OUVERTE') return 1;
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      });
    });
  }

  public static async createAuction(params: {
    sellerId: string;
    cardOwnershipId: string;
    startingPrice: number;
    durationMinutes: number;
  }): Promise<AuctionRecord> {
    const price = Math.floor(params.startingPrice);
    if (!Number.isFinite(price) || price < 10) {
      throw new Error('Le prix de départ minimum est de 10 Pièces.');
    }
    const durationMin = Math.max(0.5, Math.min(10080, Number(params.durationMinutes) || 60));

    return db.transaction((state) => {
      this.settleExpiredAuctionsInTx(state);

      const seller = state.users.find((u) => u.id === params.sellerId);
      if (!seller) throw new Error('Vendeur introuvable.');
      if (seller.suspended) throw new Error('Compte suspendu.');

      const ownership = state.cardOwnerships.find((co) => co.id === params.cardOwnershipId);
      if (!ownership) throw new Error('Exemplaire de carte introuvable.');
      if (ownership.userId !== seller.id) {
        throw new Error('Vous ne possédez pas cet exemplaire.');
      }
      if (ownership.lockedForAuction) {
        throw new Error('Cet exemplaire est déjà verrouillé dans une enchère.');
      }

      const card = state.cards.find((c) => c.id === ownership.cardId);
      if (!card) throw new Error('Carte introuvable.');

      ownership.lockedForAuction = true;

      const now = new Date();
      const endDate = new Date(now.getTime() + durationMin * 60 * 1000);

      const auction: AuctionRecord = {
        id: `auc-${crypto.randomUUID().slice(0, 8)}`,
        cardId: card.id,
        cardOwnershipId: ownership.id,
        serialNumber: ownership.serialNumber,
        sellerId: seller.id,
        sellerUsername: seller.username,
        startingPrice: price,
        currentBid: price,
        currentBidderId: null,
        currentBidderUsername: null,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        status: 'OUVERTE',
        card,
        bids: [],
      };

      state.auctions.unshift(auction);
      db.logAudit(
        seller.id,
        'AUCTION_CREATED',
        `Mise aux enchères de ${card.name} #${ownership.serialNumber} à ${price} Pièces.`
      );

      return auction;
    });
  }

  public static async placeBid(params: {
    auctionId: string;
    bidderId: string;
    amount: number;
  }): Promise<AuctionRecord> {
    const bidAmount = Math.floor(params.amount);
    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      throw new Error("Montant d'enchère invalide.");
    }

    return db.transaction((state) => {
      this.settleExpiredAuctionsInTx(state);

      const auction = state.auctions.find((a) => a.id === params.auctionId);
      if (!auction) throw new Error('Enchère introuvable.');
      if (auction.status !== 'OUVERTE') throw new Error("Cette enchère n'est plus ouverte.");

      const bidder = state.users.find((u) => u.id === params.bidderId);
      if (!bidder) throw new Error('Enchérisseur introuvable.');
      if (bidder.suspended) throw new Error('Votre compte est suspendu.');
      if (auction.sellerId === bidder.id) {
        throw new Error('Vous ne pouvez pas enchérir sur votre propre carte.');
      }

      const minimumRequired =
        auction.currentBidderId === null ? auction.startingPrice : auction.currentBid + 10;

      if (bidAmount < minimumRequired) {
        throw new Error(`Votre offre doit être d'au moins ${minimumRequired} Pièces.`);
      }

      const previousBidderId = auction.currentBidderId;
      const previousBidAmount = auction.currentBid;

      if (previousBidderId === bidder.id) {
        const additional = bidAmount - previousBidAmount;
        if (bidder.coins < additional) {
          throw new Error(`Solde insuffisant pour augmenter votre offre.`);
        }
        UserService.recordCoinTransactionInTx(
          state,
          bidder,
          -additional,
          'RESERVATION_ENCHERE',
          `Augmentation d'offre #${auction.id}`
        );
      } else {
        if (bidder.coins < bidAmount) {
          throw new Error(`Solde de pièces insuffisant (${bidder.coins} P. disponibles).`);
        }

        UserService.recordCoinTransactionInTx(
          state,
          bidder,
          -bidAmount,
          'RESERVATION_ENCHERE',
          `Réservation enchère #${auction.id}`
        );

        if (previousBidderId) {
          const prevBidder = state.users.find((u) => u.id === previousBidderId);
          if (prevBidder) {
            UserService.recordCoinTransactionInTx(
              state,
              prevBidder,
              previousBidAmount,
              'REMBOURSEMENT_SURENCHERE',
              `Remboursement suite à surenchère #${auction.id}`
            );
            NotificationService.pushInTx(
              state,
              prevBidder.id,
              'SURENCHERE',
              `Quelqu'un a surenchéri sur votre carte : ${bidder.username} a proposé ${bidAmount} Pièces.`
            );
          }
        }
      }

      const bidRecord: BidRecord = {
        id: `bid-${crypto.randomUUID().slice(0, 8)}`,
        auctionId: auction.id,
        bidderId: bidder.id,
        bidderUsername: bidder.username,
        amount: bidAmount,
        createdAt: new Date().toISOString(),
      };

      auction.currentBid = bidAmount;
      auction.currentBidderId = bidder.id;
      auction.currentBidderUsername = bidder.username;
      auction.bids.unshift(bidRecord);
      state.bids.unshift(bidRecord);

      NotificationService.pushInTx(
        state,
        auction.sellerId,
        'SURENCHERE',
        `Nouvelle offre de ${bidAmount} Pièces par ${bidder.username} sur votre carte.`
      );

      return auction;
    });
  }

  public static async settleAuctionNow(auctionId: string, actorUserId: string): Promise<AuctionRecord> {
    return db.transaction((state) => {
      const auction = state.auctions.find((a) => a.id === auctionId);
      if (!auction) throw new Error('Enchère introuvable.');
      if (auction.status !== 'OUVERTE') throw new Error('Cette enchère est déjà clôturée.');

      const actor = state.users.find((u) => u.id === actorUserId);
      if (!actor) throw new Error('Non autorisé.');

      auction.endDate = new Date().toISOString();
      return this.finalizeSingleAuctionInTx(state, auction);
    });
  }

  public static async cancelAuction(auctionId: string, actorUserId: string, isAdmin = false): Promise<AuctionRecord> {
    return db.transaction((state) => {
      const auction = state.auctions.find((a) => a.id === auctionId);
      if (!auction) throw new Error('Enchère introuvable.');
      if (auction.status !== 'OUVERTE') throw new Error('Seule une enchère ouverte peut être annulée.');

      if (!isAdmin && auction.sellerId !== actorUserId) {
        throw new Error('Non autorisé.');
      }
      if (!isAdmin && auction.currentBidderId !== null) {
        throw new Error("Impossible d'annuler une enchère avec une offre en cours.");
      }

      if (auction.currentBidderId) {
        const bidder = state.users.find((u) => u.id === auction.currentBidderId);
        if (bidder) {
          UserService.recordCoinTransactionInTx(
            state,
            bidder,
            auction.currentBid,
            'ANNULATION_ENCHERE',
            `Remboursement annulation #${auction.id}`
          );
        }
      }

      const ownership = state.cardOwnerships.find((co) => co.id === auction.cardOwnershipId);
      if (ownership) {
        ownership.lockedForAuction = false;
      }

      auction.status = 'ANNULEE';
      return auction;
    });
  }
}
