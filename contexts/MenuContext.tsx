// FRONTEND: Context ini bertanggung jawab untuk mengelola state data menu secara global.
// Fungsinya adalah untuk menyediakan data struktur menu ke seluruh aplikasi
// dan menyediakan fungsi untuk memperbarui struktur menu tersebut (misalnya dari halaman Settings).

import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo } from 'react';
import { MenuItem as MenuItemType, IconComponent } from '../types';
import { INITIAL_MENU_DATA } from '../constants';
import { deepClone } from '../utils';

// Helper to map icon components by name (string) - This is needed for loading from localStorage
// Didefinisikan di luar komponen agar hanya dieksekusi sekali saat modul dimuat (Singleton pattern untuk performa)
const iconMap: Record<string, IconComponent | undefined> = {};
INITIAL_MENU_DATA.forEach(item => {
  if (item.icon && typeof item.icon === 'function') {
    iconMap[item.icon.name] = item.icon as IconComponent;
  }
  if (item.subItems) {
    item.subItems.forEach(sub => {
      if (sub.icon && typeof sub.icon === 'function') {
        iconMap[sub.icon.name] = sub.icon as IconComponent;
      }
    });
  }
});

const convertIconsFromStringToComponent = (items: any[]): MenuItemType[] => {
    return items.map(item => {
        const newItem = { ...item };
        if (typeof newItem.icon === 'string' && iconMap[newItem.icon]) {
            newItem.icon = iconMap[newItem.icon];
        } else if (typeof newItem.icon === 'string') {
            // Icon string is invalid (e.g., "") or not in map, remove it.
            delete newItem.icon;
        }
        if (newItem.subItems) {
            newItem.subItems = convertIconsFromStringToComponent(newItem.subItems);
        }
        return newItem as MenuItemType;
    });
};

const loadMenuData = (): MenuItemType[] => {
    try {
        const storedMenu = localStorage.getItem('hpos_menuConfig');
        if (storedMenu) {
            const parsedMenu = JSON.parse(storedMenu);
            return convertIconsFromStringToComponent(parsedMenu);
        }
    } catch (error) {
        console.error("Error parsing menu from localStorage, falling back to default:", error);
    }
    // Fallback to default
    return deepClone(INITIAL_MENU_DATA);
};


interface MenuContextType {
  menuData: MenuItemType[];
  updateMenuData: (newMenuData: MenuItemType[]) => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export const MenuProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Menggunakan lazy initialization state (function passed to useState) sudah benar untuk performa.
  const [menuData, setMenuData] = useState<MenuItemType[]>(loadMenuData);

  const updateMenuData = useCallback((newMenuData: MenuItemType[]) => {
    // Fungsi ini akan dipanggil dari halaman Settings -> Menu List untuk menyimpan konfigurasi menu baru.
    // Diasumsikan `newMenuData` sudah dalam format yang benar.
    setMenuData(newMenuData);
  }, []);

  // OPTIMISASI PENTING:
  // Menggunakan useMemo untuk objek value.
  // Tanpa ini, setiap kali MenuProvider render (karena parent update), objek value baru dibuat,
  // memaksa semua konsumen (Sidebar, dll) untuk re-render meskipun menuData tidak berubah.
  const value = useMemo(() => ({
    menuData,
    updateMenuData
  }), [menuData, updateMenuData]);

  return (
    <MenuContext.Provider value={value}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = (): MenuContextType => {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
};