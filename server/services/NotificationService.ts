import crypto from 'crypto';
import { DatabaseSchema, db } from '../db.js';
import { NotificationRecord } from '../../src/types/index.js';

export class NotificationService {
  public static pushInTx(
    state: DatabaseSchema,
    userId: string,
    type: NotificationRecord['type'],
    message: string
  ): NotificationRecord {
    const notif: NotificationRecord = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      userId,
      type,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    state.notifications.unshift(notif);
    return notif;
  }

  public static getForUser(userId: string): NotificationRecord[] {
    return db.state.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public static async markAsRead(userId: string, notificationId?: string): Promise<NotificationRecord[]> {
    return db.transaction((state) => {
      for (const notif of state.notifications) {
        if (notif.userId === userId) {
          if (!notificationId || notif.id === notificationId) {
            notif.read = true;
          }
        }
      }
      return state.notifications.filter((n) => n.userId === userId);
    });
  }
}
