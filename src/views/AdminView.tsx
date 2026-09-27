import React, { useEffect, useState } from 'react';
import { Database, Package, RefreshCw, Sparkles, Users } from 'lucide-react';
import {
  BoosterProbabilities,
  RarityRunSummary,
  RarityThresholds,
  SystemConfig,
  WikiImportLog,
} from '../types';
import { apiRequest } from '../lib/api';

interface AdminOverviewData {
  config: SystemConfig;
  users: Array<{
    id: string;
    username: string;
    role: string;
    suspended: boolean;
    coins: number;
    ownedCount: number;
  }>;
  cardsCount: number;
  importLogs: WikiImportLog[];
  rarityRuns: RarityRunSummary[];
}

interface AdminViewProps {
  onSystemConfigChanged: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onSystemConfigChanged }) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [thresholds, setThresholds] = useState<RarityThresholds>({
    MYTHIQUE: 1,
    LEGENDAIRE: 5,
    EPIQUE: 10,
    RARE: 25,
    PEU_COMMUNE: 50,
  });

  const [cardsPerBooster, setCardsPerBooster] = useState(5);
  const [rechargeMinutes, setRechargeMinutes] = useState(10);
  const [maxBoosters, setMaxBoosters] = useState(10);
  const [probabilities, setProbabilities] = useState<BoosterProbabilities>({
    COMMUNE: 60,
    PEU_COMMUNE: 25,
    RARE: 10,
    EPIQUE: 4,
    LEGENDAIRE: 0.9,
    MYTHIQUE: 0.1,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AdminOverviewData>('/api/admin/overview');
      setData(res);
      setThresholds(res.config.rarityThresholds);
      setCardsPerBooster(res.config.cardsPerBooster);
      setRechargeMinutes(res.config.boosterRechargeMinutes);
      setMaxBoosters(res.config.maxBoosters);
      setProbabilities(res.config.boosterProbabilities);
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunAnnualCalc = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ summary: RarityRunSummary }>('/api/admin/rarity/calculate', {
        method: 'POST',
        body: {},
      });
      await loadData();
      onSystemConfigChanged();
      setMsg({
        type: 'ok',
        text: `Calcul des raretés exécuté avec succès sur les ${res.summary.totalCards} cartes !`,
      });
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await apiRequest('/api/admin/rarity/thresholds', {
        method: 'POST',
        body: { thresholds },
      });
      await loadData();
      onSystemConfigChanged();
      setMsg({ type: 'ok', text: 'Seuils centiles enregistrés.' });
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    }
  };

  const handleSaveBoosterConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await apiRequest('/api/admin/boosters/config', {
        method: 'POST',
        body: {
          cardsPerBooster,
          boosterRechargeMinutes: rechargeMinutes,
          maxBoosters,
          probabilities,
        },
      });
      await loadData();
      onSystemConfigChanged();
      setMsg({ type: 'ok', text: 'Configuration des boosters mise à jour.' });
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    }
  };

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Chargement de l’espace d’administration...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F8F5EE]">
            Administration GL Collector
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gouvernance des {data.cardsCount} cartes du répertoire GL Collector et probabilités de tirage.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 text-xs text-slate-200 hover:bg-white/10 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs ${
            msg.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calcul des raretés */}
        <div className="lg:col-span-6 rounded-xl border border-white/10 bg-[#101726] p-6 space-y-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F3D266]">
            <Sparkles className="w-4 h-4" />
            <span>Calcul des raretés ({data.cardsCount} cartes)</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Le calcul classe l'intégralité des {data.cardsCount} pages selon leur popularité et attribue une rareté à chaque carte.
          </p>

          <form onSubmit={handleSaveThresholds} className="space-y-3 border-t border-white/10 pt-3">
            <div className="text-xs font-semibold text-slate-200">
              Seuils centiles configurables :
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-slate-400">Mythique</label>
                <input
                  type="number"
                  step="0.5"
                  value={thresholds.MYTHIQUE}
                  onChange={(e) => setThresholds({ ...thresholds, MYTHIQUE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2.5 py-1 text-white font-mono-tabular"
                />
              </div>
              <div>
                <label className="text-slate-400">Légendaire</label>
                <input
                  type="number"
                  step="0.5"
                  value={thresholds.LEGENDAIRE}
                  onChange={(e) => setThresholds({ ...thresholds, LEGENDAIRE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2.5 py-1 text-white font-mono-tabular"
                />
              </div>
              <div>
                <label className="text-slate-400">Épique</label>
                <input
                  type="number"
                  step="0.5"
                  value={thresholds.EPIQUE}
                  onChange={(e) => setThresholds({ ...thresholds, EPIQUE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2.5 py-1 text-white font-mono-tabular"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded bg-white/10 text-xs text-white hover:bg-white/15 cursor-pointer"
            >
              Enregistrer les seuils
            </button>
          </form>

          <div className="border-t border-white/10 pt-4 flex items-end gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleRunAnnualCalc}
              className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#0B101B] font-semibold text-xs hover:bg-[#E5C354] cursor-pointer"
            >
              Mettre à jour les raretés
            </button>
          </div>
        </div>

        {/* Configuration des Boosters */}
        <form
          onSubmit={handleSaveBoosterConfig}
          className="lg:col-span-6 rounded-xl border border-white/10 bg-[#101726] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Package className="w-4 h-4" />
            <span>Paramètres des Boosters & Probabilités</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cartes / booster</label>
              <input
                type="number"
                min={1}
                max={15}
                value={cardsPerBooster}
                onChange={(e) => setCardsPerBooster(Number(e.target.value))}
                className="w-full rounded bg-[#090D16] border border-white/15 px-2.5 py-1.5 text-xs text-white font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Recharge (min)</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={rechargeMinutes}
                onChange={(e) => setRechargeMinutes(Number(e.target.value))}
                className="w-full rounded bg-[#090D16] border border-white/15 px-2.5 py-1.5 text-xs text-white font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Stock max</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxBoosters}
                onChange={(e) => setMaxBoosters(Number(e.target.value))}
                className="w-full rounded bg-[#090D16] border border-white/15 px-2.5 py-1.5 text-xs text-white font-mono-tabular"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
            <div className="text-slate-300 font-medium">Probabilités par carte (%) :</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-slate-400">Commune</label>
                <input
                  type="number"
                  step="0.1"
                  value={probabilities.COMMUNE}
                  onChange={(e) => setProbabilities({ ...probabilities, COMMUNE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2 py-1 text-white font-mono-tabular"
                />
              </div>
              <div>
                <label className="text-slate-400">Peu commune</label>
                <input
                  type="number"
                  step="0.1"
                  value={probabilities.PEU_COMMUNE}
                  onChange={(e) => setProbabilities({ ...probabilities, PEU_COMMUNE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2 py-1 text-white font-mono-tabular"
                />
              </div>
              <div>
                <label className="text-slate-400">Rare</label>
                <input
                  type="number"
                  step="0.1"
                  value={probabilities.RARE}
                  onChange={(e) => setProbabilities({ ...probabilities, RARE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2 py-1 text-white font-mono-tabular"
                />
              </div>
              <div>
                <label className="text-slate-400">Épique</label>
                <input
                  type="number"
                  step="0.1"
                  value={probabilities.EPIQUE}
                  onChange={(e) => setProbabilities({ ...probabilities, EPIQUE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2 py-1 text-white font-mono-tabular"
                />
              </div>
              <div>
                <label className="text-slate-400">Légendaire</label>
                <input
                  type="number"
                  step="0.1"
                  value={probabilities.LEGENDAIRE}
                  onChange={(e) => setProbabilities({ ...probabilities, LEGENDAIRE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2 py-1 text-white font-mono-tabular"
                />
              </div>
              <div>
                <label className="text-slate-400">Mythique</label>
                <input
                  type="number"
                  step="0.1"
                  value={probabilities.MYTHIQUE}
                  onChange={(e) => setProbabilities({ ...probabilities, MYTHIQUE: Number(e.target.value) })}
                  className="w-full rounded bg-[#090D16] border border-white/15 px-2 py-1 text-white font-mono-tabular"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#0B101B] font-semibold text-xs hover:bg-[#E5C354] cursor-pointer"
          >
            Sauvegarder
          </button>
        </form>
      </div>

      {/* Utilisateurs inscrits */}
      <div className="rounded-xl border border-white/10 bg-[#101726] p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Users className="w-4 h-4" />
          <span>Utilisateurs ({data.users.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-[#0B101B]/60">
                <th className="py-2.5 px-3">Pseudo</th>
                <th className="py-2.5 px-3">Rôle</th>
                <th className="py-2.5 px-3">Pièces</th>
                <th className="py-2.5 px-3">Cartes possédées</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 px-3 font-semibold text-white">{u.username}</td>
                  <td className="py-2 px-3 text-slate-400 font-mono-tabular">{u.role}</td>
                  <td className="py-2 px-3 text-[#F3D266] font-mono-tabular">{u.coins} P.</td>
                  <td className="py-2 px-3 font-mono-tabular text-slate-300">{u.ownedCount} ex.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
