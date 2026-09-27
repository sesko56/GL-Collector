import React from 'react';
import { BookOpen, Clock, Coins, Compass, Gavel, Layers, PackageOpen, ShieldCheck, UserPlus } from 'lucide-react';
import { CardRecord, PublicUserProfile, SystemConfig } from '../types';
import { formatCountdown, formatNumberFR, RARITY_META, RARITY_ORDER } from '../lib/rarity';
import { EncyclopediaCard } from '../components/EncyclopediaCard';

interface HomeViewProps {
  user: PublicUserProfile | null;
  config: SystemConfig | null;
  showcaseCards: CardRecord[];
  totalCatalogCards: number;
  openAuctionsCount: number;
  liveCountdown: number | null;
  onNavigate: (tab: 'home' | 'collection' | 'boosters' | 'auctions' | 'profile' | 'admin') => void;
  onSelectCard: (card: CardRecord) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  config,
  showcaseCards,
  totalCatalogCards,
  openAuctionsCount,
  liveCountdown,
  onNavigate,
  onSelectCard,
}) => {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Hero Banner */}
      <section className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-[#131C2E] via-[#0E1524] to-[#17120C] p-5 sm:p-10 lg:p-12 overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-[#F3D266] tracking-wide">
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>Répertoire officiel : {totalCatalogCards} cartes à collectionner</span>
            </div>

            <h1
              className="font-display text-2xl sm:text-4xl lg:text-5xl font-bold text-[#F8F5EE] leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Apprenez One Piece, une carte à la fois
            </h1>

            <p className="text-xs sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Bienvenue sur <strong>GL Collector</strong>. Chaque carte vous ouvre une porte sur l'univers de One Piece : personnages, îles, équipages, fruits du démon et grands moments de l'aventure. Explorez, collectionnez et apprenez en jouant.
            </p>

            {/* Boutons d'action rapides (adaptés mobile vertical) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('boosters')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D4AF37] text-[#0B101B] font-bold text-sm hover:bg-[#E5C354] transition-all cursor-pointer shadow-lg active:scale-[0.98]"
              >
                <PackageOpen className="w-4 h-4" />
                <span>Ouvrir un booster</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('collection')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/15 bg-white/5 text-slate-100 font-medium text-sm hover:bg-white/10 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Layers className="w-4 h-4" />
                <span>Explorer la collection</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('auctions')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/15 bg-white/5 text-slate-100 font-medium text-sm hover:bg-white/10 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Gavel className="w-4 h-4" />
                <span>Hôtel des ventes ({openAuctionsCount})</span>
              </button>
            </div>

            {/* Statut du joueur */}
            {user ? (
              <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <div className="text-[11px] text-slate-400">Joueur connecté</div>
                  <div className="text-sm font-semibold text-white mt-0.5 truncate">
                    {user.username}
                  </div>
                </div>
                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <div className="text-[11px] text-slate-400">Trésorerie</div>
                  <div className="text-sm font-mono-tabular font-semibold text-[#F3D266] mt-0.5 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{formatNumberFR(user.coins)} ฿</span>
                  </div>
                </div>
                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <div className="text-[11px] text-slate-400">Boosters en stock</div>
                  <div className="text-sm font-mono-tabular font-semibold text-emerald-300 mt-0.5">
                    {user.boosterState.availableBoosters} / {user.boosterState.maxBoosters}
                  </div>
                </div>
                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <div className="text-[11px] text-slate-400">Prochaine recharge</div>
                  <div className="text-sm font-mono-tabular font-semibold text-slate-200 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {user.boosterState.availableBoosters >= user.boosterState.maxBoosters
                        ? 'Complet'
                        : formatCountdown(liveCountdown)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  Rejoignez GL Collector dès maintenant avec <strong>10 boosters gratuits</strong> et <strong>1 000 Pièces</strong> de bienvenue.
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/15 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Connexion / Inscription</span>
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 flex justify-center">
            {showcaseCards[0] && (
              <div className="w-full max-w-xs">
                <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
                  <span>À découvrir aujourd’hui</span>
                  <span className="font-mono-tabular text-[#F3D266]">
                    {formatNumberFR(showcaseCards[0].annualViews)} visites
                  </span>
                </div>
                <EncyclopediaCard
                  card={showcaseCards[0]}
                  onClick={() => onSelectCard(showcaseCards[0])}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Cartes prestigieuses */}
      <section className="space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F8F5EE]">
              Cartes les Plus Prestigieuses du Répertoire
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Les cartes mythiques et légendaires correspondent aux fiches les plus consultées sur 12 mois.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('collection')}
            className="text-xs font-semibold text-[#F3D266] hover:underline whitespace-nowrap cursor-pointer self-start sm:self-auto"
          >
            Explorer tout le catalogue ({totalCatalogCards} cartes) →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {showcaseCards.slice(0, 6).map((card) => (
            <EncyclopediaCard
              key={card.id}
              card={card}
              onClick={() => onSelectCard(card)}
            />
          ))}
        </div>
      </section>

      {/* Piliers du jeu */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 pt-4 border-t border-white/10">
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 text-xs text-[#F3D266] font-semibold">
            <BookOpen className="w-4 h-4" />
            <span>01. Rareté basée sur la popularité</span>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-white">
            Classement de popularité sur les {totalCatalogCards} cartes
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            L'ensemble des cartes de GL Collector est classé une fois par an selon les statistiques d'intérêt pour garantir une rareté dynamique, authentique et fidèle à la communauté.
          </p>

          <div className="divide-y divide-white/10 border border-white/10 rounded-xl bg-[#0E1422]">
            {RARITY_ORDER.map((rKey) => {
              const m = RARITY_META[rKey];
              const thresholdVal =
                rKey === 'COMMUNE'
                  ? 'Base (> Top 50 %)'
                  : `Top ${config?.rarityThresholds[rKey] ?? ''}%`;
              return (
                <div key={rKey} className="px-4 py-2 flex items-center justify-between text-xs">
                  <span className={`font-semibold ${m.textAccentClass}`}>{m.label}</span>
                  <span className="font-mono-tabular text-slate-300">{thresholdVal}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>02. Boosters & Hôtel des ventes direct</span>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-white">
            Marché des Enchères Direct entre Joueurs
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Chaque exemplaire tiré côté serveur vous attribue un tirage unique et numéroté (#1, #2, #3...). Proposez vos cartes aux enchères ou acquérez les pièces rares d'autres collectionneurs.
          </p>

          <div className="divide-y divide-white/10 border border-white/10 rounded-xl bg-[#0E1422]">
            {RARITY_ORDER.map((rKey) => {
              const m = RARITY_META[rKey];
              const probVal = config?.boosterProbabilities[rKey] ?? 0;
              return (
                <div key={rKey} className="px-4 py-2 flex items-center justify-between text-xs">
                  <span className={`font-semibold ${m.textAccentClass}`}>
                    Tirage {m.label}
                  </span>
                  <span className="font-mono-tabular text-slate-300">
                    {probVal.toString().replace('.', ',')} % par carte
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
