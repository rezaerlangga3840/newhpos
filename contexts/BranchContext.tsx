// FRONTEND: Konteks ini mengelola cabang dan grup yang dipilih secara global.
// Ini menentukan cabang/grup mana yang tersedia untuk pengguna saat ini
// dan menyediakan fungsi untuk mengubah pilihan. Konteks ini mengambil datanya dari API backend.

import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Branch, Grup } from '../types';
import { useAuth } from './AuthContext';
import * as api from '../backend/api'; // Mengimpor API backend simulasi
import { deepClone } from '../utils';

interface BranchContextState {
  selectedBranchId: string | null;
  selectedGroupId: string | null;
  selectedBranch: Branch | null;
  selectedGrup: Grup | null;
  selectableGrups: Grup[];
  selectableBranches: Branch[];
  userRoleType: 'superuser' | 'administrator' | 'other';
  isBranchSelectionDisabled: boolean;
  isGroupSelectionDisabled: boolean;
  updateSelectedBranchId: (branchId: string | null) => void;
  updateSelectedGroupId: (id_grup: string | null) => void;
}

const BranchContext = createContext<BranchContextState | undefined>(undefined);

export const BranchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [internalSelectedBranchId, setInternalSelectedBranchId] = useState<string | null>(null);
  const [internalSelectedGroupId, setInternalSelectedGroupId] = useState<string | null>(null);
  
  // State untuk menampung data yang diambil dari API
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allGrups, setAllGrups] = useState<Grup[]>([]);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // FRONTEND: Mengambil semua data yang diperlukan dari API saat provider dimuat.
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [branches, grups, roles] = await Promise.all([
        api.getBranches(),
        api.getGrups(),
        api.getRoles()
      ]);
      setAllBranches(branches);
      setAllGrups(grups);
      setAllRoles(roles);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // FRONTEND: Menentukan tipe peran pengguna berdasarkan data sesi mereka.
  const userRoleType = useMemo<'superuser' | 'administrator' | 'other'>(() => {
    if (!currentUser || isLoading) return 'other';
    if (currentUser.id_role === 'superuser' && currentUser.id_cabang === undefined) return 'superuser';
    
    const roleDetails = allRoles.find(
      (r) => r.id_role === currentUser.id_role && (r.id_cabang === currentUser.id_cabang || r.id_cabang === '__SYSTEM__')
    );
    if (roleDetails?.role?.toLowerCase().includes('administrator')) return 'administrator';
    if (roleDetails?.role?.toLowerCase().includes('system') && currentUser.id_role === 'superuser') return 'superuser';

    return 'other';
  }, [currentUser, allRoles, isLoading]);

  // FRONTEND: Mengatur cabang/grup awal yang dipilih berdasarkan peran dan izin pengguna.
  useEffect(() => {
    if (currentUser && !isLoading) {
      if (userRoleType === 'administrator') {
        if (currentUser.id_cabang) {
          const adminInitialBranch = allBranches.find(b => b.id_cabang === currentUser.id_cabang);
          setInternalSelectedGroupId(adminInitialBranch?.id_grup || null);
        } else {
          setInternalSelectedGroupId(null);
        }
        setInternalSelectedBranchId(null);
      } else if (userRoleType === 'superuser') {
        setInternalSelectedGroupId(null);
        setInternalSelectedBranchId(null);
      } else if (currentUser.id_cabang) {
        setInternalSelectedBranchId(currentUser.id_cabang);
        const branch = allBranches.find(b => b.id_cabang === currentUser.id_cabang);
        setInternalSelectedGroupId(branch?.id_grup || null);
      } else { 
        setInternalSelectedGroupId(null);
        setInternalSelectedBranchId(null);
      }
    }
  }, [currentUser, userRoleType, allBranches, isLoading]);

  const selectedBranch = useMemo<Branch | null>(() => {
    if (!internalSelectedBranchId || isLoading) return null;
    return allBranches.find(b => b.id_cabang === internalSelectedBranchId) || null;
  }, [internalSelectedBranchId, allBranches, isLoading]);

  const selectedGrup = useMemo<Grup | null>(() => {
    if (!internalSelectedGroupId || isLoading) return null;
    return allGrups.find(g => g.id_grup === internalSelectedGroupId) || null;
  }, [internalSelectedGroupId, allGrups, isLoading]);

  const selectableGrups = useMemo<Grup[]>(() => {
    if (isLoading) return [];
    if (userRoleType === 'superuser') return allGrups;
    if (userRoleType === 'administrator') {
      if (currentUser?.id_cabang) {
        const adminBranch = allBranches.find(b => b.id_cabang === currentUser.id_cabang);
        if (adminBranch?.id_grup) {
          const adminGrup = allGrups.find(g => g.id_grup === adminBranch.id_grup);
          return adminGrup ? [adminGrup] : [];
        }
        return [];
      } else {
        return allGrups;
      }
    }
    if (currentUser?.id_cabang) {
      const userBranchDetails = allBranches.find(b => b.id_cabang === currentUser.id_cabang);
      if (userBranchDetails?.id_grup) {
        const userGrup = allGrups.find(g => g.id_grup === userBranchDetails.id_grup);
        return userGrup ? [userGrup] : [];
      }
    }
    return [];
  }, [userRoleType, currentUser, allGrups, allBranches, isLoading]);

  const selectableBranches = useMemo<Branch[]>(() => {
    if (isLoading) return [];
    if (userRoleType === 'superuser' || (userRoleType === 'administrator' && !currentUser?.id_cabang)) {
      if (!internalSelectedGroupId) return allBranches;
      return allBranches.filter(b => b.id_grup === internalSelectedGroupId);
    }
    if (userRoleType === 'administrator' && currentUser?.id_cabang) {
        if (internalSelectedGroupId) {
             return allBranches.filter(b => b.id_grup === internalSelectedGroupId);
        }
        return [];
    }
    if (currentUser?.id_cabang) {
      return allBranches.filter(b => b.id_cabang === currentUser.id_cabang);
    }
    return [];
  }, [userRoleType, currentUser, internalSelectedGroupId, allBranches, isLoading]);
  
  const isGroupSelectionDisabled = useMemo(() => {
    if (userRoleType === 'superuser' || (userRoleType === 'administrator' && !currentUser?.id_cabang)) return false;
    return true;
  }, [userRoleType, currentUser]);

  const isBranchSelectionDisabled = useMemo(() => {
    if (userRoleType === 'superuser' || userRoleType === 'administrator') return false; 
    return true;
  }, [userRoleType]);

  const updateSelectedGroupId = useCallback((id_grup: string | null) => {
    if (userRoleType === 'superuser' || (userRoleType === 'administrator' && !currentUser?.id_cabang)) {
        setInternalSelectedGroupId(id_grup);
        if (id_grup !== null) { 
            const branchesInNewGroup = allBranches.filter(b => b.id_grup === id_grup);
            const currentBranchInNewGroup = internalSelectedBranchId ? branchesInNewGroup.some(b => b.id_cabang === internalSelectedBranchId) : false;
            if (!currentBranchInNewGroup) {
                 setInternalSelectedBranchId(null); 
            }
        } else { 
             setInternalSelectedBranchId(null); 
        }
    }
  }, [userRoleType, currentUser, internalSelectedBranchId, allBranches]);

  const updateSelectedBranchId = useCallback((branchId: string | null) => {
    if (userRoleType === 'superuser' || userRoleType === 'administrator') {
        setInternalSelectedBranchId(branchId); 
        const newBranch = branchId ? allBranches.find(b => b.id_cabang === branchId) : null;
        if (userRoleType === 'superuser' || (userRoleType === 'administrator' && !currentUser?.id_cabang)) {
            if (newBranch) {
                setInternalSelectedGroupId(newBranch.id_grup);
            }
        }
    }
  }, [userRoleType, currentUser, allBranches]);

  const value = { 
      selectedBranchId: internalSelectedBranchId, 
      selectedGroupId: internalSelectedGroupId, 
      selectedBranch,
      selectedGrup,
      selectableGrups, 
      selectableBranches,
      userRoleType,
      isBranchSelectionDisabled,
      isGroupSelectionDisabled,
      updateSelectedBranchId, 
      updateSelectedGroupId 
  };
  
  return (
    <BranchContext.Provider value={value}>
      {isLoading ? (
        <div className="flex items-center justify-center h-screen bg-slate-100">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[var(--primary-color)]"></div>
            <p className="ml-3 text-slate-600">Loading Branch Data...</p>
        </div>
      ) : children}
    </BranchContext.Provider>
  );
};

export const useBranch = (): BranchContextState => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
