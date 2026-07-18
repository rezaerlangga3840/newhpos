// FRONTEND: Konteks ini mengelola izin pengguna dan kontrol akses.
// Fungsinya adalah untuk mengambil data peran dari backend, menginisialisasi struktur izin,
// dan menyediakan fungsi bagi komponen untuk memeriksa apakah pengguna dapat melakukan tindakan tertentu.

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { PermissionCRUD, RoleSpecificAksesMenuPermissions } from '../types';
import { deepClone } from '../utils';
import { useAuth } from './AuthContext';
import * as api from '../backend/api';

interface AccessContextType {
  getPermissions: (menuPath: string) => PermissionCRUD;
  canRead: (menuPath: string) => boolean;
  canInsert: (menuPath: string) => boolean;
  canUpdate: (menuPath: string) => boolean;
  canDelete: (menuPath: string) => boolean;
  isAccessDataLoaded: boolean;
  // Removed getDetailedPermissions as it implies global access. AccessPage should fetch its own data.
  // getDetailedPermissions: (roleId: string) => RoleSpecificAksesMenuPermissions; 
  savePermissionsForRole: (roleId: string, permissions: RoleSpecificAksesMenuPermissions) => Promise<{ success: boolean }>;
}

const AccessContext = createContext<AccessContextType | undefined>(undefined);

const defaultCrudPermissions: PermissionCRUD = {
  read: false,
  insert: false,
  update: false,
  delete: false,
};

const allTruePermissions: PermissionCRUD = {
  read: true,
  insert: true,
  update: true,
  delete: true,
};

// FRONTEND: Utilitas untuk memetakan izin detail berbasis tindakan (misalnya, 'tambah_grup_dc')
// ke sistem CRUD warisan yang lebih sederhana (read, insert, update, delete) untuk proteksi rute dasar.
const mapDetailedToCrud = (
  detailedPermissions: RoleSpecificAksesMenuPermissions | undefined,
  path: string
): PermissionCRUD => {
    if (!detailedPermissions) return { ...defaultCrudPermissions };

    // This is a simplified lookup; a real app might need a more robust mapping structure.
    let relevantItemIds: string[] = [];
    
    // This maps a URL path to its corresponding ID(s) in the detailed permission structure.
    // A page might be controlled by permissions from multiple tabs within it.
    if (path === '/branch/daftar-cabang') relevantItemIds = ['manajemen_grup_dc', 'manajemen_cabang_dc'];
    else if (path === '/user-management/role-access-config') relevantItemIds = ['manajemen_role_rac', 'manajemen_akses_menu_rac'];
    else if (path === '/user-management/users') relevantItemIds = ['user_page'];
    else if (path === '/stock-management/stock-overview') relevantItemIds = ['stok_tab_so', 'varian_material_tab_so', 'varian_produk_tab_so'];
    else if (path === '/production/bom') relevantItemIds = ['bom_page'];
    else if (path === '/penjualan/pelanggan') relevantItemIds = ['pelanggan_page'];
    else if (path === '/dapur/kds') relevantItemIds = ['kds_page'];
    else if (path === '/reports/sales') relevantItemIds = ['report_sales'];
    else if (path === '/reports/stock') relevantItemIds = ['report_stock'];
    else if (path === '/reports/inventory-valuation') relevantItemIds = ['report_inventory_valuation'];
    else if (path === '/reports/opname-history') relevantItemIds = ['report_opname_history'];
    else if (path === '/reports/attendance') relevantItemIds = ['report_attendance'];
    else if (path === '/reports/payroll') relevantItemIds = ['report_payroll'];
    else if (path === '/hrm/absensi') relevantItemIds = ['absensi_page_log', 'home']; // Home for widget access
    else if (path === '/home') relevantItemIds = ['home'];
    else if (path === '/dashboard') relevantItemIds = ['dashboard'];
    else if (path === '/stock-opname') relevantItemIds = ['stok_opname_page'];
    else if (path === '/stock-management/settings') relevantItemIds = ['manajemen_unit_ss'];
    else if (path === '/penjualan/settings') relevantItemIds = ['manajemen_promo_ps', 'manajemen_meja_ps'];
    else if (path === '/hrm/karyawan') relevantItemIds = ['karyawan_page'];
    else if (path === '/hrm/penggajian') relevantItemIds = ['penggajian_page'];
    else if (path === '/hrm/settings') relevantItemIds = ['hrm_titik_absensi_tab', 'hrm_payroll_component_tab'];
    else if (path === '/stock-management/stock-balance') relevantItemIds = ['balance_stok_page'];
    else if (path === '/penjualan/transaksi') relevantItemIds = ['transaksi_page'];
    else if (path === '/penjualan/pos') relevantItemIds = ['pos_page'];
    else if (path === '/settings/menu-list') relevantItemIds = ['menu_list_settings_page'];
    else if (path === '/settings/personalize') relevantItemIds = ['personalize_settings_page'];
    else if (path === '/settings/task-settings') relevantItemIds = ['task_settings_page'];
    else if (path === '/settings/module-settings') relevantItemIds = ['module_settings_page'];


    const crud: PermissionCRUD = { ...defaultCrudPermissions };
    if (relevantItemIds.length === 0) return crud;

    for (const itemId of relevantItemIds) {
        const itemPerms = detailedPermissions[itemId];
        if (itemPerms) {
            for (const actionId in itemPerms.actions) {
                if (itemPerms.actions[actionId]) {
                    if (actionId.startsWith('view_')) crud.read = true;
                    if (actionId.startsWith('tambah_') || actionId.startsWith('mulai_')) crud.insert = true;
                    if (actionId.startsWith('edit_') || actionId.startsWith('konfigurasi_') || actionId.startsWith('proses_') || actionId.startsWith('submit_') || actionId.startsWith('konfirmasi_') || actionId.startsWith('update_') || actionId.startsWith('generate_') || actionId.startsWith('publish_') || actionId.startsWith('mark_')) crud.update = true;
                    if (actionId.startsWith('hapus_') || actionId.startsWith('delete_')) crud.delete = true;
                }
            }
        }
    }

    // Special case for clock-in (insert permission on /hrm/absensi) via home widget
    if(path === '/hrm/absensi') {
        const homePerms = detailedPermissions['home'];
        if(homePerms?.actions['use_absensi_widget_home']) {
            crud.insert = true;
        }
    }
    return crud;
};


export const AccessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  // Optimization: Store permissions ONLY for the current user, not the whole world.
  const [currentUserPermissions, setCurrentUserPermissions] = useState<RoleSpecificAksesMenuPermissions>({});
  const [isAccessDataLoaded, setIsAccessDataLoaded] = useState(false);

  // FRONTEND: Optimized to fetch only CURRENT USER'S permissions on mount.
  useEffect(() => {
    const fetchPermissions = async () => {
        if (!currentUser) {
             setIsAccessDataLoaded(true);
             return;
        }
        try {
            // New API call that gets just what we need
            const permissions = await api.getRolePermissions(currentUser.id_role);
            setCurrentUserPermissions(permissions);
        } catch (error) {
            console.error("Failed to fetch access permissions:", error);
            // Handle error appropriately
        } finally {
            setIsAccessDataLoaded(true);
        }
    };
    fetchPermissions();
  }, [currentUser]);

  
  const getPermissions = useCallback((menuPath: string): PermissionCRUD => {
    if (!currentUser) return deepClone(defaultCrudPermissions);
    if (currentUser.id_role === 'superuser' && currentUser.id_cabang === undefined) {
      return deepClone(allTruePermissions);
    }
    
    // Uses the local state which is now lightweight
    return mapDetailedToCrud(currentUserPermissions, menuPath);

  }, [currentUser, currentUserPermissions]);

  const canRead = useCallback((menuPath: string) => getPermissions(menuPath).read, [getPermissions]);
  const canInsert = useCallback((menuPath: string) => getPermissions(menuPath).insert, [getPermissions]);
  const canUpdate = useCallback((menuPath: string) => getPermissions(menuPath).update, [getPermissions]);
  const canDelete = useCallback((menuPath: string) => getPermissions(menuPath).delete, [getPermissions]);

  const savePermissionsForRole = async (roleId: string, permissions: RoleSpecificAksesMenuPermissions): Promise<{ success: boolean }> => {
    const response = await api.saveRoleAksesMenuDetailPermissions(roleId, permissions);
    if (response.success) {
        // If we updated our own role, update local state
        if (currentUser?.id_role === roleId) {
             setCurrentUserPermissions(permissions);
        }
    }
    return response;
  };

  return (
    <AccessContext.Provider value={{ 
        getPermissions, 
        canRead, 
        canInsert, 
        canUpdate, 
        canDelete, 
        isAccessDataLoaded,
        savePermissionsForRole
    }}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = (): AccessContextType => {
  const context = useContext(AccessContext);
  if (context === undefined) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
};
