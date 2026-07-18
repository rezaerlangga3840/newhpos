// FRONTEND: Context ini mengelola state otentikasi aplikasi.
// Fungsinya adalah untuk menangani login, logout pengguna, dan menyimpan sesi pengguna.
// Context ini berkomunikasi dengan API backend untuk otentikasi dan tidak menyimpan data sendiri.

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { User, Karyawan } from '../types';
import { useNavigate } from 'react-router-dom';
import * as api from '../backend/api'; // Mengimpor API backend simulasi

interface AuthContextType {
  currentUser: Omit<User, 'password'> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameInput: string, passwordInput: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LS_USER_KEY = 'hpos_currentUser';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Omit<User, 'password'> | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate(); 

  // FRONTEND: Efek untuk memeriksa pengguna yang sudah login di localStorage saat aplikasi pertama kali dimuat.
  useEffect(() => {
    try {
      const storedUserString = localStorage.getItem(LS_USER_KEY);
      if (storedUserString) {
        const storedUser: Omit<User, 'password'> = JSON.parse(storedUserString);
        // Untuk simulasi ini, kita mempercayai pengguna yang tersimpan. 
        // Aplikasi nyata akan memvalidasi ulang token di sini.
        setCurrentUser(storedUser);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
      localStorage.removeItem(LS_USER_KEY);
    }
    setIsLoading(false);
  }, []);

  // FRONTEND: Fungsi untuk menangani login pengguna. Fungsi ini memanggil API backend untuk otentikasi.
  const login = useCallback(async (usernameInput: string, passwordInput: string): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    // FRONTEND: Memanggil fungsi otentikasi backend.
    const response = await api.authenticateUser(usernameInput, passwordInput);

    if (response.success && response.user) {
      setCurrentUser(response.user);
      setIsAuthenticated(true);
      try {
        localStorage.setItem(LS_USER_KEY, JSON.stringify(response.user));
      } catch (error) {
        console.error("Error saving user to localStorage:", error);
      }
      setIsLoading(false);
      return { success: true };
    } else {
      setCurrentUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem(LS_USER_KEY);
      setIsLoading(false);
      return { success: false, message: response.message || 'Login gagal.' };
    }
  }, []);

  // FRONTEND: Fungsi untuk menangani logout pengguna.
  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(LS_USER_KEY);
    navigate('/login'); 
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};