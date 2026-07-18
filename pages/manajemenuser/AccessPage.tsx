// FRONTEND: Komponen ini mengelola UI untuk konfigurasi hak akses menu yang detail per-role.
// Fungsinya adalah menampilkan struktur menu dan memungkinkan admin untuk mengatur izin
// untuk setiap tindakan (view, tambah, edit, hapus) pada setiap bagian aplikasi.
// Data izin diambil dari dan disimpan ke backend simulasi melalui API on-demand.

import React, { useState, useEffect, useCallback } from 'react';
import { Role, Branch, AksesMenuConfigItem, RoleSpecificAksesMenuPermissions, Grup } from '../../types';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext'; // Import useAccess
import { useBranch } from '../../contexts/BranchContext'; // Import useBranch for filtering
import { aksesMenuStructure } from '../../constants'; // Import struktur menu dari file terpusat
import { deepClone } from '../../utils';
import { InformationCircleIcon, ChevronDownIcon, ChevronRightIcon, SpinnerIcon } from '../../components/icons';

interface AccessPageProps {
  filterByRoleCompositeKey?: string | null;
  title?: string;
}

const AccessPage: React.FC<AccessPageProps> = ({ filterByRoleCompositeKey: filterByRoleId }) => {
  // --- STATE AND DATA FETCHING ---
  const { savePermissionsForRole } = useAccess();
  const { selectedBranchId, selectedGroupId } = useBranch();
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [grups, setGrups] = useState<Grup[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(false);
  
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<RoleSpecificAksesMenuPermissions>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  // Optimized: Fetch initial data (Roles, Branches, Groups) with Server-Side Filtering
  useEffect(() => {
    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            // Apply filtering here to avoid loading all data if not needed
            const commonParams = {
                branchId: selectedBranchId,
                groupId: selectedGroupId
            };

            const [rolesData, branchesData, grupsData] = await Promise.all([
                api.getRoles(commonParams),
                api.getBranches(commonParams),
                api.getGrups(commonParams),
            ]);
            setRoles(rolesData);
            setBranches(branchesData);
            setGrups(grupsData);
        } catch (error) {
            console.error("Gagal mengambil data untuk halaman Akses:", error);
            alert("Gagal memuat data peran dan cabang.");
        } finally {
            setIsLoadingData(false);
        }
    };
    
    fetchData();
    
    // Inisialisasi state expanded untuk item menu
    const initialExpanded: Record<string, boolean> = {};
    const setInitialExpansion = (items: AksesMenuConfigItem[], parentIsExpanded = false) => {
      items.forEach(item => {
        if (item.isInitiallyExpanded || parentIsExpanded && !item.subItems?.some(si => si.isInitiallyExpanded === false)) {
          initialExpanded[item.id] = true;
        }
        if (item.subItems) {
          setInitialExpansion(item.subItems, initialExpanded[item.id] || false);
        }
      });
    };
    setInitialExpansion(aksesMenuStructure);
    setExpandedItems(initialExpanded);

  }, [selectedBranchId, selectedGroupId]); // Re-fetch if filters change

  // Optimized: Load permissions ON-DEMAND when a role is selected
  const loadPermissionsForRole = useCallback(async (roleId: string) => {
    setIsLoadingPermissions(true);
    try {
        const perms = await api.getRolePermissions(roleId);
        
        if (Object.keys(perms).length === 0) {
            // Initialize empty permission structure if none exists
            const initialPerms: RoleSpecificAksesMenuPermissions = {};
            const initPermsRecursive = (items: AksesMenuConfigItem[]) => {
                items.forEach(item => {
                const actions: Record<string, boolean> = {};
                item.actions.forEach(action => actions[action.id] = false);
                initialPerms[item.id] = { masterChecked: false, actions };
                if (item.subItems) initPermsRecursive(item.subItems);
                });
            };
            initPermsRecursive(aksesMenuStructure);
            setPermissions(initialPerms);
        } else {
            setPermissions(deepClone(perms));
        }
    } catch (error) {
        console.error("Failed to load permissions:", error);
        alert("Gagal memuat izin role.");
    } finally {
        setIsLoadingPermissions(false);
    }
  }, []);
  
  useEffect(() => {
    if (filterByRoleId) {
      setSelectedRoleId(filterByRoleId);
      loadPermissionsForRole(filterByRoleId);
    } else {
      setSelectedRoleId(null);
      setPermissions({});
    }
  }, [filterByRoleId, loadPermissionsForRole]);
  
  const getRoleDisplayInfo = (roleId: string | null): { name: string; branch: string; id: string } | null => {
    if (!roleId) return null;
    const role = roles.find(r => r.id_role === roleId);
    if (!role) return null;

    let branchName = "Semua Cabang";
    if (role.id_cabang === '__SYSTEM__') {
      branchName = "System-Wide";
    } else if (role.id_cabang) {
      const branch = branches.find(b => b.id_cabang === role.id_cabang);
      branchName = branch ? branch.Nama : role.id_cabang;
    }
    const grup = grups.find(g => g.id_grup === role.id_grup);
    
    return { name: role.Nama_role, branch: `${grup?.nama_grup || role.id_grup} / ${branchName}`, id: roleId };
  };

  const currentRoleInfo = getRoleDisplayInfo(selectedRoleId);

  const handleMasterCheckboxChange = (itemId: string, isChecked: boolean, itemConfig: AksesMenuConfigItem) => {
    setPermissions(prev => {
      const newPerms = deepClone(prev);
      const updateRecursively = (config: AksesMenuConfigItem) => {
        if (!newPerms[config.id]) {
            const actionsInit: Record<string, boolean> = {};
            config.actions.forEach(action => actionsInit[action.id] = false);
            newPerms[config.id] = { masterChecked: false, actions: actionsInit };
        }
        
        newPerms[config.id] = { ...newPerms[config.id], masterChecked: isChecked };
        Object.keys(newPerms[config.id].actions).forEach(actionId => {
          newPerms[config.id].actions[actionId] = isChecked;
        });
        if (config.subItems) {
          config.subItems.forEach(sub => updateRecursively(sub));
        }
      };
      updateRecursively(itemConfig);
      return newPerms;
    });
  };
  
  const handleActionCheckboxChange = (itemId: string, actionId: string, isChecked: boolean) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      if (!newPerms[itemId]) { 
          const configItem = aksesMenuStructure.flatMap(item => item.subItems ? [item, ...item.subItems.flatMap(sub => sub.subItems ? [sub, ...sub.subItems] : [sub])] : [item]).find(ci => ci.id === itemId);
          const actionsInit: Record<string, boolean> = {};
          if (configItem) configItem.actions.forEach(action => actionsInit[action.id] = false);
          newPerms[itemId] = { masterChecked: false, actions: actionsInit };
      }
      newPerms[itemId] = { ...newPerms[itemId] }; 
      newPerms[itemId].actions = { ...newPerms[itemId].actions, [actionId]: isChecked }; 

      const allActionsUnchecked = Object.values(newPerms[itemId].actions).every(val => !val);
      newPerms[itemId].masterChecked = !allActionsUnchecked;
      return newPerms;
    });
  };

  const handleSelectAll = () => {
    setPermissions(prev => {
      const newPerms = deepClone(prev);
      const updateAllRecursively = (items: AksesMenuConfigItem[]) => {
        items.forEach(item => {
           if (!newPerms[item.id]) { 
                const actionsInit: Record<string, boolean> = {};
                item.actions.forEach(action => actionsInit[action.id] = true); 
                newPerms[item.id] = { masterChecked: true, actions: actionsInit };
            } else {
                newPerms[item.id] = { ...newPerms[item.id], masterChecked: true };
                Object.keys(newPerms[item.id].actions).forEach(actionId => {
                    newPerms[item.id].actions[actionId] = true;
                });
            }
          if (item.subItems) updateAllRecursively(item.subItems);
        });
      };
      updateAllRecursively(aksesMenuStructure);
      return newPerms;
    });
  };
  
  const handleUnselectAll = () => {
     setPermissions(prev => {
      const newPerms = deepClone(prev);
      const updateAllRecursively = (items: AksesMenuConfigItem[]) => {
        items.forEach(item => {
            if (!newPerms[item.id]) { 
                const actionsInit: Record<string, boolean> = {};
                item.actions.forEach(action => actionsInit[action.id] = false); 
                newPerms[item.id] = { masterChecked: false, actions: actionsInit };
            } else {
                newPerms[item.id] = { ...newPerms[item.id], masterChecked: false };
                Object.keys(newPerms[item.id].actions).forEach(actionId => {
                    newPerms[item.id].actions[actionId] = false;
                });
            }
          if (item.subItems) updateAllRecursively(item.subItems);
        });
      };
      updateAllRecursively(aksesMenuStructure);
      return newPerms;
    });
  };

  const handleSave = async () => {
    if (selectedRoleId) {
      await savePermissionsForRole(selectedRoleId, permissions);
      setShowSaveNotification(true);
      setTimeout(() => setShowSaveNotification(false), 3000);
    }
  };
  
  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // --- RENDER FUNCTIONS ---
  const renderPermissionRows = (items: AksesMenuConfigItem[], level = 0): React.ReactElement[] => {
    return items.flatMap(item => {
      const itemPerms = permissions[item.id] || { masterChecked: false, actions: {} };
      const row = (
        <tr key={item.id} className={`${level > 0 ? 'bg-slate-50' : 'bg-white'}`}>
          <td className="px-4 py-2 border-b border-slate-200 whitespace-nowrap">
            <div className="flex items-center" style={{ paddingLeft: `${level * 1.5}rem` }}>
              {item.subItems && item.subItems.length > 0 && (
                <button onClick={() => toggleExpand(item.id)} className="mr-1 text-slate-500 hover:text-slate-700">
                  {expandedItems[item.id] ? <ChevronDownIcon className="w-4 h-4"/> : <ChevronRightIcon className="w-4 h-4"/>}
                </button>
              )}
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                checked={itemPerms.masterChecked}
                onChange={e => handleMasterCheckboxChange(item.id, e.target.checked, item)}
                aria-label={`Master checkbox for ${item.label}`}
              />
              <span className="ml-2 text-sm text-slate-700">{item.label}</span>
            </div>
          </td>
          <td className="px-4 py-2 border-b border-slate-200">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {item.actions.map(action => (
                <label key={action.id} className="flex items-center text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="form-checkbox h-3.5 w-3.5 text-sky-500 border-slate-300 rounded focus:ring-sky-400"
                    checked={itemPerms.actions?.[action.id] || false} 
                    onChange={e => handleActionCheckboxChange(item.id, action.id, e.target.checked)}
                    aria-label={`${action.label} for ${item.label}`}
                  />
                  <span className="ml-1.5">{action.label}</span>
                </label>
              ))}
               {item.actions.length === 0 && <span className="text-xs text-slate-400 italic">No specific actions for this parent item. Controls sub-items.</span>}
            </div>
          </td>
        </tr>
      );
      const subRows = item.subItems && expandedItems[item.id] ? renderPermissionRows(item.subItems, level + 1) : [];
      return [row, ...subRows];
    });
  };

  if (isLoadingData) {
    return <div className="p-6 md:p-8 flex justify-center items-center min-h-[300px]"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
  }

  if (!selectedRoleId || !currentRoleInfo) {
    return (
      <div className="p-6 md:p-8 text-center text-slate-600">
        <InformationCircleIcon className="w-12 h-12 text-sky-500 mx-auto mb-3"/>
        <p>Silakan pilih role terlebih dahulu dari tab 'Role' untuk mengkonfigurasi akses menu.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {showSaveNotification && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm sticky top-0 z-20 shadow">
          Data berhasil disimpan untuk role <span className="font-semibold">{currentRoleInfo.name}</span>!
        </div>
      )}
      <div className="bg-sky-50 border border-sky-200 p-3 rounded-md mb-6 text-sm text-sky-700 flex items-center">
        <InformationCircleIcon className="w-5 h-5 mr-3 flex-shrink-0" />
        <div>
          <p>
            Anda sedang mengedit hak akses untuk role: <strong className="font-semibold">{currentRoleInfo.name}</strong> 
            <span className="text-xs text-sky-600"> ({currentRoleInfo.branch})</span>
          </p>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-slate-800 mb-3 sm:mb-0">Konfigurasi Akses Menu</h2>
        <div className="flex space-x-2">
          <button onClick={handleSelectAll} className="px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm">Select All</button>
          <button onClick={handleUnselectAll} className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md shadow-sm">Unselect All</button>
          <button onClick={handleSave} className="px-5 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm">SAVE</button>
        </div>
      </div>

      {isLoadingPermissions ? (
         <div className="flex justify-center items-center py-10"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100">
                <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-2/5">
                    Menu / Halaman
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-3/5">
                    Izin Tindakan
                </th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
                {renderPermissionRows(aksesMenuStructure)}
            </tbody>
            </table>
        </div>
      )}
    </div>
  );
};

export default AccessPage;