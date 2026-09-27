import React, { useState } from 'react';
import { Clock, Eye, Layers, PackageOpen, Sparkles } from 'lucide-react';
import {
  BoosterOpeningResult,
  CardRecord,
  PublicUserProfile,
  SystemConfig,
} from '../types';
import { formatCountdown, RARITY_META, RARITY_ORDER } from '../lib/rarity';
import { EncyclopediaCard } from '../components/EncyclopediaCard';
import { soundEngine } from '../lib/sound';

interface BoostersViewProps {
  user: PublicUserProfile | null;
  config: SystemConfig | null;
  liveCountdown: number | null;
  onOpenBooster: () => Promise<BoosterOpeningResult>;
  onSelectCard: (card: CardRecord) => void;
  onRequireAuth: () => void;
}

export const BoostersView: React.FC<BoostersViewProps> = ({
  user,
  config,
  liveCountdown,
  onOpenBooster,
  onSelectCard,
  onRequireAuth,
}) => {
  const [openingInProgress, setOpeningInProgress] = useState(false);
  const [sealBroken, setSealBroken] = useState(false);
  const [lastResult, setLastResult] = useState<BoosterOpeningResult | null>(null);
  const [revealedIndexes, setRevealedIndexes] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const available = user?.boosterState.availableBoosters ?? 0;
  const maxBoosters = user?.boosterState.maxBoosters ?? config?.maxBoosters ?? 10;
  const cardsPerBooster =
    user?.boosterState.cardsPerBooster ?? config?.cardsPerBooster ?? 5;

  const handleTriggerOpen = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (available <= 0 || openingInProgress) return;

    setErrorMsg(null);
    setOpeningInProgress(true);
    setSealBroken(true);
    soundEngine.playBoosterSealBreak();

    try {
      const result = await onOpenBooster();
      setTimeout(() => {
        setLastResult(result);
        setRevealedIndexes({});
        setOpeningInProgress(false);
        setSealBroken(false);
      }, 850);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setOpeningInProgress(false);
      setSealBroken(false);
    }
  };

  const handleRevealCard = (idx: number, card: CardRecord) => {
    if (revealedIndexes[idx]) {
      onSelectCard(card);
      return;
    }
    soundEngine.playCardReveal(card.rarity);
    setRevealedIndexes((prev) => ({ ...prev, [idx]: true }));
  };

  const handleRevealAll = () => {
    if (!lastResult) return;
    const next: Record<number, boolean> = {};
    lastResult.drawnItems.forEach((_, idx) => {
      next[idx] = true;
    });
    soundEngine.playCardReveal(
      lastResult.drawnItems.some((d) => d.card.rarity === 'MYTHIQUE')
        ? 'MYTHIQUE'
        : lastResult.drawnItems.some((d) => d.card.rarity === 'LEGENDAIRE')
        ? 'LEGENDAIRE'
        : 'RARE'
    );
    setRevealedIndexes(next);
  };

  const allRevealed =
    lastResult !== null &&
    lastResult.drawnItems.every((_, idx) => Boolean(revealedIndexes[idx]));

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* En-tête chambre des boosters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5 sm:pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F8F5EE]">
            Chambre des Boosters
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Chaque booster contient {cardsPerBooster} cartes certifiées de GL Collector. +1 booster automatique toutes les {config?.boosterRechargeMinutes ?? 10} minutes (max {maxBoosters}).
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-4 sm:gap-6 rounded-xl border border-white/10 bg-[#101726] p-3 sm:px-5 sm:py-3 self-stretch sm:self-auto justify-around sm:justify-start">
            <div>
              <div className="text-[10px] sm:text-xs text-slate-400">Stock actuel</div>
              <div className="font-mono-tabular text-lg sm:text-xl font-bold text-[#F3D266]">
                {available} / {maxBoosters}
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="text-[10px] sm:text-xs text-slate-400">Prochaine recharge</div>
              <div className="font-mono-tabular text-sm sm:text-base font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {available >= maxBoosters
                    ? 'Stock complet'
                    : formatCountdown(liveCountdown)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {!lastResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
          {/* Pack booster vertical interactif */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-[#131C2E] to-[#0B101B] p-6 sm:p-12 text-center">
            <div
              onClick={handleTriggerOpen}
              className={`relative w-56 sm:w-72 aspect-[5/7] rounded-2xl border-2 border-[#D4AF37] bg-gradient-to-b from-[#1D2842] via-[#101728] to-[#1A140B] p-4 flex flex-col justify-between shadow-2xl transition-all duration-300 ${
                available > 0 ? 'cursor-pointer hover:-translate-y-2 active:scale-95' : 'opacity-60'
              } ${sealBroken ? 'booster-opening pointer-events-none' : ''} card-foil-shimmer`}
            >
              <div className="w-full h-full rounded-xl border border-[#D4AF37]/40 p-4 sm:p-5 flex flex-col items-center justify-between">
                <div className="text-[11px] sm:text-xs font-mono-tabular tracking-widest text-[#F3D266]">GRAND LINE ARCHIVES</div>

                <div className="my-auto flex flex-col items-center gap-3 sm:gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-[#D4AF37]/70 flex items-center justify-center bg-[#D4AF37]/10 shadow-lg">
                    <svg viewBox="0 0 64 64" className="w-10 h-10 sm:w-12 sm:h-12" fill="none" stroke="#F3D266" strokeWidth="1.6">
                      <circle cx="32" cy="32" r="24" strokeDasharray="4 3" />
                      <polygon points="32,6 38,26 58,32 38,38 32,58 26,38 6,32 26,26" fill="#D4AF37" fillOpacity="0.22" />
                      <circle cx="32" cy="32" r="5" fill="#F3D266" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-display text-base sm:text-lg font-bold text-[#F8F5EE] tracking-wider">
                      GL COLLECTOR
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                      {cardsPerBooster} Cartes Certifiées
                    </div>
                  </div>
                </div>

                <div className="text-[10px] sm:text-[11px] text-slate-400 border-t border-white/10 pt-2 w-full text-center">Explorez · Collectionnez · Apprenez</div>
              </div>
            </div>

            {/* Bouton d'ouverture visible et tactile */}
            <div className="mt-6 w-full max-w-xs space-y-2">
              <button
                type="button"
                onClick={handleTriggerOpen}
                disabled={openingInProgress || (user !== null && available <= 0)}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#D4AF37] text-[#0B101B] font-bold text-sm hover:bg-[#E5C354] transition-all disabled:opacity-40 cursor-pointer shadow-lg active:scale-95"
              >
                <PackageOpen className="w-4 h-4" />
                <span>
                  {!user
                    ? 'Se connecter pour ouvrir'
                    : openingInProgress
                    ? 'Ouverture en cours...'
                    : available > 0
                    ? `Ouvrir un booster (${available}/${maxBoosters})`
                    : `Recharge dans ${formatCountdown(liveCountdown)}`}
                </span>
              </button>
              {available > 0 && (
                <p className="text-[11px] text-slate-400">
                  Appuyez sur le booster ou sur le bouton pour l'ouvrir.
                </p>
              )}
            </div>
          </div>

          {/* Panneau d'informations et probabilités */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-6">
            <div className="rounded-xl border border-white/10 bg-[#101726] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-semibold text-slate-100">
                  Stock de boosters ({available}/{maxBoosters})
                </h2>
                <span className="text-[11px] text-slate-400 font-mono-tabular">
                  +1 / {config?.boosterRechargeMinutes ?? 10} min
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {Array.from({ length: maxBoosters }).map((_, i) => {
                  const filled = i < available;
                  return (
                    <div
                      key={i}
                      className={`h-7 sm:h-8 rounded-lg border flex items-center justify-center text-[11px] sm:text-xs font-mono-tabular font-semibold ${
                        filled
                          ? 'border-[#D4AF37]/80 bg-[#D4AF37]/20 text-[#F3D266]'
                          : 'border-white/10 bg-[#090D16] text-slate-600'
                      }`}
                    >
                      #{i + 1}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                Chaque booster ouvert alimente instantanément votre collection avec des numéros de série attribués en continu.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#101726] p-4 sm:p-5 space-y-2">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-100">
                Probabilités de tirage par carte
              </h2>
              <div className="divide-y divide-white/10 pt-1">
                {RARITY_ORDER.map((rKey) => {
                  const m = RARITY_META[rKey];
                  const prob = config?.boosterProbabilities[rKey] ?? 0;
                  return (
                    <div key={rKey} className="py-1.5 sm:py-2 flex items-center justify-between text-xs">
                      <span className={`font-semibold ${m.textAccentClass}`}>
                        {m.label}
                      </span>
                      <span className="font-mono-tabular text-slate-200">
                        {prob.toString().replace('.', ',')} %
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Résultat d'ouverture de booster */
        <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#0F1625] p-4 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="text-xs text-[#F3D266] font-mono-tabular">
                TIRAGE DU BOOSTER #{lastResult.openingId}
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-0.5">
                Vos {lastResult.drawnItems.length} Cartes Révélées
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {!allRevealed && (
                <button
                  type="button"
                  onClick={handleRevealAll}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Tout révéler</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setLastResult(null)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#E5C354] text-[#0B101B] text-xs font-bold cursor-pointer active:scale-95"
              >
                <span>Terminer</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Touchez une carte face cachée pour la révéler, ou touchez une carte révélée pour voir sa fiche complète.
          </p>

          {/* Grille de cartes tirées (adaptée mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {lastResult.drawnItems.map((item, idx) => {
              const isRevealed = Boolean(revealedIndexes[idx]);
              const meta = RARITY_META[item.card.rarity];

              if (!isRevealed) {
                return (
                  <div
                    key={idx}
                    onClick={() => handleRevealCard(idx, item.card)}
                    className="aspect-[5/7] rounded-xl border-2 border-dashed border-amber-400/40 bg-gradient-to-b from-[#151D2F] to-[#0A0E18] p-4 flex flex-col items-center justify-between cursor-pointer hover:border-amber-300 hover:scale-105 active:scale-95 transition-all shadow-lg select-none"
                  >
                    <div className="text-[10px] font-mono-tabular text-slate-400">
                      Carte #{idx + 1}
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Sparkles className="w-8 h-8 text-[#F3D266] animate-pulse" />
                      <span className="text-xs text-slate-200 font-semibold">
                        Toucher pour révéler
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono-tabular">
                      GL COLLECTOR
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="space-y-1.5 animate-fadeIn">
                  <EncyclopediaCard
                    card={item.card}
                    serialNumber={item.ownership.serialNumber}
                    isNewDiscovery={item.isNewDiscovery}
                    onClick={() => onSelectCard(item.card)}
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 px-1">
                    <span className={`font-semibold ${meta.textAccentClass}`}>
                      {meta.label}
                    </span>
                    <span>Tirage N°{item.ownership.globalMintNumber}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {allRevealed && available > 0 && (
            <div className="pt-4 border-t border-white/10 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setLastResult(null);
                  handleTriggerOpen();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#D4AF37] text-[#0B101B] font-bold text-xs hover:bg-[#E5C354] cursor-pointer shadow-lg active:scale-95"
              >
                <PackageOpen className="w-4 h-4" />
                <span>Ouvrir le booster suivant ({available} restants)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
