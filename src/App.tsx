import React, { useEffect, useState, useCallback, useTransition } from 'react';
import {
  Bell,
  Coins,
  Compass,
  Gavel,
  Layers,
  PackageOpen,
  ShieldCheck,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AuctionRecord,
  BoosterOpeningResult,
  CardRecord,
  NotificationRecord,
  PopulatedCardOwnership,
  PublicUserProfile,
  SystemConfig,
  TransactionRecord,
} from './types';
import { formatCountdown, formatNumberFR } from './lib/rarity';
import { soundEngine } from './lib/sound';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api';
import { deviceCache } from './lib/cache';

import { HomeView } from './views/HomeView';
import { CollectionView, CollectionData } from './views/CollectionView';
import { BoostersView } from './views/BoostersView';
import { AuctionsView } from './views/AuctionsView';
import { ProfileAndAuthView } from './views/ProfileAndAuthView';
import { AdminView } from './views/AdminView';
import { CardDetailModal } from './components/CardDetailModal';

type NavTab = 'home' | 'collection' | 'boosters' | 'auctions' | 'profile' | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [, startTransition] = useTransition();

  // Le profil et les données de jeu restent uniquement en mémoire pendant la session.
  const [user, setUser] = useState<PublicUserProfile | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(() => {
    return deviceCache.get<SystemConfig>('cached_config')?.data || null;
  });
  const [showcaseCards, setShowcaseCards] = useState<CardRecord[]>(() => {
    return deviceCache.get<CardRecord[]>('cached_showcase')?.data || [];
  });
  const [totalCatalogCards, setTotalCatalogCards] = useState<number>(() => {
    return deviceCache.get<number>('cached_total_cards')?.data || 7959;
  });
  const [demoAccounts, setDemoAccounts] = useState<
    Array<{ id: string; username: string; role: string; coins: number }>
  >([]);

  // Real-time Auctions & Collection State
  const [auctions, setAuctions] = useState<AuctionRecord[]>([]);
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [availableCopies, setAvailableCopies] = useState<PopulatedCardOwnership[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  // Selected Card for modal display & quick listing
  const [selectedCardForModal, setSelectedCardForModal] = useState<{
    card: CardRecord;
    instances: PopulatedCardOwnership[];
  } | null>(null);

  // Audio & UI
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [liveCountdown, setLiveCountdown] = useState<number | null>(null);

  // Initial Load & Auth State Sync avec mise en cache locale
  const loadInitialData = useCallback(async () => {
    try {
      const res = await apiRequest<{
        user: PublicUserProfile | null;
        config: SystemConfig;
        showcaseCards: CardRecord[];
        totalCatalogCards: number;
        openAuctionsCount: number;
        demoAccounts: Array<{ id: string; username: string; role: string; coins: number }>;
      }>('/api/bootstrap', { useCache: true, cacheTTL: 3 * 60 * 1000 });

      setUser(res.user);
      setConfig(res.config);
      setShowcaseCards(res.showcaseCards || []);
      setTotalCatalogCards(res.totalCatalogCards || 7959);
      setDemoAccounts(res.demoAccounts || []);

      // Sauvegarde dans la mémoire locale de l'appareil
      if (res.config) deviceCache.set('cached_config', res.config, 60 * 60 * 1000);
      if (res.showcaseCards) deviceCache.set('cached_showcase', res.showcaseCards, 60 * 60 * 1000);
      deviceCache.set('cached_total_cards', res.totalCatalogCards || 7959, 60 * 60 * 1000);

      if (res.user?.boosterState?.secondsUntilNextBooster !== undefined) {
        setLiveCountdown(res.user.boosterState.secondsUntilNextBooster);
      }
    } catch (err) {
      console.error('Erreur chargement bootstrap:', err);
    }
  }, []);

  const refreshAuctions = useCallback(async () => {
    try {
      const res = await apiRequest<{ auctions: AuctionRecord[] }>('/api/auctions');
      setAuctions(res.auctions || []);
    } catch {
      // Ignore
    }
  }, []);

  const refreshCollection = useCallback(async () => {
    try {
      const res = await apiRequest<CollectionData>('/api/collection?page=1&limit=36', {
        useCache: true,
        cacheTTL: 2 * 60 * 1000,
      });
      setCollection(res);

      const copies: PopulatedCardOwnership[] = [];
      res.cards?.forEach((entry) => {
        entry.instances?.forEach((inst) => {
          if (!inst.lockedForAuction) {
            copies.push({ ...inst, card: entry.card });
          }
        });
      });
      setAvailableCopies(copies);
    } catch {
      // Ignore
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setTransactions([]);
      setNotifications([]);
      return;
    }

    try {
      const [boostRes, txRes, notifRes] = await Promise.allSettled([
        apiRequest<{ boosterState: PublicUserProfile['boosterState'] }>('/api/boosters/status'),
        apiRequest<{ transactions: TransactionRecord[] }>('/api/transactions'),
        apiRequest<{ notifications: NotificationRecord[] }>('/api/notifications'),
      ]);

      if (boostRes.status === 'fulfilled') {
        setUser((prev) => {
          const next = prev ? { ...prev, boosterState: boostRes.value.boosterState } : prev;
          return next;
        });
        setLiveCountdown(boostRes.value.boosterState.secondsUntilNextBooster);
      }
      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.transactions || []);
      }
      if (notifRes.status === 'fulfilled') {
        setNotifications(notifRes.value.notifications || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    refreshAuctions();
    refreshCollection();
  }, [loadInitialData, refreshAuctions, refreshCollection]);

  // Booster Countdown ticker
  useEffect(() => {
    if (liveCountdown === null || liveCountdown <= 0) return;
    const interval = setInterval(() => {
      setLiveCountdown((prev) => {
        if (prev === null || prev <= 1) {
          refreshUserData();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [liveCountdown, refreshUserData]);

  // Handle Tab navigation instantanée
  const handleNavigate = (tab: NavTab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
    if (tab === 'auctions') refreshAuctions();
    if (tab === 'collection') refreshCollection();
  };

  // Booster Opening Action
  const handleOpenBooster = async (): Promise<BoosterOpeningResult> => {
    const result = await apiRequest<BoosterOpeningResult & { user: PublicUserProfile }>(
      '/api/boosters/open',
      { method: 'POST', idempotent: true }
    );
    setUser(result.user);
    deviceCache.invalidate('api_/api/collection');
    setLiveCountdown(result.boosterState.secondsUntilNextBooster);
    refreshCollection();
    refreshUserData();
    return result;
  };

  // Place Bid Action
  const handlePlaceBid = async (auctionId: string, amount: number): Promise<void> => {
    const res = await apiRequest<{ auction: AuctionRecord; user: PublicUserProfile }>(
      `/api/auctions/${auctionId}/bid`,
      {
        method: 'POST',
        body: { amount },
        idempotent: true,
      }
    );
    setUser(res.user);
    soundEngine.playCoinsSuccess();
    await refreshAuctions();
    await refreshUserData();
  };

  // Create Auction Action
  const handleCreateAuction = async (params: {
    cardOwnershipId: string;
    startingPrice: number;
    durationMinutes: number;
  }): Promise<void> => {
    const res = await apiRequest<{ auction: AuctionRecord; user: PublicUserProfile }>(
      '/api/auctions/create',
      {
        method: 'POST',
        body: params,
        idempotent: true,
      }
    );
    setUser(res.user);
    deviceCache.invalidate('api_/api/collection');
    soundEngine.playGavelImpact();
    await refreshAuctions();
    await refreshCollection();
    if (selectedCardForModal) {
      setSelectedCardForModal(null);
    }
  };

  // Settle Auction Action
  const handleSettleAuction = async (auctionId: string): Promise<void> => {
    const res = await apiRequest<{ auction: AuctionRecord; user: PublicUserProfile }>(
      `/api/auctions/${auctionId}/settle`,
      { method: 'POST' }
    );
    setUser(res.user);
    deviceCache.invalidate('api_/api/collection');
    await refreshAuctions();
    await refreshCollection();
    await refreshUserData();
  };

  // Cancel Auction Action
  const handleCancelAuction = async (auctionId: string): Promise<void> => {
    const res = await apiRequest<{ auction: AuctionRecord; user: PublicUserProfile }>(
      `/api/auctions/${auctionId}/cancel`,
      { method: 'POST' }
    );
    setUser(res.user);
    deviceCache.invalidate('api_/api/collection');
    await refreshAuctions();
    await refreshCollection();
  };

  // Auth Callbacks
  const handleAuthSuccess = (token: string, userProfile: PublicUserProfile) => {
    setStoredToken(token);
    setUser(userProfile);
    refreshCollection();
    refreshUserData();
  };

  const handleUserUpdated = (updated: PublicUserProfile) => {
    setUser(updated);
  };

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredToken(null);
    setUser(null);
    setTransactions([]);
    setNotifications([]);
    deviceCache.clear();
    refreshCollection();
    setActiveTab('home');
  };

  const handleQuickSwitch = async (targetUserId: string) => {
    try {
      const res = await apiRequest<{ token: string; user: PublicUserProfile }>(
        '/api/auth/quick-switch',
        {
          method: 'POST',
          body: { userId: targetUserId },
        }
      );
      setStoredToken(res.token);
      setUser(res.user);
      deviceCache.invalidate('api_/api/collection');
      await refreshCollection();
      await refreshUserData();
      await refreshAuctions();
    } catch (err) {
      console.error('Quick switch failed:', err);
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.setEnabled(next);
  };

  const handleMarkNotificationsRead = async (notificationId?: string) => {
    try {
      const res = await apiRequest<{ notifications: NotificationRecord[] }>('/api/notifications/read', {
        method: 'POST', body: notificationId ? { notificationId } : {},
      });
      setNotifications(res.notifications || []);
      setUser((previous) => previous ? {
        ...previous,
        stats: { ...previous.stats, unreadNotificationsCount: (res.notifications || []).filter((n) => !n.read).length },
      } : previous);
    } catch (error) { console.error('Impossible de marquer la notification comme lue', error); }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#0B101B] text-[#F1EFEA] flex flex-col selection:bg-[#F3D266]/30 selection:text-amber-200">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 bg-[#0E1526]/95 backdrop-blur border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
          {/* Logo & Brand */}
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="flex items-center gap-2.5 sm:gap-3 text-left group focus:outline-none cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-300 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200 shrink-0">
              <Compass className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 animate-[spin_24s_linear_infinite]" />
            </div>
            <div>
              <span className="font-display font-bold text-base sm:text-lg tracking-wider text-[#F8F5EE] group-hover:text-[#F3D266] transition-colors block leading-tight">
                GL Collector
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400 block font-sans">
                {totalCatalogCards} cartes indexées
              </span>
            </div>
          </button>

          {/* Navigation Desktop Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => handleNavigate('home')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-[#F3D266] text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Accueil
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('collection')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'collection'
                  ? 'bg-[#F3D266] text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Collection</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('boosters')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'boosters'
                  ? 'bg-[#F3D266] text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <PackageOpen className="w-3.5 h-3.5" />
              <span>Boosters</span>
              {user && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-400/20 text-[#F3D266] rounded-full text-[10px] font-bold">
                  {user.boosterState.availableBoosters}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('auctions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'auctions'
                  ? 'bg-[#F3D266] text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Gavel className="w-3.5 h-3.5" />
              <span>Enchères</span>
              {auctions.filter((a) => a.status === 'OUVERTE').length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded-full text-[10px] font-bold">
                  {auctions.filter((a) => a.status === 'OUVERTE').length}
                </span>
              )}
            </button>
            {user?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Right Controls: Coins, Boosters, Sound, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              title={soundEnabled ? 'Désactiver les sons' : 'Activer les sons'}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {user ? (
              <>
                {/* Coins Badge */}
                <div
                  onClick={() => handleNavigate('profile')}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#F3D266] text-xs font-bold font-mono-tabular cursor-pointer hover:bg-amber-500/20 transition-colors"
                >
                  <Coins className="w-3.5 h-3.5 shrink-0 text-[#F3D266]" />
                  <span>{formatNumberFR(user.coins)} ฿</span>
                </div>

                {/* Boosters Quick Status (desktop) */}
                <button
                  type="button"
                  onClick={() => handleNavigate('boosters')}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  <PackageOpen className="w-4 h-4 text-[#F3D266]" />
                  <span>
                    <strong>{user.boosterState.availableBoosters}</strong>/
                    {user.boosterState.maxBoosters}
                  </span>
                  {liveCountdown !== null && liveCountdown > 0 && (
                    <span className="text-[11px] text-amber-300 font-mono-tabular">
                      +{formatCountdown(liveCountdown)}
                    </span>
                  )}
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors relative cursor-pointer"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold flex items-center justify-center text-white">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-72 sm:w-80 max-h-96 overflow-y-auto rounded-xl bg-[#111728] border border-white/10 shadow-2xl p-3 z-50 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Notifications ({notifications.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNotifications(false)}
                          className="text-[11px] text-[#F3D266] hover:underline cursor-pointer"
                        >
                          Fermer
                        </button>
                        {unreadNotificationsCount > 0 && (
                          <button type="button" onClick={() => handleMarkNotificationsRead()} className="text-[11px] text-emerald-300 hover:underline cursor-pointer">
                            Tout marquer comme lu
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">
                          Aucune notification
                        </p>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <div
                            key={n.id}
                            className={`p-2 rounded-lg text-xs transition-colors ${
                              n.read ? 'bg-white/5 text-slate-400' : 'bg-amber-500/10 text-slate-200 border-l-2 border-amber-400'
                            }`}
                          >
                            <div className="flex gap-2 justify-between"><p className="leading-relaxed">{n.message}</p>{!n.read && <button type="button" onClick={() => handleMarkNotificationsRead(n.id)} className="shrink-0 text-[10px] text-[#F3D266] hover:underline cursor-pointer">Lu</button>}</div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                              {new Date(n.createdAt).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Profile Button */}
                <button
                  type="button"
                  onClick={() => handleNavigate('profile')}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#F8F5EE] transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-[#F3D266]" />
                  <span className="max-w-[100px] truncate">{user.username}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleNavigate('profile')}
                className="px-3 sm:px-4 py-1.5 rounded-xl bg-[#F3D266] hover:bg-amber-300 text-slate-950 text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Connexion
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area (padding adapté pour ne pas être masqué par la barre mobile) */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-8">
        {activeTab === 'home' && (
          <HomeView
            user={user}
            config={config}
            showcaseCards={showcaseCards}
            totalCatalogCards={totalCatalogCards}
            openAuctionsCount={auctions.filter((a) => a.status === 'OUVERTE').length}
            liveCountdown={liveCountdown}
            onNavigate={handleNavigate}
            onSelectCard={(card) => setSelectedCardForModal({ card, instances: [] })}
          />
        )}

        {activeTab === 'collection' && (
          <CollectionView
            collection={collection}
            isAuthenticated={Boolean(user)}
            onSelectCardWithInstances={(card, instances) =>
              setSelectedCardForModal({ card, instances })
            }
          />
        )}

        {activeTab === 'boosters' && (
          <BoostersView
            user={user}
            config={config}
            liveCountdown={liveCountdown}
            onOpenBooster={handleOpenBooster}
            onSelectCard={(card) => setSelectedCardForModal({ card, instances: [] })}
            onRequireAuth={() => handleNavigate('profile')}
          />
        )}

        {activeTab === 'auctions' && (
          <AuctionsView
            auctions={auctions}
            user={user}
            availableUserCopies={availableCopies}
            onPlaceBid={handlePlaceBid}
            onCreateAuction={handleCreateAuction}
            onSettleAuctionNow={handleSettleAuction}
            onCancelAuction={handleCancelAuction}
            onSelectCard={(card) => setSelectedCardForModal({ card, instances: [] })}
            onRequireAuth={() => handleNavigate('profile')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileAndAuthView
            user={user}
            transactions={transactions}
            demoAccounts={demoAccounts}
            onAuthSuccess={handleAuthSuccess}
            onUserUpdated={handleUserUpdated}
            onLogout={handleLogout}
            onQuickSwitchAccount={handleQuickSwitch}
          />
        )}

        {activeTab === 'admin' && (
          <AdminView
            onSystemConfigChanged={() => {
              loadInitialData();
              refreshAuctions();
              refreshCollection();
            }}
          />
        )}
      </main>

      {/* Detail & Auction Listing Modal */}
      {selectedCardForModal && (
        <CardDetailModal
          card={selectedCardForModal.card}
          instances={selectedCardForModal.instances}
          isAuthenticated={Boolean(user)}
          onClose={() => setSelectedCardForModal(null)}
          onCreateAuction={handleCreateAuction}
        />
      )}

      {/* Footer (masqué ou avec marge sur mobile) */}
      <footer className="mt-auto border-t border-white/10 bg-[#070B14] py-8 text-xs text-slate-400 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <Compass className="w-4 h-4 text-[#F3D266]" />
            <span>
              GL Collector — {totalCatalogCards} cartes officielles indexées
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] sm:text-xs">
            <span>Rareté actualisée par notoriété 12 mois</span>
            <span>Boosters gratuits : 1 toutes les 10 min (max 10)</span>
            <span className="text-slate-500">Données 100% locales</span>
          </div>
        </div>
      </footer>

      {/* Barre de navigation mobile ergonomique fixée en bas (Bottom Navigation Bar) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E1526]/95 backdrop-blur-md border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
        <button
          type="button"
          onClick={() => handleNavigate('home')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] active:scale-95 ${
            activeTab === 'home' ? 'text-[#F3D266]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Accueil</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('collection')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] active:scale-95 ${
            activeTab === 'collection' ? 'text-[#F3D266]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Cartes</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('boosters')}
          className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] active:scale-95 ${
            activeTab === 'boosters' ? 'text-[#F3D266]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PackageOpen className="w-5 h-5" />
          {user && (
            <span className="absolute top-0 right-1 px-1.5 py-0.2 bg-[#D4AF37] text-slate-950 rounded-full text-[9px] font-extrabold shadow">
              {user.boosterState.availableBoosters}
            </span>
          )}
          <span className="text-[10px] font-semibold mt-0.5">Boosters</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('auctions')}
          className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] active:scale-95 ${
            activeTab === 'auctions' ? 'text-[#F3D266]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gavel className="w-5 h-5" />
          {auctions.filter((a) => a.status === 'OUVERTE').length > 0 && (
            <span className="absolute top-0 right-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-extrabold shadow">
              {auctions.filter((a) => a.status === 'OUVERTE').length}
            </span>
          )}
          <span className="text-[10px] font-semibold mt-0.5">Enchères</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('profile')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] active:scale-95 ${
            activeTab === 'profile' ? 'text-[#F3D266]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Profil</span>
        </button>

        {user?.role === 'ADMIN' && (
          <button
            type="button"
            onClick={() => handleNavigate('admin')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[56px] active:scale-95 ${
              activeTab === 'admin' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
}
