// FRONTEND: Konteks ini mengelola state global untuk personalisasi aplikasi.
// Fungsinya adalah untuk menyediakan dan menyimpan pengaturan seperti warna tema dan logo aplikasi,
// sehingga perubahan yang dibuat oleh pengguna dapat diterapkan di seluruh aplikasi dan diingat antar sesi.

import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { adjustColor } from '../utils';

const DEFAULT_LOGO = "https://picsum.photos/seed/hposlogo/60/50";
const DEFAULT_LOGIN_LOGO = "https://picsum.photos/seed/hposloginlogo/80/80"; // Logo terpisah untuk login
const DEFAULT_LOGIN_BG = "none"; // Menggunakan 'none' untuk menandakan tidak ada gambar, CSS akan menangani fallback
const DEFAULT_THEME_COLOR = "#0ea5e9"; // Sky blue

interface PersonalizationContextType {
    themeColor: string;
    setThemeColor: (color: string) => void;
    logo: string; // Logo Perusahaan di Sidebar
    setLogo: (logoUrl: string) => void;
    loginLogo: string; // Logo Aplikasi di Halaman Login
    setLoginLogo: (logoUrl: string) => void;
    loginBackground: string;
    setLoginBackground: (bgUrl: string) => void;
    resetPersonalization: () => void;
}

const PersonalizationContext = createContext<PersonalizationContextType | undefined>(undefined);

const getFromLS = (key: string, defaultValue: string) => {
    if (typeof window !== 'undefined') {
        try {
            const storedValue = localStorage.getItem(key);
            return storedValue || defaultValue;
        } catch (e) {
            console.warn("Gagal membaca dari localStorage", e);
            return defaultValue;
        }
    }
    return defaultValue;
};

// OPTIMASI: Menggunakan setTimeout untuk memindahkan operasi I/O (localStorage) keluar dari stack eksekusi utama.
const saveToLS = (key: string, value: string) => {
    setTimeout(() => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error("Gagal menyimpan ke localStorage. Penyimpanan mungkin penuh.", e);
        }
    }, 0);
};

export const PersonalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [themeColor, setThemeColorState] = useState(() => getFromLS('hpos_themeColor', DEFAULT_THEME_COLOR));
    const [logo, setLogoState] = useState(() => getFromLS('hpos_logo', DEFAULT_LOGO));
    const [loginLogo, setLoginLogoState] = useState(() => getFromLS('hpos_loginLogo', DEFAULT_LOGIN_LOGO));
    const [loginBackground, setLoginBackgroundState] = useState(() => getFromLS('hpos_loginBackground', DEFAULT_LOGIN_BG));

    // Optimasi: Update CSS variable hanya jika themeColor benar-benar berubah
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', themeColor);
        // Gelapkan warna sedikit untuk state hover.
        const darkenAmount = -20;
        const darkenedColor = adjustColor(themeColor, darkenAmount);
        root.style.setProperty('--primary-color-dark', darkenedColor);
    }, [themeColor]);

    // Menggunakan useCallback untuk menjamin referensi fungsi tetap stabil
    const setThemeColor = useCallback((color: string) => {
        setThemeColorState(color);
        saveToLS('hpos_themeColor', color);
    }, []);

    const setLogo = useCallback((logoUrl: string) => {
        setLogoState(logoUrl);
        saveToLS('hpos_logo', logoUrl);
    }, []);

    const setLoginLogo = useCallback((logoUrl: string) => {
        setLoginLogoState(logoUrl);
        saveToLS('hpos_loginLogo', logoUrl);
    }, []);
    
    const setLoginBackground = useCallback((bgUrl: string) => {
        setLoginBackgroundState(bgUrl);
        saveToLS('hpos_loginBackground', bgUrl);
    }, []);

    const resetPersonalization = useCallback(() => {
        try {
            localStorage.removeItem('hpos_themeColor');
            localStorage.removeItem('hpos_logo');
            localStorage.removeItem('hpos_loginLogo');
            localStorage.removeItem('hpos_loginBackground');
        } catch (e) {
            console.error("Gagal menghapus localStorage", e);
        }
        setThemeColorState(DEFAULT_THEME_COLOR);
        setLogoState(DEFAULT_LOGO);
        setLoginLogoState(DEFAULT_LOGIN_LOGO);
        setLoginBackgroundState(DEFAULT_LOGIN_BG);
    }, []);

    // CRITICAL OPTIMIZATION: Memoize context value.
    // Ini mencegah komponen yang menggunakan usePersonalization() (seperti Sidebar, Login)
    // melakukan re-render yang tidak perlu jika state lain di App berubah.
    const value = useMemo(() => ({
        themeColor,
        setThemeColor,
        logo,
        setLogo,
        loginLogo,
        setLoginLogo,
        loginBackground,
        setLoginBackground,
        resetPersonalization
    }), [themeColor, logo, loginLogo, loginBackground, setThemeColor, setLogo, setLoginLogo, setLoginBackground, resetPersonalization]);

    return (
        <PersonalizationContext.Provider value={value}>
            {children}
        </PersonalizationContext.Provider>
    );
};

export const usePersonalization = (): PersonalizationContextType => {
    const context = useContext(PersonalizationContext);
    if (context === undefined) {
        throw new Error('usePersonalization must be used within a PersonalizationProvider');
    }
    return context;
};