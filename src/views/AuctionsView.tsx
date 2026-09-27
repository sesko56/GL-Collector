import React, { useState } from 'react';
import { CheckCircle2, Clock, Coins, Gavel, PlusCircle, XCircle } from 'lucide-react';
import {
  AuctionRecord,
  CardRecord,
  PopulatedCardOwnership,
  PublicUserProfile,
} from '../types';
import { formatNumberFR } from '../lib/rarity';
import { EncyclopediaCard } from '../components/EncyclopediaCard';
import { soundEngine } from '../lib/sound';

interface AuctionsViewProps {
  auctions: AuctionRecord[];
  user: PublicUserProfile | null;
  availableUserCopies: PopulatedCardOwnership[];
  onPlaceBid: (auctionId: string, amount: number) => Promise<void>;
  onCreateAuction: (params: {
    cardOwnershipId: string;
    startingPrice: number;
    durationMinutes: number;
  }) => Promise<void>;
  onSettleAuctionNow: (auctionId: string) => Promise<void>;
  onCancelAuction: (auctionId: string) => Promise<void>;
  onSelectCard: (card: CardRecord) => void;
  onRequireAuth: () => void;
}

type MarketTab = 'OPEN' | 'MY_SALES' | 'MY_BIDS' | 'CLOSED';

export const AuctionsView: React.FC<AuctionsViewProps> = ({
  auctions,
  user,
  availableUserCopies,
  onPlaceBid,
  onCreateAuction,
  onSettleAuctionNow,
  onCancelAuction,
  onSelectCard,
  onRequireAuth,
}) => {
  const [activeTab, setActiveTab] = useState<MarketTab>('OPEN');
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [busyAuctionId, setBusyAuctionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCopyId, setSelectedCopyId] = useState<string>(
    availableUserCopies[0]?.id || ''
  );
  const [startingPrice, setStartingPrice] = useState<number>(100);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);

  const filteredAuctions = auctions.filter((a) => {
    if (activeTab === 'OPEN') return a.status === 'OUVERTE';
    if (activeTab === 'MY_SALES') return user !== null && a.sellerId === user.id;
    if (activeTab === 'MY_BIDS')
      return (
        user !== null &&
        (a.currentBidderId === user.id || a.bids.some((b) => b.bidderId === user.id))
      );
    return a.status !== 'OUVERTE';
  });

  const handleBidSubmit = async (auction: AuctionRecord) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const minBid =
      auction.currentBidderId === null ? auction.startingPrice : auction.currentBid + 10;
    const rawVal = bidInputs[auction.id];
    const amount = rawVal ? Number(rawVal) : minBid;

    setFeedback(null);
    setBusyAuctionId(auction.id);
    try {
      await onPlaceBid(auction.id, amount);
      soundEngine.playCoinGavel();
      setFeedback({
        type: 'ok',
        text: `Offre de ${formatNumberFR(amount)} Pièces enregistrée sur ${auction.card.name} #${auction.serialNumber}.`,
      });
      setBidInputs((prev) => ({ ...prev, [auction.id]: '' }));
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setBusyAuctionId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    const targetId = selectedCopyId || availableUserCopies[0]?.id;
    if (!targetId) return;

    setFeedback(null);
    setBusyAuctionId('create');
    try {
      await onCreateAuction({
        cardOwnershipId: targetId,
        startingPrice,
        durationMinutes,
      });
      soundEngine.playCoinGavel();
      setShowCreateForm(false);
      setFeedback({
        type: 'ok',
        text: 'Votre exemplaire a été verrouillé et mis aux enchères.',
      });
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setBusyAuctionId(null);
    }
  };

  const handleSettle = async (auction: AuctionRecord) => {
    setFeedback(null);
    setBusyAuctionId(auction.id);
    try {
      await onSettleAuctionNow(auction.id);
      soundEngine.playCoinGavel();
      setFeedback({
        type: 'ok',
        text: `Enchère terminée : transfert de la carte et des pièces effectué !`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setBusyAuctionId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F8F5EE]">
            Hôtel des Ventes & Enchères
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Marché officiel entre collectionneurs. Mettez vos cartes en vente ou enchérissez avec vos Pièces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="rounded-lg border border-white/10 bg-[#101726] px-3.5 py-2 text-xs flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#F3D266]" />
              <span className="text-slate-400">Solde :</span>
              <strong className="font-mono-tabular text-[#F3D266]">
                {formatNumberFR(user.coins)} Pièces
              </strong>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (!user) {
                onRequireAuth();
                return;
              }
              if (availableUserCopies.length > 0 && !selectedCopyId) {
                setSelectedCopyId(availableUserCopies[0].id);
              }
              setShowCreateForm((v) => !v);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#0B101B] font-semibold text-xs hover:bg-[#E5C354] transition-colors whitespace-nowrap cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Mettre une carte aux enchères</span>
          </button>
        </div>
      </div>

      {showCreateForm && user && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-xl border border-[#D4AF37]/50 bg-[#101726] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#F3D266]">
              Mettre une carte aux enchères
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Fermer
            </button>
          </div>

          {availableUserCopies.length === 0 ? (
            <p className="text-xs text-slate-400">
              Votre collection ne contient aucun exemplaire disponible. Ouvrez des boosters pour obtenir des cartes à vendre !
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-6">
                <label className="block text-xs text-slate-400 mb-1">
                  Exemplaire de votre collection
                </label>
                <select
                  value={selectedCopyId || availableUserCopies[0]?.id}
                  onChange={(e) => setSelectedCopyId(e.target.value)}
                  className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  {availableUserCopies.map((copy) => (
                    <option key={copy.id} value={copy.id}>
                      {copy.card.name} #{copy.serialNumber} ({copy.card.rarity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Prix de départ (Pièces)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100000}
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(Number(e.target.value))}
                  className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2.5 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Durée
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value={1}>1 minute</option>
                  <option value={15}>15 minutes</option>
                  <option value={60}>1 heure</option>
                  <option value={1440}>24 heures</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={busyAuctionId === 'create'}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0B101B] font-semibold text-xs hover:bg-[#E5C354] transition-colors cursor-pointer"
                >
                  Publier
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline ml-4"
          >
            Fermer
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {(
          [
            {
              id: 'OPEN',
              label: `Enchères ouvertes (${auctions.filter((a) => a.status === 'OUVERTE').length})`,
            },
            {
              id: 'MY_SALES',
              label: `Mes ventes (${user ? auctions.filter((a) => a.sellerId === user.id).length : 0})`,
            },
            {
              id: 'MY_BIDS',
              label: `Mes offres (${
                user
                  ? auctions.filter(
                      (a) =>
                        a.currentBidderId === user.id ||
                        a.bids.some((b) => b.bidderId === user.id)
                    ).length
                  : 0
              })`,
            },
            {
              id: 'CLOSED',
              label: `Terminées (${auctions.filter((a) => a.status !== 'OUVERTE').length})`,
            },
          ] as Array<{ id: MarketTab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#D4AF37] text-[#0B101B] font-semibold'
                : 'bg-[#101726] text-slate-300 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filteredAuctions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#101726] p-12 text-center text-sm text-slate-400 space-y-2">
          <div>Aucune enchère active pour le moment.</div>
          <p className="text-xs text-slate-500">
            Mettez le premier exemplaire en vente ou revenez explorer les prochaines offres des joueurs !
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAuctions.map((auction) => {
            const isSeller = user?.id === auction.sellerId;
            const isLeading = user !== null && auction.currentBidderId === user.id;
            const minNextBid =
              auction.currentBidderId === null ? auction.startingPrice : auction.currentBid + 10;
            const endMs = new Date(auction.endDate).getTime();
            const remainingMin = Math.max(0, Math.ceil((endMs - Date.now()) / 60000));

            return (
              <div
                key={auction.id}
                className="rounded-xl border border-white/10 bg-[#101726] p-5 flex flex-col sm:flex-row gap-5 justify-between"
              >
                <div className="sm:w-52 shrink-0">
                  <EncyclopediaCard
                    card={auction.card}
                    serialNumber={auction.serialNumber}
                    lockedForAuction={auction.status === 'OUVERTE'}
                    compact
                    onClick={() => onSelectCard(auction.card)}
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>Vendeur : <strong className="text-slate-200">{auction.sellerUsername}</strong></span>
                      <span className="font-mono-tabular">Statut : {auction.status}</span>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-[#090D16] p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Prix de départ</span>
                        <span className="font-mono-tabular text-slate-300">
                          {formatNumberFR(auction.startingPrice)} Pièces
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Enchère actuelle</span>
                        <span className="font-mono-tabular text-base font-bold text-[#F3D266]">
                          {formatNumberFR(auction.currentBid)} Pièces
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-white/10">
                        <span className="text-slate-400">En tête</span>
                        <span className="font-medium text-slate-200">
                          {auction.currentBidderUsername ? (
                            <>
                              <span>{auction.currentBidderUsername}</span>
                              {isLeading && <span className="text-emerald-400 ml-1">(Vous)</span>}
                            </>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Fin</span>
                        <span className="font-mono-tabular flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {auction.status === 'OUVERTE'
                            ? `${remainingMin} min restantes`
                            : new Date(auction.endDate).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {auction.status === 'OUVERTE' && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      {!isSeller ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={minNextBid}
                            placeholder={`${minNextBid} P. min`}
                            value={bidInputs[auction.id] ?? ''}
                            onChange={(e) =>
                              setBidInputs((prev) => ({
                                ...prev,
                                [auction.id]: e.target.value,
                              }))
                            }
                            className="w-32 rounded-lg bg-[#090D16] border border-white/15 px-3 py-2 text-xs font-mono-tabular text-white"
                          />
                          <button
                            type="button"
                            disabled={busyAuctionId === auction.id}
                            onClick={() => handleBidSubmit(auction)}
                            className="flex-1 py-2 px-3 rounded-lg bg-[#D4AF37] text-[#0B101B] font-semibold text-xs hover:bg-[#E5C354] cursor-pointer"
                          >
                            <Gavel className="w-3.5 h-3.5 inline mr-1" />
                            <span>Enchérir</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-300">
                          Vous êtes le vendeur de cet exemplaire #{auction.serialNumber}.
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busyAuctionId === auction.id}
                          onClick={() => handleSettle(auction)}
                          className="px-2.5 py-1.5 rounded border border-emerald-500/30 bg-emerald-950/20 text-[11px] text-emerald-300 hover:bg-emerald-950/40 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          <span>Clôturer maintenant</span>
                        </button>
                        {isSeller && auction.currentBidderId === null && (
                          <button
                            type="button"
                            disabled={busyAuctionId === auction.id}
                            onClick={() => onCancelAuction(auction.id)}
                            className="px-2.5 py-1.5 rounded border border-rose-500/30 text-[11px] text-rose-300 hover:bg-rose-950/30 cursor-pointer"
                          >
                            <XCircle className="w-3 h-3 inline mr-1" />
                            <span>Annuler</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
