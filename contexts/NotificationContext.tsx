// FRONTEND: Konteks ini mengelola state notifikasi secara global.
// Fungsinya adalah untuk menyediakan data notifikasi, menambah notifikasi baru,
// menandainya sebagai sudah dibaca, dan secara otomatis menghasilkan notifikasi sistem
// (seperti stok kritis) saat aplikasi dimuat.

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { Notification, Stok, MaterialVariant, StokOpname } from '../types';
import * as api from '../backend/api';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const LS_NOTIFICATIONS_KEY = 'hpos_notifications';

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const stored = localStorage.getItem(LS_NOTIFICATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    // Mencegah notifikasi duplikat untuk masalah yang sama yang belum dibaca
    setNotifications(prev => {
        const isDuplicate = prev.some(n => n.message === newNotification.message && !n.isRead);
        if (isDuplicate) {
            return prev;
        }
        // Tambahkan notifikasi baru di atas daftar & batasi hingga 50 notifikasi
        return [newNotification, ...prev].slice(0, 50); 
    });
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };
  
  // Efek untuk menghasilkan notifikasi sistem saat aplikasi dimuat
  useEffect(() => {
    const generateSystemNotifications = async () => {
        try {
            // 1. Cek stok kritis
            const stocks: Stok[] = await api.getStocks();
            const materialVariants: MaterialVariant[] = await api.getMaterialVariants();
            const stockMap = new Map(stocks.map(s => [`${s.id_cabang}:${s.id_stok}`, s]));
            
            const allStockItems: (Stok | MaterialVariant)[] = [...stocks, ...materialVariants];

            allStockItems.forEach(item => {
                if (item.stok_kritis !== null && item.quantity !== null && item.quantity < item.stok_kritis) {
                    let itemName: string;
                    if ('id_variant_material' in item) { // Ini adalah MaterialVariant
                        const parentStock = stockMap.get(`${item.id_cabang}:${item.id_stok}`);
                        itemName = `${parentStock?.nama_stok || item.id_stok} - ${item.nama_variant}`;
                    } else { // Ini adalah Stok
                        itemName = item.nama_stok;
                    }

                    addNotification({
                        message: `Stok kritis: "${itemName}" tersisa ${item.quantity}.`,
                        type: 'warning',
                        link: '/stock-management/stock-overview'
                    });
                }
            });

            // 2. Cek opname yang menunggu konfirmasi
            const opnames: StokOpname[] = await api.getStokOpnames();
            opnames.forEach(opname => {
                if (opname.status === 'submitted') {
                    addNotification({
                        message: `Sesi Opname "${opname.nama_opname}" menunggu konfirmasi Anda.`,
                        type: 'info',
                        link: '/stock-opname'
                    });
                }
            });

        } catch (error) {
            console.error("Gagal menghasilkan notifikasi sistem:", error);
        }
    };

    generateSystemNotifications();
  }, [addNotification]); // Jalankan sekali saat dimuat, `addNotification` adalah dependensi yang stabil.

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
