import crypto from 'crypto';
import { DatabaseSchema, StoredUser, db, hashPassword, verifyPassword } from '../db.js';
import { PublicUserProfile, TransactionRecord, TransactionType } from '../../src/types/index.js';
import { BoosterService } from './BoosterService.js';
import { NotificationService } from './NotificationService.js';

export class UserService {
  public static recordCoinTransactionInTx(
    state: DatabaseSchema,
    user: StoredUser,
    deltaAmount: number,
    type: TransactionType,
    reference: string
  ): TransactionRecord {
    const balanceBefore = user.coins;
    const balanceAfter = balanceBefore + deltaAmount;
    if (balanceAfter < 0) {
      throw new Error('Solde de pièces insuffisant pour cette opération.');
    }
    user.coins = balanceAfter;
    user.updatedAt = new Date().toISOString();

    const tx: TransactionRecord = {
      id: `tx-${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      username: user.username,
      amount: deltaAmount,
      type,
      reference,
      balanceBefore,
      balanceAfter,
      createdAt: new Date().toISOString(),
    };
    state.transactions.unshift(tx);
    return tx;
  }

  public static toPublicProfileInTx(state: DatabaseSchema, user: StoredUser): PublicUserProfile {
    const boosterState = BoosterService.synchronizeUserBoostersInTx(state, user.id);
    const owned = state.cardOwnerships.filter((co) => co.userId === user.id);
    const uniqueCardIds = new Set(owned.map((co) => co.cardId));
    const activeAuctionsCount = state.auctions.filter(
      (a) => a.sellerId === user.id && a.status === 'OUVERTE'
    ).length;
    const unreadNotificationsCount = state.notifications.filter(
      (n) => n.userId === user.id && !n.read
    ).length;

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      suspended: user.suspended,
      coins: user.coins,
      createdAt: user.createdAt,
      boosterState,
      stats: {
        totalCards: owned.length,
        uniqueCards: uniqueCardIds.size,
        totalCatalogCards: state.cards.filter((c) => c.active).length,
        activeAuctionsCount,
        unreadNotificationsCount,
      },
    };
  }

  public static async register(params: {
    username: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ token: string; csrfToken: string; user: PublicUserProfile }> {
    const username = params.username.trim();

    if (!username || username.length < 3 || username.length > 28) {
      throw new Error('Le pseudo doit contenir entre 3 et 28 caractères.');
    }
    if (!params.password || params.password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
    }
    if (params.password !== params.confirmPassword) {
      throw new Error('La confirmation du mot de passe ne correspond pas.');
    }

    return db.transaction((state) => {
      if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        throw new Error('Ce pseudo est déjà pris.');
      }

      const { hash, salt } = hashPassword(params.password);
      const now = new Date().toISOString();
      const userId = `user-${crypto.randomUUID().slice(0, 8)}`;

      const newUser: StoredUser = {
        id: userId,
        // L'identifiant de connexion est le pseudo ; cette valeur technique n'est jamais exposée.
        email: `${username.toLowerCase()}@local.gl-collector`,
        username,
        passwordHash: hash,
        passwordSalt: salt,
        emailVerified: true,
        verificationToken: null,
        resetPasswordToken: null,
        resetTokenExpiresAt: null,
        role: 'JOUEUR',
        suspended: false,
        coins: 0,
        createdAt: now,
        updatedAt: now,
      };

      state.users.push(newUser);

      // Nouveau joueur commence avec 10 boosters de bienvenue.
      state.boosterInventories.push({
        id: `bi-${crypto.randomUUID().slice(0, 8)}`,
        userId,
        storedBoosters: 10,
        lastRechargeAt: now,
      });

      this.recordCoinTransactionInTx(
        state,
        newUser,
        1000,
        'BONUS_BIENVENUE',
        'Dotation de bienvenue — Inscription GL Collector'
      );

      NotificationService.pushInTx(
        state,
        userId,
        'BOOSTER_DISPONIBLE',
        'Bienvenue sur GL Collector ! Vous recevez 10 boosters et 1 000 Pièces pour démarrer votre collection.'
      );

      const sessionToken = crypto.randomBytes(24).toString('hex');
      const csrfToken = crypto.randomBytes(16).toString('hex');
      state.sessions[sessionToken] = {
        userId,
        createdAt: now,
        csrfToken,
      };

      db.logAudit(userId, 'USER_REGISTER', `Inscription du joueur ${username}`);

      return {
        token: sessionToken,
        csrfToken,
        user: this.toPublicProfileInTx(state, newUser),
      };
    });
  }

  public static async login(params: {
    identifier: string;
    password: string;
  }): Promise<{ token: string; csrfToken: string; user: PublicUserProfile }> {
    const idClean = params.identifier.trim().toLowerCase();
    return db.transaction((state) => {
      const user = state.users.find(
        (u) => u.username.toLowerCase() === idClean
      );
      if (!user || !verifyPassword(params.password, user.passwordHash, user.passwordSalt)) {
        throw new Error('Identifiants invalides. Vérifiez votre pseudo et mot de passe.');
      }
      if (user.suspended) {
        throw new Error('Ce compte a été suspendu par un administrateur.');
      }

      const sessionToken = crypto.randomBytes(24).toString('hex');
      const csrfToken = crypto.randomBytes(16).toString('hex');
      state.sessions[sessionToken] = {
        userId: user.id,
        createdAt: new Date().toISOString(),
        csrfToken,
      };

      db.logAudit(user.id, 'USER_LOGIN', `Connexion de ${user.username}`);

      return {
        token: sessionToken,
        csrfToken,
        user: this.toPublicProfileInTx(state, user),
      };
    });
  }

  public static async quickSwitchAccount(userId: string): Promise<{
    token: string;
    csrfToken: string;
    user: PublicUserProfile;
  }> {
    return db.transaction((state) => {
      const user = state.users.find((u) => u.id === userId);
      if (!user) throw new Error('Compte introuvable.');
      if (user.suspended) throw new Error('Compte suspendu.');

      const sessionToken = crypto.randomBytes(24).toString('hex');
      const csrfToken = crypto.randomBytes(16).toString('hex');
      state.sessions[sessionToken] = {
        userId: user.id,
        createdAt: new Date().toISOString(),
        csrfToken,
      };
      return {
        token: sessionToken,
        csrfToken,
        user: this.toPublicProfileInTx(state, user),
      };
    });
  }

  public static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('La confirmation ne correspond pas.');
    }
    return db.transaction((state) => {
      const user = state.users.find((u) => u.id === userId);
      if (!user) throw new Error('Utilisateur introuvable.');
      if (!verifyPassword(currentPassword, user.passwordHash, user.passwordSalt)) {
        throw new Error('Le mot de passe actuel est incorrect.');
      }
      const { hash, salt } = hashPassword(newPassword);
      user.passwordHash = hash;
      user.passwordSalt = salt;
      user.updatedAt = new Date().toISOString();
    });
  }

  public static async deleteAccount(userId: string, passwordConfirm: string): Promise<void> {
    return db.transaction((state) => {
      const user = state.users.find((u) => u.id === userId);
      if (!user) throw new Error('Utilisateur introuvable.');
      if (!verifyPassword(passwordConfirm, user.passwordHash, user.passwordSalt)) {
        throw new Error('Mot de passe incorrect.');
      }
      const activeSeller = state.auctions.filter((a) => a.sellerId === userId && a.status === 'OUVERTE');
      if (activeSeller.length > 0) {
        throw new Error('Vous avez des enchères actives. Attendez leur clôture avant de supprimer le compte.');
      }
      state.cardOwnerships = state.cardOwnerships.filter((co) => co.userId !== userId);
      state.boosterInventories = state.boosterInventories.filter((bi) => bi.userId !== userId);
      state.notifications = state.notifications.filter((n) => n.userId !== userId);
      state.users = state.users.filter((u) => u.id !== userId);
      for (const [tok, sess] of Object.entries(state.sessions)) {
        if (sess.userId === userId) {
          delete state.sessions[tok];
        }
      }
    });
  }
}
