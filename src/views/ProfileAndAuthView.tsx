import React, { useState } from 'react';
import {
  Coins,
  KeyRound,
  LogIn,
  LogOut,
  ShieldAlert,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { PublicUserProfile, TransactionRecord } from '../types';
import { formatNumberFR } from '../lib/rarity';
import { apiRequest } from '../lib/api';
import { validatePasswordStrength } from '../lib/security';

interface ProfileAndAuthViewProps {
  user: PublicUserProfile | null;
  transactions: TransactionRecord[];
  demoAccounts: Array<{ id: string; username: string; role: string; coins: number }>;
  onAuthSuccess: (token: string, user: PublicUserProfile) => void;
  onUserUpdated: (user: PublicUserProfile) => void;
  onLogout: () => void;
  onQuickSwitchAccount: (userId: string) => void;
}

type AuthSubMode = 'LOGIN' | 'REGISTER';

export const ProfileAndAuthView: React.FC<ProfileAndAuthViewProps> = ({
  user,
  transactions,
  demoAccounts,
  onAuthSuccess,
  onUserUpdated,
  onLogout,
  onQuickSwitchAccount,
}) => {
  const [authMode, setAuthMode] = useState<AuthSubMode>('LOGIN');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [currPwd, setCurrPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: PublicUserProfile }>('/api/auth/login', {
        method: 'POST',
        body: { identifier: loginIdentifier, password: loginPassword },
      });
      onAuthSuccess(res.token, res.user);
      setStatusMsg({ type: 'ok', text: `Bienvenue, ${res.user.username} !` });
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{
        token: string;
        user: PublicUserProfile;
      }>('/api/auth/register', {
        method: 'POST',
        body: {
          username: regUsername,
          password: regPassword,
          confirmPassword: regConfirmPassword,
        },
      });
      onAuthSuccess(res.token, res.user);
      setStatusMsg({
        type: 'ok',
        text: `Compte créé avec succès ! 10 boosters et 1 000 Pièces ont été ajoutés à votre inventaire.`,
      });
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };


  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword: currPwd,
          newPassword: newPwd,
          confirmPassword: confPwd,
        },
      });
      setCurrPwd('');
      setNewPwd('');
      setConfPwd('');
      setStatusMsg({ type: 'ok', text: res.message });
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);
    try {
      await apiRequest('/api/auth/delete-account', {
        method: 'POST',
        body: { password: deletePassword },
      });
      onLogout();
    } catch (err) {
      setStatusMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="border-b border-white/10 pb-5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F8F5EE]">
            Compte Joueur & Authentification
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Rejoignez GL Collector pour recevoir 10 boosters offerts et 1 000 Pièces de bienvenue. Vos données de jeu sont protégées.
          </p>
        </div>

        {statusMsg && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs ${
              statusMsg.type === 'ok'
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-7 rounded-xl border border-white/10 bg-[#101726] p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setAuthMode('LOGIN')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  authMode === 'LOGIN'
                    ? 'bg-[#D4AF37] text-[#0B101B] font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('REGISTER')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  authMode === 'REGISTER'
                    ? 'bg-[#D4AF37] text-[#0B101B] font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Inscription (Nouveau joueur)
              </button>
            </div>

            {authMode === 'LOGIN' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Pseudo
                  </label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Capitaine_Archiviste"
                    className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#D4AF37] text-[#0B101B] font-semibold text-xs hover:bg-[#E5C354] cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Se connecter</span>
                </button>
              </form>
            )}

            {authMode === 'REGISTER' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Pseudo unique
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="ex: Gol_D_Roger"
                    className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min. 6 caractères"
                      className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Confirmation
                    </label>
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Confirmez"
                      className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#D4AF37] text-[#0B101B] font-bold text-xs hover:bg-[#E5C354] cursor-pointer shadow-lg active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Créer mon compte joueur</span>
                </button>
              </form>
            )}

          </div>

          <div className="md:col-span-5 rounded-xl border border-white/10 bg-[#101726] p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">
              Comptes existants
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sélectionnez un compte existant pour vous connecter rapidement :
            </p>
            <div className="space-y-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onQuickSwitchAccount(acc.id)}
                  className="w-full text-left rounded-lg border border-white/10 bg-[#090D16] p-3 hover:border-[#D4AF37] cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>{acc.username}</span>
                    <span className="font-mono-tabular text-[#F3D266]">
                      {formatNumberFR(acc.coins)} Pièces
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Rôle : {acc.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="text-xs text-slate-400 font-mono-tabular">
            ID JOUEUR : {user.id} · CRÉÉ LE {new Date(user.createdAt).toLocaleDateString('fr-FR')}
          </div>
          <h1 className="font-display text-3xl font-bold text-[#F8F5EE] mt-1">
            Profil de {user.username}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-1">
            <span>Cartes possédées : <strong>{user.stats.totalCards}</strong> (sur 7 959 cartes)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10 cursor-pointer self-start md:self-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs ${
            statusMsg.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
          }`}
        >
          {statusMsg.text}
        </div>
      )}


      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#F3D266]" />
              <span>Registre officiel de vos transactions ({transactions.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Traçabilité comptable immuable de vos Pièces (solde avant / solde après).
            </p>
          </div>
          <div className="text-right font-mono-tabular">
            <div className="text-xs text-slate-400">Solde</div>
            <div className="text-lg font-bold text-[#F3D266]">
              {formatNumberFR(user.coins)} Pièces
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#101726]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-[#0B101B]/60">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Référence</th>
                <th className="py-3 px-4 font-medium text-right">Solde avant</th>
                <th className="py-3 px-4 font-medium text-right">Montant</th>
                <th className="py-3 px-4 font-medium text-right">Solde après</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucune transaction pour le moment.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono-tabular text-slate-400 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-200">{tx.type}</td>
                    <td className="py-3 px-4 text-slate-300">{tx.reference}</td>
                    <td className="py-3 px-4 font-mono-tabular text-right text-slate-400">
                      {formatNumberFR(tx.balanceBefore)} P.
                    </td>
                    <td
                      className={`py-3 px-4 font-mono-tabular font-semibold text-right whitespace-nowrap ${
                        tx.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {tx.amount >= 0 ? `+${formatNumberFR(tx.amount)}` : formatNumberFR(tx.amount)} P.
                    </td>
                    <td className="py-3 px-4 font-mono-tabular font-semibold text-right text-white">
                      {formatNumberFR(tx.balanceAfter)} P.
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
        <form onSubmit={handleChangePassword} className="rounded-xl border border-white/10 bg-[#101726] p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#F3D266]" />
            <span>Modifier le mot de passe</span>
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              required
              value={currPwd}
              onChange={(e) => setCurrPwd(e.target.value)}
              className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="password"
              required
              placeholder="Nouveau mot de passe"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2 text-xs text-white"
            />
            <input
              type="password"
              required
              placeholder="Confirmation"
              value={confPwd}
              onChange={(e) => setConfPwd(e.target.value)}
              className="w-full rounded-lg bg-[#090D16] border border-white/15 px-3 py-2 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#0B101B] font-semibold text-xs hover:bg-[#E5C354] cursor-pointer"
          >
            Changer le mot de passe
          </button>
        </form>

        <form onSubmit={handleDeleteAccount} className="rounded-xl border border-rose-500/30 bg-[#101726] p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Suppression du compte</span>
            </h3>
            <p className="text-xs text-slate-400">
              Suppression définitive. Impossible si des enchères sont en cours.
            </p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Confirmez votre mot de passe</label>
            <input
              type="password"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full rounded-lg bg-[#090D16] border border-rose-500/30 px-3 py-2 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-rose-500/50 bg-rose-950/40 text-rose-200 text-xs font-medium hover:bg-rose-900/50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
            <span>Supprimer définitivement</span>
          </button>
        </form>
      </div>
    </div>
  );
};
