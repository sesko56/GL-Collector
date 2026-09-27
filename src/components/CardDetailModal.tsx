import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Gavel, Lock, X } from 'lucide-react';
import { CardRecord, PopulatedCardOwnership } from '../types';
import { formatNumberFR, RARITY_META } from '../lib/rarity';
import { EncyclopediaCard } from './EncyclopediaCard';

interface CardDetailModalProps {
  card: CardRecord;
  instances: PopulatedCardOwnership[];
  isAuthenticated: boolean;
  onClose: () => void;
  onCreateAuction: (params: {
    cardOwnershipId: string;
    startingPrice: number;
    durationMinutes: number;
  }) => Promise<void>;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  card,
  instances,
  isAuthenticated,
  onClose,
  onCreateAuction,
}) => {
  const meta = RARITY_META[card.rarity];
  const availableInstances = instances.filter((i) => !i.lockedForAuction);

  const [selectedOwnershipId, setSelectedOwnershipId] = useState<string>(
    availableInstances[0]?.id || ''
  );
  const [startingPrice, setStartingPrice] = useState<number>(100);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePutOnAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwnershipId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await onCreateAuction({
        cardOwnershipId: selectedOwnershipId,
        startingPrice,
        durationMinutes,
      });
      setSuccessMsg('Votre exemplaire a été mis aux enchères avec succès.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-white/15 bg-[#0F1624] p-4 sm:p-7 shadow-2xl my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de la modale */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 mb-4 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-400">
              <span className={`font-semibold ${meta.textAccentClass}`}>{meta.label}</span>
              <span aria-hidden="true">·</span>
              <span>{card.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">Fiche #{card.fandomPageId}</span>
            </div>
            <h2 className="font-display text-xl sm:text-3xl font-bold text-[#F8F5EE] mt-0.5 sm:mt-1">
              {card.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="overflow-y-auto pr-1 pb-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-5 flex justify-center">
              <div className="w-full max-w-xs sm:max-w-none">
                <EncyclopediaCard card={card} ownedCount={instances.length} />
              </div>
            </div>

            <div className="md:col-span-7 space-y-5">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-200 mb-1.5">
                  Archive encyclopédique
                </h3>
                <div className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#090D16] border border-white/10 rounded-xl p-3.5 sm:p-4">
                  <p>{card.description}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div>
                    Fréquentation :{' '}
                    <strong className="font-mono-tabular text-slate-200">
                      {formatNumberFR(card.annualViews)} visites
                    </strong>{' '}
                    ({meta.percentileLabel})
                  </div>
                  {card.sourceUrl && (
                    <a
                      href={card.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[#F3D266] hover:bg-amber-500/20 font-medium transition-colors"
                    >
                      <span>Ouvrir l'article (One Piece Wiki)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Exemplaires possédés */}
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-200">
                    Vos exemplaires possédés ({instances.length})
                  </h3>
                  <span className="text-[11px] sm:text-xs text-slate-400 font-mono-tabular">
                    {availableInstances.length} disponible(s) · {instances.length - availableInstances.length} en vente
                  </span>
                </div>

                {instances.length === 0 ? (
                  <div className="text-xs text-slate-400 bg-[#090D16] border border-white/10 rounded-xl p-3.5">
                    Vous ne possédez aucun exemplaire de cette carte. Ouvrez des boosters pour tenter de l'obtenir !
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 sm:max-h-40 overflow-y-auto pr-1">
                    {instances.map((inst) => (
                      <div
                        key={inst.id}
                        onClick={() => {
                          if (!inst.lockedForAuction) {
                            setSelectedOwnershipId(inst.id);
                          }
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors ${
                          inst.lockedForAuction
                            ? 'border-amber-500/30 bg-amber-950/15 text-slate-400'
                            : selectedOwnershipId === inst.id
                            ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-white cursor-pointer ring-1 ring-[#D4AF37]/50'
                            : 'border-white/10 bg-[#090D16] text-slate-300 hover:border-white/25 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular font-semibold text-slate-100">
                            #{inst.serialNumber}
                          </span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="font-mono-tabular text-slate-400 text-[11px]">
                            Tirage N°{inst.globalMintNumber}
                          </span>
                        </div>

                        <div>
                          {inst.lockedForAuction ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-[11px]">
                              <Lock className="w-3 h-3" />
                              <span>En vente</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Disponible</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Formulaire de mise en vente aux enchères */}
              {isAuthenticated && availableInstances.length > 0 && (
                <form
                  onSubmit={handlePutOnAuction}
                  className="border-t border-white/10 pt-4 space-y-3"
                >
                  <h3 className="text-xs sm:text-sm font-semibold text-[#F3D266] flex items-center gap-2">
                    <Gavel className="w-4 h-4" />
                    <span>Mettre un exemplaire aux enchères</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Exemplaire
                      </label>
                      <select
                        value={selectedOwnershipId}
                        onChange={(e) => setSelectedOwnershipId(e.target.value)}
                        className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        {availableInstances.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            #{inst.serialNumber} (Tirage N°{inst.globalMintNumber})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Prix de départ (Pièces)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={100000}
                        value={startingPrice}
                        onChange={(e) => setStartingPrice(Number(e.target.value))}
                        className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2 text-xs font-mono-tabular text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Durée
                      </label>
                      <select
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value={15}>15 minutes</option>
                        <option value={60}>1 heure</option>
                        <option value={1440}>24 heures</option>
                      </select>
                    </div>
                  </div>

                  {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
                  {successMsg && <p className="text-xs text-emerald-400">{successMsg}</p>}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    <p className="text-[11px] text-slate-400">
                      L'exemplaire sera verrouillé jusqu'à l'issue de l'enchère.
                    </p>
                    <button
                      type="submit"
                      disabled={submitting || !selectedOwnershipId}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#0B101B] font-bold text-xs hover:bg-[#E5C354] disabled:opacity-50 cursor-pointer text-center"
                    >
                      {submitting ? 'Publication...' : 'Mettre aux enchères'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
