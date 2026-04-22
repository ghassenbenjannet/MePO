import { create } from "zustand";

export type NotifType = "success" | "error" | "warning" | "info" | "action";
export type NotifCategory = "product" | "ai";

export interface AppNotification {
  id: string;
  type: NotifType;
  category: NotifCategory;
  title: string;
  description?: string;
  duration?: number;
  createdAt: Date;
  read: boolean;
}

export type Toast = AppNotification;

export interface ToastInput {
  type: NotifType;
  title: string;
  description?: string;
  duration?: number;
  category?: NotifCategory;
}

interface NotificationsState {
  notifications: AppNotification[];
  toasts: AppNotification[];
  unreadCount: number;
  addToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
  markAsRead: (id: string) => void;
  clearNotification: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

function computeUnreadCount(notifications: AppNotification[]) {
  return notifications.filter((notification) => !notification.read).length;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  toasts: [],
  unreadCount: 0,

  addToast: (toast) => {
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      type: toast.type,
      category: toast.category ?? (toast.type === "action" ? "ai" : "product"),
      title: toast.title,
      description: toast.description,
      duration: toast.duration ?? 4500,
      createdAt: new Date(),
      read: false,
    };

    set((state) => {
      const notifications = [notification, ...state.notifications];
      return {
        notifications,
        toasts: notifications,
        unreadCount: computeUnreadCount(notifications),
      };
    });

    setTimeout(() => get().removeToast(notification.id), notification.duration);
  },

  removeToast: (id) =>
    set((state) => {
      const notifications = state.notifications.filter((notification) => notification.id !== id);
      return {
        notifications,
        toasts: notifications,
        unreadCount: computeUnreadCount(notifications),
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      );
      return {
        notifications,
        toasts: notifications,
        unreadCount: computeUnreadCount(notifications),
      };
    }),

  clearNotification: (id) => get().removeToast(id),

  markAllAsRead: () =>
    set((state) => {
      const notifications = state.notifications.map((notification) => ({
        ...notification,
        read: true,
      }));
      return {
        notifications,
        toasts: notifications,
        unreadCount: 0,
      };
    }),

  clearAll: () =>
    set(() => ({
      notifications: [],
      toasts: [],
      unreadCount: 0,
    })),
}));
