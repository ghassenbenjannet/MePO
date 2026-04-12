import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifType = "info" | "success" | "warning" | "error" | "action";
export type NotifCategory = "product" | "ai" | "system";

export interface AppNotification {
  id: string;
  type: NotifType;
  category: NotifCategory;
  title: string;
  description?: string;
  read: boolean;
  createdAt: Date;
  link?: string;
  entityType?: "ticket" | "document" | "topic" | "space" | "project";
  entityId?: string;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
  duration?: number;
}

interface NotificationsState {
  notifications: AppNotification[];
  toasts: Toast[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  addNotification: (notif: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const DEMO: AppNotification[] = [
  {
    id: "n1",
    type: "action",
    category: "ai",
    title: "Shadow Core a analysé votre espace",
    description: "3 risques détectés sur le sprint actuel. Plan de mitigation recommandé.",
    read: false,
    createdAt: new Date(Date.now() - 4 * 60 * 1000),
    entityType: "space",
  },
  {
    id: "n2",
    type: "success",
    category: "ai",
    title: "Ticket généré par Shadow Core",
    description: "« Analyse d'impact multi-établissements » — prêt à valider dans le backlog.",
    read: false,
    createdAt: new Date(Date.now() - 18 * 60 * 1000),
    entityType: "ticket",
  },
  {
    id: "n3",
    type: "success",
    category: "product",
    title: "Espace créé avec succès",
    description: "L'espace « Sprint 5 — Livraisons » est maintenant disponible.",
    read: false,
    createdAt: new Date(Date.now() - 47 * 60 * 1000),
    entityType: "space",
  },
  {
    id: "n4",
    type: "warning",
    category: "product",
    title: "Topic bloqué depuis 3 jours",
    description: "« Intégration SSO » est marqué Bloqué. Action recommandée.",
    read: true,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    entityType: "topic",
  },
  {
    id: "n5",
    type: "info",
    category: "product",
    title: "Document mis à jour",
    description: "Spécification fonctionnelle v2.3 a été modifiée dans Documents.",
    read: true,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    entityType: "document",
  },
  {
    id: "n6",
    type: "info",
    category: "ai",
    title: "Mémoire topic mise à jour",
    description: "Shadow Core a enrichi la mémoire de « Livret patient numérique ».",
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    entityType: "topic",
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: DEMO,
  toasts: [],
  unreadCount: DEMO.filter((n) => !n.read).length,

  markAsRead: (id) =>
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    }),

  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearNotification: (id) =>
    set((s) => {
      const notifications = s.notifications.filter((n) => n.id !== id);
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  addNotification: (notif) =>
    set((s) => {
      const n: AppNotification = { ...notif, id: crypto.randomUUID(), read: false, createdAt: new Date() };
      const notifications = [n, ...s.notifications];
      return { notifications, unreadCount: notifications.filter((x) => !x.read).length };
    }),

  addToast: (toast) => {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? 4500;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => get().removeToast(id), duration);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
