import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpDown, Search } from 'lucide-react';
import { CardRecord, PopulatedCardOwnership, Rarity } from '../types';
import { formatNumberFR, RARITY_META, RARITY_ORDER } from '../lib/rarity';
import { EncyclopediaCard } from '../components/EncyclopediaCard';
import { apiRequest } from '../lib/api';

export interface CollectionData {
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
  totalFiltered?: number;
  page?: number;
  totalPages?: number;
}

interface CollectionViewProps {
  collection: CollectionData | null;
  isAuthenticated: boolean;
  onSelectCardWithInstances: (card: CardRecord, instances: PopulatedCardOwnership[]) => void;
}

type OwnershipFilter = 'ALL' | 'OWNED' | 'DUPLICATES' | 'MISSING';
type SortMode = 'VIEWS_DESC' | 'RARITY_DESC' | 'NAME_ASC' | 'OWNED_DESC';

export const CollectionView: React.FC<CollectionViewProps> = ({
  collection: initialCollection,
  onSelectCardWithInstances,
}) => {
  const [collection, setCollection] = useState<CollectionData | null>(initialCollection);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('VIEWS_DESC');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchFilteredCollection = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (rarityFilter !== 'ALL') params.set('rarity', rarityFilter);
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (ownershipFilter !== 'ALL') params.set('ownership', ownershipFilter);
      params.set('sort', sortMode);
      params.set('page', String(targetPage));
      params.set('limit', '36');

      // Utilisation du cache d'appareil pour accélérer la navigation
      const res = await apiRequest<CollectionData>(`/api/collection?${params.toString()}`, {
        useCache: true,
        cacheTTL: 5 * 60 * 1000,
      });
      setCollection(res);
      setPage(targetPage);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilteredCollection(1);
  }, [search, rarityFilter, categoryFilter, ownershipFilter, sortMode]);

  const cardsList = collection?.cards || [];
  const totalFiltered = collection?.totalFiltered ?? collection?.totalCatalogCards ?? 7959;
  const totalPages = collection?.totalPages ?? 1;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* En-tête Collection */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 border-b border-white/10 pb-5 sm:pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F8F5EE]">
            Collection Complète & Répertoire
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Les {collection?.totalCatalogCards ?? 7959} cartes officielles de GL Collector. Enrichissez votre album en ouvrant des boosters et via l'hôtel des ventes !
          </p>
        </div>

        {/* Stats de progression (adaptées mobile) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 rounded-xl border border-white/10 bg-[#101726] p-3 sm:px-5 sm:py-3 text-center sm:text-left">
          <div>
            <div className="text-[10px] sm:text-xs text-slate-400">Total possédés</div>
            <div className="font-mono-tabular text-base sm:text-xl font-bold text-[#F3D266]">
              {formatNumberFR(collection?.totalOwnedCopies ?? 0)}
            </div>
          </div>
          <div className="border-l border-white/10 pl-2 sm:pl-4">
            <div className="text-[10px] sm:text-xs text-slate-400">Cartes uniques</div>
            <div className="font-mono-tabular text-base sm:text-xl font-bold text-white">
              {collection?.uniqueOwnedCards ?? 0} <span className="text-[10px] sm:text-xs font-normal text-slate-400">/ {collection?.totalCatalogCards ?? 7959}</span>
            </div>
          </div>
          <div className="border-l border-white/10 pl-2 sm:pl-4">
            <div className="text-[10px] sm:text-xs text-slate-400">Complétion</div>
            <div className="font-mono-tabular text-base sm:text-xl font-bold text-emerald-300">
              {collection && collection.totalCatalogCards > 0
                ? ((collection.uniqueOwnedCards / collection.totalCatalogCards) * 100).toFixed(1)
                : '0.0'}
              %
            </div>
          </div>
        </div>
      </div>

      {/* Cartouches de rareté */}
      {collection && (
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {RARITY_ORDER.map((rKey) => {
            const meta = RARITY_META[rKey];
            const stat = collection.byRarity[rKey] || { ownedUnique: 0, totalCatalog: 0, totalCopies: 0 };
            const isSelected = rarityFilter === rKey;
            return (
              <button
                key={rKey}
                type="button"
                onClick={() => setRarityFilter(isSelected ? 'ALL' : rKey)}
                className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#D4AF37] bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/50'
                    : 'border-white/10 bg-[#101726] hover:border-white/20'
                }`}
              >
                <div className={`text-[10px] sm:text-xs font-bold ${meta.textAccentClass}`}>
                  {meta.label}
                </div>
                <div className="text-xs sm:text-sm font-mono-tabular font-semibold text-white mt-0.5">
                  {stat.ownedUnique} / {stat.totalCatalog}
                </div>
                <div className="text-[10px] text-slate-400 font-mono-tabular">
                  {stat.totalCopies} exemplaire{stat.totalCopies > 1 ? 's' : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Barre de filtres et recherche */}
      <div className="space-y-3 rounded-xl border border-white/10 bg-[#101726] p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
          {/* Recherche */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une carte..."
              className="w-full rounded-xl bg-[#090D16] border border-white/15 pl-9 pr-3 py-2 sm:py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          {/* Filtre catégorie */}
          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl bg-[#090D16] border border-white/15 px-3 py-2 sm:py-2.5 text-xs text-white"
            >
              <option value="ALL">Toutes catégories</option>
              {collection?.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Tri */}
          <div className="sm:col-span-3">
            <div className="relative">
              <ArrowUpDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="w-full rounded-xl bg-[#090D16] border border-white/15 px-3 py-2 sm:py-2.5 text-xs text-white appearance-none"
              >
                <option value="VIEWS_DESC">Notoriété (12 mois)</option>
                <option value="RARITY_DESC">Rareté (Mythique → Commune)</option>
                <option value="NAME_ASC">Nom alphabétique</option>
                <option value="OWNED_DESC">Exemplaires possédés</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filtre de possession (onglets tactiles) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-1 bg-[#090D16] p-1 rounded-xl border border-white/10 w-full sm:w-auto">
            {(
              [
                { id: 'ALL', label: 'Toutes' },
                { id: 'OWNED', label: 'Possédées' },
                { id: 'DUPLICATES', label: 'Doublons' },
                { id: 'MISSING', label: 'Manquantes' },
              ] as Array<{ id: OwnershipFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOwnershipFilter(tab.id)}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors text-center ${
                  ownershipFilter === tab.id
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] sm:text-xs text-slate-400 font-mono-tabular w-full sm:w-auto text-right">
            {formatNumberFR(totalFiltered)} carte{totalFiltered > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Pagination haut */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div>
          Affichage de {cardsList.length} sur {formatNumberFR(totalFiltered)} cartes
        </div>
        <div className="flex items-center gap-2 font-mono-tabular">
          <span>Page {page} / {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => fetchFilteredCollection(page - 1)}
              className="p-1.5 rounded-lg border border-white/10 bg-[#101726] hover:bg-white/10 disabled:opacity-30 cursor-pointer"
              aria-label="Page précédente"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => fetchFilteredCollection(page + 1)}
              className="p-1.5 rounded-lg border border-white/10 bg-[#101726] hover:bg-white/10 disabled:opacity-30 cursor-pointer"
              aria-label="Page suivante"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grille de cartes */}
      {cardsList.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#101726] p-8 sm:p-12 text-center space-y-2">
          <div className="text-sm font-semibold text-slate-200">
            Aucune carte ne correspond à ce filtre.
          </div>
          <p className="text-xs text-slate-400">
            {ownershipFilter === 'OWNED'
              ? 'Vous ne possédez pas encore de carte avec ce filtre. Ouvrez des boosters pour enrichir votre collection !'
              : 'Essayez de modifier votre recherche ou vos filtres.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {cardsList.map(({ card, ownedCount, lockedCount, instances }) => (
            <div
              key={card.id}
              className={ownedCount === 0 ? 'opacity-85 hover:opacity-100 transition-opacity' : ''}
            >
              <EncyclopediaCard
                card={card}
                ownedCount={ownedCount}
                lockedForAuction={lockedCount > 0}
                onClick={() => onSelectCardWithInstances(card, instances)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Pagination bas */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 pb-6">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => fetchFilteredCollection(page - 1)}
            className="px-4 py-2 rounded-xl border border-white/10 bg-[#101726] text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer active:scale-95"
          >
            Précédent
          </button>
          <span className="text-xs font-mono-tabular text-slate-400 px-3">
            Page {page} sur {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => fetchFilteredCollection(page + 1)}
            className="px-4 py-2 rounded-xl border border-white/10 bg-[#101726] text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer active:scale-95"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};
