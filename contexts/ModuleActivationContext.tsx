// FRONTEND: Konteks ini mengelola aktivasi modul secara global (BOM, KDS, dll.).
// Fungsinya adalah untuk menyediakan status aktif/nonaktif modul ke seluruh aplikasi,
// memungkinkan UI (seperti Sidebar) untuk beradaptasi secara dinamis.

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { ModuleActivationSettings, Grup, Branch } from '../types';
import * as api from '../backend/api';
import { useAuth } from './AuthContext';
import { useBranch } from './BranchContext';

interface ModuleActivationContextType {
  settings: Record<string, ModuleActivationSettings>;
  isModuleDataLoaded: boolean;
  isBomActive: (branchId: string | null) => boolean;
  isKdsActive: (branchId: string | null) => boolean;
  canShowProduksiMenu: boolean;
  canShowDapurMenu: boolean;
  updateSettings: (scope: 'global' | 'group' | 'branch', id: string, newSettings: ModuleActivationSettings) => Promise<void>;
  getSettingsForScope: (scope: 'global' | 'group' | 'branch', id: string) => ModuleActivationSettings;
}

const ModuleActivationContext = createContext<ModuleActivationContextType | undefined>(undefined);

export const ModuleActivationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const { userRoleType, selectableBranches } = useBranch();
    const [settings, setSettings] = useState<Record<string, ModuleActivationSettings>>({});
    const [isModuleDataLoaded, setIsModuleDataLoaded] = useState(false);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [allGrups, setAllGrups] = useState<Grup[]>([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [settingsData, branchesData, grupsData] = await Promise.all([
                    api.getModuleActivationSettings(),
                    api.getBranches(),
                    api.getGrups()
                ]);
                setSettings(settingsData);
                setAllBranches(branchesData);
                setAllGrups(grupsData);
            } catch (error) {
                console.error("Failed to load module activation settings:", error);
            } finally {
                setIsModuleDataLoaded(true);
            }
        };
        fetchInitialData();
    }, []);

    const getSettingsForScope = useCallback((scope: 'global' | 'group' | 'branch', id: string): ModuleActivationSettings => {
        const key = scope === 'global' ? '__global__' : id;
        return settings[key] || { bom: true, kds: true }; // Default to true if not set
    }, [settings]);

    const getResolvedSettingsForBranch = useCallback((branchId: string | null): ModuleActivationSettings => {
        const globalSettings = settings['__global__'] || { bom: true, kds: true };
        if (!branchId) return globalSettings;

        const branch = allBranches.find(b => b.id_cabang === branchId);
        if (!branch) return globalSettings;

        const groupSettings = settings[branch.id_grup];
        const branchSettings = settings[branch.id_cabang];

        return {
            ...globalSettings,
            ...(groupSettings || {}),
            ...(branchSettings || {})
        };
    }, [settings, allBranches]);
    
    const isBomActive = useCallback((branchId: string | null) => getResolvedSettingsForBranch(branchId).bom, [getResolvedSettingsForBranch]);
    const isKdsActive = useCallback((branchId: string | null) => getResolvedSettingsForBranch(branchId).kds, [getResolvedSettingsForBranch]);
    
    const canShowProduksiMenu = useMemo(() => {
        if (!isModuleDataLoaded) return false;
        if (userRoleType === 'superuser') return true;
        if (selectableBranches.length === 0) return false;
        return selectableBranches.some(branch => isBomActive(branch.id_cabang));
    }, [isModuleDataLoaded, userRoleType, selectableBranches, isBomActive]);

    const canShowDapurMenu = useMemo(() => {
        if (!isModuleDataLoaded) return false;
        if (userRoleType === 'superuser') return true;
        if (selectableBranches.length === 0) return false;
        return selectableBranches.some(branch => isKdsActive(branch.id_cabang));
    }, [isModuleDataLoaded, userRoleType, selectableBranches, isKdsActive]);

    const updateSettings = async (scope: 'global' | 'group' | 'branch', id: string, newSettings: ModuleActivationSettings) => {
        const key = scope === 'global' ? '__global__' : id;
        setSettings(prev => ({...prev, [key]: newSettings }));
        await api.updateModuleActivationSettings(scope, id, newSettings);
    };

    const value = {
        settings,
        isModuleDataLoaded,
        isBomActive,
        isKdsActive,
        canShowProduksiMenu,
        canShowDapurMenu,
        updateSettings,
        getSettingsForScope,
    };

    return (
        <ModuleActivationContext.Provider value={value}>
            {children}
        </ModuleActivationContext.Provider>
    );
};

export const useModuleActivation = (): ModuleActivationContextType => {
    const context = useContext(ModuleActivationContext);
    if (context === undefined) {
        throw new Error('useModuleActivation must be used within a ModuleActivationProvider');
    }
    return context;
};
