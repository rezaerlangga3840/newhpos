import { db, SIMULATED_DELAY } from './database';
import { Grup, Branch, Role, Unit, PermissionCRUD, AksesMenuConfigItem, RoleSpecificAksesMenuPermissions, AllRolesAksesMenuDetailData } from '../types';
import { deepClone } from '../utils';
import { aksesMenuStructure } from '../constants';

const generateDefaultPermsForRole = (isAllAllowed: boolean): RoleSpecificAksesMenuPermissions => {
    const perms: RoleSpecificAksesMenuPermissions = {};
    const recurse = (items: AksesMenuConfigItem[]) => {
        items.forEach(item => {
            const actions: Record<string, boolean> = {};
            item.actions.forEach(action => {
                actions[action.id] = isAllAllowed;
            });
            perms[item.id] = { masterChecked: isAllAllowed, actions };
            if (item.subItems) {
                recurse(item.subItems);
            }
        });
    };
    recurse(aksesMenuStructure);
    return perms;
};

// --- API IZIN ---

// Legacy: Get All (Hindari penggunaan ini di client side untuk performa)
export const getGlobalAksesMenuDetailPermissions = async (): Promise<AllRolesAksesMenuDetailData> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY * 2)); 
    return deepClone(db.GLOBAL_AKSES_MENU_DETAIL_PERMISSIONS);
};

// OPTIMIZED: Ambil izin hanya untuk satu role spesifik. Ringan di server, cepat di client.
export const getRolePermissions = async (roleId: string): Promise<RoleSpecificAksesMenuPermissions> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return deepClone(db.GLOBAL_AKSES_MENU_DETAIL_PERMISSIONS[roleId] || {});
};

export const saveRoleAksesMenuDetailPermissions = async (roleId: string, permissions: RoleSpecificAksesMenuPermissions): Promise<{ success: boolean }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    db.GLOBAL_AKSES_MENU_DETAIL_PERMISSIONS[roleId] = deepClone(permissions);
    return { success: true };
};


// --- API GRUP ---
interface GetGrupsParams {
    branchId?: string | null;
    groupId?: string | null;
    search?: string;
    page?: number;     // Pagination
    pageSize?: number; // Pagination
}

// OPTIMIZED: Server-side filtering & Pagination untuk Grup
export const getGrups = async (params?: GetGrupsParams): Promise<{ data: Grup[], total: number } | Grup[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.GRUP_DATA;

    if (params?.branchId) {
        const branch = db.BRANCHES_DATA.find(b => b.id_cabang === params.branchId);
        if (branch) {
            data = data.filter(g => g.id_grup === branch.id_grup);
        } else {
            // Return array kosong jika format return tidak diminta pagination (legacy support)
            return params.page ? { data: [], total: 0 } : []; 
        }
    } else if (params?.groupId) {
        data = data.filter(g => g.id_grup === params.groupId);
    }

    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(g => 
            g.nama_grup.toLowerCase().includes(lowerTerm) || 
            (g.manajer && g.manajer.toLowerCase().includes(lowerTerm)) ||
            g.id_grup.toLowerCase().includes(lowerTerm)
        );
    }

    const total = data.length;

    // Apply Pagination if requested
    if (params?.page && params?.pageSize) {
        const start = (params.page - 1) * params.pageSize;
        const end = start + params.pageSize;
        return {
            data: deepClone(data.slice(start, end)),
            total
        };
    }

    return deepClone(data);
};

export const createGrup = async (grupData: Omit<Grup, 'id_grup'>): Promise<Grup> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    const lastId = db.GRUP_DATA.reduce((max, curr) => {
        const match = curr.id_grup.match(/^GR(\d+)$/);
        const num = match ? parseInt(match[1]) : 0;
        return num > max ? num : max;
    }, 0);
    
    const newId = `GR${lastId + 1}`;
    const newGrup: Grup = { id_grup: newId, ...grupData };
    db.GRUP_DATA.push(newGrup);
    return deepClone(newGrup);
};

export const updateGrup = async (id_grup: string, grupData: Omit<Grup, 'id_grup'>): Promise<Grup | null> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.GRUP_DATA.findIndex(g => g.id_grup === id_grup);
    if (index > -1) {
        db.GRUP_DATA[index] = { ...db.GRUP_DATA[index], ...grupData };
        return deepClone(db.GRUP_DATA[index]);
    }
    return null;
};

export const deleteGrup = async (id_grup: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    const isGrupInUse = db.BRANCHES_DATA.some(branch => branch.id_grup === id_grup);
    if (isGrupInUse) {
      return { success: false, message: `Grup tidak dapat dihapus karena masih digunakan oleh cabang.` };
    }
    
    const index = db.GRUP_DATA.findIndex(g => g.id_grup === id_grup);
    if (index > -1) {
        db.GRUP_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Grup tidak ditemukan.' };
};


// --- API CABANG ---
interface GetBranchesParams {
    groupId?: string | null;
    groupIds?: string[]; // New: Support multiple groups for efficient loading
    branchId?: string | null;
    search?: string;
}

// OPTIMIZED: Server-side filtering untuk Cabang
export const getBranches = async (params?: GetBranchesParams): Promise<Branch[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.BRANCHES_DATA;

    if (params?.branchId) {
        data = data.filter(b => b.id_cabang === params.branchId);
    }
    else if (params?.groupId) {
        data = data.filter(b => b.id_grup === params.groupId);
    }
    else if (params?.groupIds && params.groupIds.length > 0) {
        data = data.filter(b => params.groupIds!.includes(b.id_grup));
    }

    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(b => 
            b.Nama.toLowerCase().includes(lowerTerm) || 
            b.Alamat.toLowerCase().includes(lowerTerm) ||
            b.id_cabang.toLowerCase().includes(lowerTerm)
        );
    }

    return deepClone(data);
};

export const createBranch = async (branchData: Omit<Branch, 'id_cabang'>): Promise<Branch> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    const lastId = db.BRANCHES_DATA.reduce((max, curr) => {
        const match = curr.id_cabang.match(/^CB(\d+)$/i);
        const num = match ? parseInt(match[1]) : 0;
        return num > max ? num : max;
    }, 0);

    const newId = `CB${lastId + 1}`;
    const newBranch: Branch = { id_cabang: newId, ...branchData };
    db.BRANCHES_DATA.push(newBranch);
    return deepClone(newBranch);
};

export const updateBranch = async (id_cabang: string, branchData: Omit<Branch, 'id_cabang'>): Promise<Branch | null> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.BRANCHES_DATA.findIndex(b => b.id_cabang === id_cabang);
    if (index > -1) {
        db.BRANCHES_DATA[index] = { ...db.BRANCHES_DATA[index], ...branchData, id_cabang };
        return deepClone(db.BRANCHES_DATA[index]);
    }
    return null;
};

export const deleteBranch = async (id_cabang: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const isBranchInUse = db.USERS_DATA.some(user => user.id_cabang === id_cabang);
    if (isBranchInUse) {
        return { success: false, message: `Cabang tidak dapat dihapus karena masih ada user yang terdaftar di cabang ini.` };
    }
    const index = db.BRANCHES_DATA.findIndex(b => b.id_cabang === id_cabang);
    if (index > -1) {
        db.BRANCHES_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Cabang tidak ditemukan.' };
};


// --- API ROLE ---
interface GetRolesParams {
    branchId?: string | null;
    groupId?: string | null;
    search?: string;
}

// OPTIMIZED: Server-side filtering untuk Role. Sangat penting untuk performa.
export const getRoles = async (params?: GetRolesParams): Promise<Role[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.ROLES_DATA;

    if (params?.branchId) {
        const branch = db.BRANCHES_DATA.find(b => b.id_cabang === params.branchId);
        if (branch) {
             data = data.filter(r => 
                (r.id_cabang === params.branchId) || 
                (r.id_grup === branch.id_grup && r.id_cabang === null)
            );
        } else {
             data = data.filter(r => r.id_cabang === params.branchId);
        }
    } else if (params?.groupId) {
        data = data.filter(r => r.id_grup === params.groupId);
    }

    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(r => 
            r.Nama_role.toLowerCase().includes(lowerTerm) || 
            r.role.toLowerCase().includes(lowerTerm) ||
            r.id_role.toLowerCase().includes(lowerTerm)
        );
    }

    return deepClone(data);
};

export const createRole = async (roleData: Omit<Role, 'id_role'>): Promise<Role> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const lowerCaseName = roleData.Nama_role.toLowerCase();

    const isDuplicate = db.ROLES_DATA.some(r => {
        if (r.Nama_role.toLowerCase() !== lowerCaseName) return false;
        
        if (roleData.id_cabang === null && r.id_grup === roleData.id_grup && r.id_cabang === null) return true;
        if (roleData.id_cabang !== null && r.id_cabang === roleData.id_cabang) return true;
        if (roleData.id_cabang !== null && r.id_grup === roleData.id_grup && r.id_cabang === null) return true;

        return false;
    });

    if (isDuplicate) {
        throw new Error(`Nama role "${roleData.Nama_role}" sudah digunakan dalam cakupan yang sama atau berkonflik.`);
    }

    let maxIdNum = 0;
    db.ROLES_DATA.forEach(r => {
      const match = r.id_role.match(/^RL(\d+)$/i);
      if (match && parseInt(match[1]) > maxIdNum) maxIdNum = parseInt(match[1]);
    });
    const newId = `RL${maxIdNum + 1}`;
    const newRole: Role = { id_role: newId, ...roleData };
    db.ROLES_DATA.push(newRole);
    // Inisialisasi izin kosong untuk role baru
    db.GLOBAL_AKSES_MENU_DETAIL_PERMISSIONS[newId] = generateDefaultPermsForRole(false);
    return deepClone(newRole);
};

export const updateRole = async (id_role: string, roleData: Pick<Role, 'Nama_role' | 'role'>): Promise<Role | null> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.ROLES_DATA.findIndex(r => r.id_role === id_role);
    if (index > -1) {
        const originalRole = db.ROLES_DATA[index];
        if (db.ROLES_DATA.some(r => r.id_role !== id_role && r.id_cabang === originalRole.id_cabang && r.Nama_role.toLowerCase() === roleData.Nama_role.toLowerCase())) {
            throw new Error(`Nama role "${roleData.Nama_role}" sudah digunakan di cabang ini.`);
        }
        db.ROLES_DATA[index] = { ...originalRole, ...roleData };
        return deepClone(db.ROLES_DATA[index]);
    }
    return null;
};

export const deleteRole = async (id_role: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const isRoleInUse = db.USERS_DATA.some(user => user.id_role === id_role);
    if (isRoleInUse) {
      return { success: false, message: `Role tidak dapat dihapus karena masih digunakan oleh user.` };
    }
    const index = db.ROLES_DATA.findIndex(r => r.id_role === id_role);
    if (index > -1) {
        db.ROLES_DATA.splice(index, 1);
        delete db.GLOBAL_AKSES_MENU_DETAIL_PERMISSIONS[id_role];
        return { success: true };
    }
    return { success: false, message: 'Role tidak ditemukan.' };
};

// --- API UNIT ---

interface GetUnitsParams {
    branchId?: string | null;
    groupId?: string | null;
    search?: string;
}

// OPTIMIZED: Server-side filtering untuk Unit
export const getUnits = async (params?: GetUnitsParams): Promise<Unit[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.UNIT_DATA;

    if (params?.branchId) {
        const branch = db.BRANCHES_DATA.find(b => b.id_cabang === params.branchId);
        if (branch) {
            // Include units specific to this branch OR global to the group (id_cabang is null)
            data = data.filter(u => 
                u.id_cabang === params.branchId || 
                (u.id_grup === branch.id_grup && u.id_cabang === null)
            );
        } else {
            // Safety fallback: if branchId is provided but invalid/not found, return empty to prevent data leak
            return [];
        }
    } else if (params?.groupId) {
        // Show units for the group (global) or any branch within group
        // First find all branch IDs in group
        const branchesInGroup = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
        
        data = data.filter(u => 
            (u.id_grup === params.groupId && u.id_cabang === null) ||
            (u.id_cabang && branchesInGroup.includes(u.id_cabang))
        );
    }

    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(u => 
            u.nama_unit.toLowerCase().includes(lowerTerm) ||
            (u.deskripsi_unit && u.deskripsi_unit.toLowerCase().includes(lowerTerm))
        );
    }

    return deepClone(data);
};

export const createUnit = async (unitData: Omit<Unit, 'id_unit'>): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const lowerCaseName = unitData.nama_unit.toLowerCase();
    
    const isDuplicate = db.UNIT_DATA.some(u => {
        if (u.nama_unit.toLowerCase() !== lowerCaseName) return false;
        if (u.id_grup === unitData.id_grup && u.id_cabang === unitData.id_cabang) return true;
        if (unitData.id_cabang !== null && u.id_grup === unitData.id_grup && u.id_cabang === null) return true;
        if (unitData.id_cabang === null && u.id_grup === unitData.id_grup && u.id_cabang !== null) return true;
        return false;
    });

    if (isDuplicate) {
        const scope = unitData.id_cabang ? `cabang ${unitData.id_cabang}` : `grup ${unitData.id_grup}`;
        return { success: false, message: `Unit dengan nama "${unitData.nama_unit}" sudah ada di ${scope} atau di tingkat yang berkonflik.` };
    }
    
    let maxIdNum = 0;
    db.UNIT_DATA.forEach(u => { const match = u.id_unit.match(/^U(\d+)$/i); if (match) maxIdNum = Math.max(maxIdNum, parseInt(match[1])); });
    const newUnit: Unit = { id_unit: `U${maxIdNum + 1}`, ...unitData };
    db.UNIT_DATA.push(newUnit);
    return { success: true };
};
export const updateUnit = async (id_unit: string, unitData: Omit<Unit, 'id_unit'>): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.UNIT_DATA.findIndex(u => u.id_unit === id_unit);
    if (index === -1) return { success: false, message: "Unit tidak ditemukan." };
    
    const originalUnit = db.UNIT_DATA[index];
    const lowerCaseName = unitData.nama_unit.toLowerCase();

    const isDuplicate = db.UNIT_DATA.some(u => {
        if (u.id_unit === id_unit) return false;
        if (u.nama_unit.toLowerCase() !== lowerCaseName) return false;
        if (u.id_grup === originalUnit.id_grup && u.id_cabang === originalUnit.id_cabang) return true;
        if (originalUnit.id_cabang !== null && u.id_grup === originalUnit.id_grup && u.id_cabang === null) return true;
        if (originalUnit.id_cabang === null && u.id_grup === originalUnit.id_grup && u.id_cabang !== null) return true;
        return false;
    });

    if (isDuplicate) {
        const scope = originalUnit.id_cabang ? `cabang ${originalUnit.id_cabang}` : `grup ${originalUnit.id_grup}`;
        return { success: false, message: `Nama unit "${unitData.nama_unit}" sudah digunakan di ${scope} atau tingkat lainnya yang berkonflik.` };
    }
    
    db.UNIT_DATA[index] = {
        ...originalUnit,
        nama_unit: unitData.nama_unit,
        deskripsi_unit: unitData.deskripsi_unit,
    };
    return { success: true };
};
export const deleteUnit = async (id_unit: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const isUnitInUse = db.STOCK_DATA.some(s => s.unit === id_unit) || 
                       db.MATERIAL_VARIANTS_DATA.some(mv => mv.unit === id_unit) ||
                       db.BOM_DATA.some(b => b.unit_komponen === id_unit);
    if (isUnitInUse) {
        return { success: false, message: `Unit tidak dapat dihapus karena masih digunakan oleh Stok atau BOM.` };
    }
    const index = db.UNIT_DATA.findIndex(u => u.id_unit === id_unit);
    if (index > -1) {
        db.UNIT_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: "Unit tidak ditemukan." };
};