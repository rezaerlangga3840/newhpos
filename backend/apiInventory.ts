import { db, SIMULATED_DELAY } from './database';
import { Stok, MaterialVariant, ProductVariant, StokOpname, BalanceStok, StokOpnameItem } from '../types';
import { deepClone } from '../utils';
import { calculateHppForProduct, recalculateParentStockQuantity } from './businessLogic';


// --- API Stok ---
interface GetStockParams {
    branchId?: string | null;
    groupId?: string | null;
    search?: string;
    type?: string;
}

// OPTIMIZED: Server-side filtering
export const getStocks = async (params?: GetStockParams): Promise<Stok[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.STOCK_DATA;

    // Filter by Scope
    if (params?.branchId) {
        data = data.filter(s => s.id_cabang === params.branchId);
    } else if (params?.groupId) {
         // Find branches in this group
         const branchesInGroup = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
         data = data.filter(s => branchesInGroup.includes(s.id_cabang));
    }

    // Filter by Type
    if (params?.type) {
        data = data.filter(s => s.type === params.type);
    }

    // Filter by Search
    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(s => 
            s.nama_stok.toLowerCase().includes(lowerTerm) || 
            s.id_stok.toLowerCase().includes(lowerTerm) ||
            (s.kategori && s.kategori.toLowerCase().includes(lowerTerm))
        );
    }

    return deepClone(data);
};

export const createStok = async (data: Stok): Promise<Stok> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    db.STOCK_DATA.push(data);
    return deepClone(data);
};
export const updateStok = async (id: string, branchId: string, data: Stok): Promise<Stok> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.STOCK_DATA.findIndex(s => s.id_stok === id && s.id_cabang === branchId);
    if (index > -1) {
        db.STOCK_DATA[index] = data;
        return deepClone(data);
    }
    throw new Error("Stok not found");
};
export const deleteStok = async (id: string, branchId: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    // Simple deletion for simulation
    const index = db.STOCK_DATA.findIndex(s => s.id_stok === id && s.id_cabang === branchId);
    if (index > -1) {
        db.STOCK_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Stok not found' };
};

// --- API Material Variant ---
interface GetVariantParams {
    branchId?: string | null;
    groupId?: string | null;
    skipHpp?: boolean;
    search?: string; // Added search param
}

// OPTIMIZED: Server-side filtering
export const getMaterialVariants = async (params?: GetVariantParams): Promise<MaterialVariant[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.MATERIAL_VARIANTS_DATA;

    if (params?.branchId) {
        data = data.filter(v => v.id_cabang === params.branchId);
    } else if (params?.groupId) {
        const branchesInGroup = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
        data = data.filter(v => branchesInGroup.includes(v.id_cabang));
    }

    // Filter by Search (Optimization: Include Parent Name Search)
    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        
        // Find IDs of stocks that match the search term (for Parent Name search)
        // Optimization: Create a Set for O(1) lookup
        const matchingStockIds = new Set(
            db.STOCK_DATA
                .filter(s => s.nama_stok.toLowerCase().includes(lowerTerm))
                .map(s => s.id_stok)
        );

        data = data.filter(v => 
            v.nama_variant.toLowerCase().includes(lowerTerm) || 
            v.id_variant_material.toLowerCase().includes(lowerTerm) ||
            matchingStockIds.has(v.id_stok) // Check if parent name matched
        );
    }

    return deepClone(data);
};

export const createMaterialVariant = async (data: MaterialVariant): Promise<MaterialVariant> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    db.MATERIAL_VARIANTS_DATA.push(data);
    recalculateParentStockQuantity(data.id_cabang, data.id_stok);
    return deepClone(data);
};
export const updateMaterialVariant = async (id: string, data: MaterialVariant): Promise<MaterialVariant> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.MATERIAL_VARIANTS_DATA.findIndex(v => v.id_variant_material === id);
    if (index > -1) {
        const oldParentId = db.MATERIAL_VARIANTS_DATA[index].id_stok;
        db.MATERIAL_VARIANTS_DATA[index] = data;
        recalculateParentStockQuantity(data.id_cabang, oldParentId);
        if (oldParentId !== data.id_stok) {
            recalculateParentStockQuantity(data.id_cabang, data.id_stok);
        }
        return deepClone(data);
    }
    throw new Error("Material variant not found");
};
export const deleteMaterialVariant = async (branchId: string, parentStockId: string, variantId: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.MATERIAL_VARIANTS_DATA.findIndex(v => v.id_variant_material === variantId && v.id_cabang === branchId);
    if (index > -1) {
        db.MATERIAL_VARIANTS_DATA.splice(index, 1);
        recalculateParentStockQuantity(branchId, parentStockId);
        return { success: true };
    }
    return { success: false, message: 'Variant not found' };
};

// --- API Product Variant ---

// OPTIMIZED: Server-side filtering & HPP calc conditional
export const getProductVariants = async (params?: GetVariantParams): Promise<ProductVariant[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.PRODUCT_VARIANTS_DATA;

    if (params?.branchId) {
        data = data.filter(v => v.id_cabang === params.branchId);
    } else if (params?.groupId) {
        const branchesInGroup = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
        data = data.filter(v => branchesInGroup.includes(v.id_cabang));
    }

    // Filter by Search (Optimization)
    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        
        // Find IDs of PARENT stocks that match the search term
        const matchingParentStockIds = new Set(
            db.STOCK_DATA
                .filter(s => s.type === 'product' && s.nama_stok.toLowerCase().includes(lowerTerm))
                .map(s => s.id_stok)
        );

        data = data.filter(v => 
            (v.nama_variant_product && v.nama_variant_product.toLowerCase().includes(lowerTerm)) || 
            v.id_variant_product.toLowerCase().includes(lowerTerm) ||
            matchingParentStockIds.has(v.id_stok_product) // Search by parent product name
        );
    }

    // Optimization: Skip heavy HPP calculation if client doesn't need it (e.g. Stock Overview list)
    if (params?.skipHpp) {
        return deepClone(data);
    }

    // Calculate HPP for each variant (Heavy op)
    const variantsWithHpp = data.map(variant => ({
        ...variant,
        hpp: calculateHppForProduct(variant.id_cabang, variant.id_stok_product, variant.id_variant_product)
    }));
    return deepClone(variantsWithHpp);
};

export const createProductVariant = async (data: ProductVariant): Promise<ProductVariant> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    db.PRODUCT_VARIANTS_DATA.push(data);
    return deepClone(data);
};
export const updateProductVariant = async (id: string, branchId: string, parentId: string, data: ProductVariant): Promise<ProductVariant> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.PRODUCT_VARIANTS_DATA.findIndex(v => v.id_variant_product === id && v.id_cabang === branchId);
    if (index > -1) {
        db.PRODUCT_VARIANTS_DATA[index] = data;
        return deepClone(data);
    }
    throw new Error("Product variant not found");
};
export const deleteProductVariant = async (branchId: string, parentId: string, variantId: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.PRODUCT_VARIANTS_DATA.findIndex(v => v.id_variant_product === variantId && v.id_cabang === branchId);
    if (index > -1) {
        db.PRODUCT_VARIANTS_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Variant not found' };
};

// ... (rest of the file remains unchanged) ...
// --- Stock Opname API ---

interface GetStokOpnameParams {
    branchId?: string | null;
    groupId?: string | null;
    startDate?: string;
    endDate?: string;
}

// OPTIMIZED: Return headers only (items: []) to save bandwidth
export const getStokOpnames = async (params?: GetStokOpnameParams): Promise<StokOpname[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.STOK_OPNAME_DATA;

    // Filter by Scope
    if (params?.branchId) {
        data = data.filter(s => s.id_cabang === params.branchId);
    } else if (params?.groupId) {
        const branchesInGroup = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
        data = data.filter(s => branchesInGroup.includes(s.id_cabang));
    }

    // Filter by Date
    if (params?.startDate) {
        data = data.filter(s => s.tanggal_opname_mulai >= params.startDate!);
    }
    if (params?.endDate) {
        const endDateObj = new Date(params.endDate);
        endDateObj.setHours(23, 59, 59, 999);
        data = data.filter(s => new Date(s.tanggal_opname_mulai) <= endDateObj);
    }

    // Optimization: Exclude heavy 'items' array for list view
    return data.map(opname => ({
        ...opname,
        items: [] // Send empty items to reduce payload
    }));
};

// NEW: API to fetch detail for a specific opname (Lazy Loading)
export const getStokOpnameDetail = async (id: string): Promise<StokOpname | null> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const opname = db.STOK_OPNAME_DATA.find(s => s.id_stok_opname === id);
    return opname ? deepClone(opname) : null;
};

export const createStokOpname = async (branchId: string, userId: string): Promise<StokOpname> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));

    const branch = db.BRANCHES_DATA.find(b => b.id_cabang === branchId);
    if (!branch) {
        throw new Error("Cabang tidak valid untuk memulai opname.");
    }
    const grupId = branch.id_grup;

    const itemsForOpname = [...db.STOCK_DATA, ...db.MATERIAL_VARIANTS_DATA].filter(
        item => item.id_cabang === branchId && item.tampil_di_opname
    );

    const unitMap = new Map(db.UNIT_DATA.map(u => [u.id_unit, u.nama_unit]));
    const stockMap = new Map(db.STOCK_DATA.map(s => [s.id_stok, s.nama_stok]));

    const opnameItems: StokOpnameItem[] = itemsForOpname.map((item, index) => {
        const isVariant = 'id_variant_material' in item;
        const qtySystem = item.quantity ?? 0;
        return {
            id_stok_opname_item: `SOI-${Date.now()}-${index}`,
            id_stok: isVariant ? (item as MaterialVariant).id_stok : item.id_stok,
            id_variant_material: isVariant ? (item as MaterialVariant).id_variant_material : null,
            nama_stok_display: isVariant ? `${stockMap.get((item as MaterialVariant).id_stok) || '?'} - ${(item as MaterialVariant).nama_variant}` : item.nama_stok,
            unit_display: unitMap.get(item.unit) || '?',
            qty_system: qtySystem,
            qty_fisik: null,
            selisih: -qtySystem,
        };
    });

    const newSession: StokOpname = {
        id_stok_opname: `SO-${branchId}-${Date.now()}`,
        nama_opname: `Opname ${branchId} - ${new Date().toLocaleDateString('id-ID')}`,
        id_grup: grupId,
        id_cabang: branchId,
        tanggal_opname_mulai: new Date().toISOString(),
        id_user_staff: userId,
        status: 'draft',
        items: opnameItems,
    };

    db.STOK_OPNAME_DATA.push(newSession);
    return deepClone(newSession);
};
export const updateStokOpname = async (id: string, sessionData: StokOpname): Promise<StokOpname> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.STOK_OPNAME_DATA.findIndex(s => s.id_stok_opname === id);
    if (index > -1) {
        const oldStatus = db.STOK_OPNAME_DATA[index].status;
        
        // Handle stock adjustment and logging if status changes to 'confirmed'
        if (sessionData.status === 'confirmed' && oldStatus !== 'confirmed') {
            const branch = db.BRANCHES_DATA.find(b => b.id_cabang === sessionData.id_cabang);
            if (!branch) {
                console.error(`Branch not found for opname: ${sessionData.id_cabang}`);
                throw new Error("Branch for opname not found");
            }
            const grupId = branch.id_grup;

            for (const item of sessionData.items) {
                if (item.is_confirmed_admin && item.selisih !== 0) {
                    const newQuantity = item.qty_system + item.selisih;

                    // 1. Adjust stock quantity
                    if (item.id_variant_material) {
                        const variantIndex = db.MATERIAL_VARIANTS_DATA.findIndex(mv => mv.id_variant_material === item.id_variant_material && mv.id_cabang === sessionData.id_cabang);
                        if (variantIndex > -1) {
                            db.MATERIAL_VARIANTS_DATA[variantIndex].quantity = newQuantity;
                            // Recalculate parent stock
                            recalculateParentStockQuantity(sessionData.id_cabang, db.MATERIAL_VARIANTS_DATA[variantIndex].id_stok);
                        }
                    } else {
                        const stockIndex = db.STOCK_DATA.findIndex(s => s.id_stok === item.id_stok && s.id_cabang === sessionData.id_cabang);
                        if (stockIndex > -1) {
                            db.STOCK_DATA[stockIndex].quantity = newQuantity;
                        }
                    }

                    // 2. Create BalanceStok log
                    const logType = item.selisih > 0 ? 'stok selisih nambah opname' : 'stok selisih kurang opname';
                    
                    const itemForUnitLookup = item.id_variant_material
                        ? db.MATERIAL_VARIANTS_DATA.find(mv => mv.id_variant_material === item.id_variant_material)
                        : db.STOCK_DATA.find(s => s.id_stok === item.id_stok);
                    
                    const unitId = itemForUnitLookup?.unit || 'UNKNOWN_UNIT';
                    
                    const newBalanceLog: BalanceStok = {
                        id_balance_stok: `BS-${Date.now()}-${item.id_stok_opname_item}`,
                        id_grup: grupId,
                        id_cabang: sessionData.id_cabang,
                        id_transaksi: sessionData.id_stok_opname,
                        type: logType,
                        item_id: item.id_variant_material || item.id_stok,
                        item_is_variant: !!item.id_variant_material,
                        quantity: Math.abs(item.selisih),
                        unit_id: unitId,
                        tanggal: sessionData.tanggal_opname_konfirmasi || new Date().toISOString(),
                        id_user: sessionData.id_user_admin!,
                    };
                    db.BALANCE_STOK_DATA.push(newBalanceLog);
                }
            }
        }

        db.STOK_OPNAME_DATA[index] = sessionData;
        return deepClone(sessionData);
    }
    throw new Error("Opname session not found");
};
export const deleteStokOpname = async (id: string): Promise<{ success: boolean }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.STOK_OPNAME_DATA.findIndex(s => s.id_stok_opname === id);
    if (index > -1) {
        db.STOK_OPNAME_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false };
};

// --- Balance Stok API ---
interface GetBalanceStokParams {
    branchId?: string | null;
    groupId?: string | null;
    startDate?: string;
    endDate?: string;
}

export const getBalanceStoks = async (params?: GetBalanceStokParams): Promise<(BalanceStok & { item_name: string; unit_name: string; user_name: string })[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.BALANCE_STOK_DATA;

    // Filter by Scope
    if (params?.branchId) {
        data = data.filter(item => item.id_cabang === params.branchId);
    } else if (params?.groupId) {
         // Find branches in this group
         const branchesInGroup = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
         data = data.filter(item => branchesInGroup.includes(item.id_cabang));
    }

    // Filter by Date Range (Crucial for performance)
    if (params?.startDate) {
        data = data.filter(item => item.tanggal >= params.startDate!);
    }
    if (params?.endDate) {
         // Add 1 day to end date to include the whole day if simple string comparison
        const endDateObj = new Date(params.endDate);
        endDateObj.setHours(23, 59, 59, 999);
        data = data.filter(item => new Date(item.tanggal) <= endDateObj);
    }

    // Optimization: Join Data Server-Side
    // Instead of sending raw IDs and making the frontend fetch ALL stocks/users, we map names here.
    // In a real DB, this is a SQL JOIN.
    
    // Create Lookup Maps only for the filtered data scope (simulated optimization)
    const stockMap = new Map(db.STOCK_DATA.map(s => [s.id_stok, s.nama_stok]));
    const variantMap = new Map(db.MATERIAL_VARIANTS_DATA.map(v => [v.id_variant_material, { name: v.nama_variant, parentId: v.id_stok }]));
    const unitMap = new Map(db.UNIT_DATA.map(u => [u.id_unit, u.nama_unit]));
    const userMap = new Map(db.USERS_DATA.map(u => {
        const kry = db.KARYAWAN_DATA.find(k => k.id_karyawan === u.id_karyawan);
        return [u.id_user, kry ? kry.nama_lengkap : u.username];
    }));

    const enrichedData = data.map(item => {
        let itemName = item.item_id;
        if (item.item_is_variant) {
            const variantInfo = variantMap.get(item.item_id);
            const parentName = variantInfo ? stockMap.get(variantInfo.parentId) : 'Unknown';
            itemName = variantInfo ? `${parentName} - ${variantInfo.name}` : item.item_id;
        } else {
            itemName = stockMap.get(item.item_id) || item.item_id;
        }

        return {
            ...item,
            item_name: itemName,
            unit_name: unitMap.get(item.unit_id) || item.unit_id,
            user_name: userMap.get(item.id_user) || item.id_user
        };
    });

    // Sort Descending Date
    return enrichedData.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
};
export const createBalanceStok = async (data: Omit<BalanceStok, 'id_balance_stok' | 'id_grup'>): Promise<BalanceStok> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const branch = db.BRANCHES_DATA.find(b => b.id_cabang === data.id_cabang);
    if (!branch) throw new Error("Branch not found for Balance Stok creation");

    const newItem: BalanceStok = { ...data, id_grup: branch.id_grup, id_balance_stok: `BS-${Date.now()}` };
    db.BALANCE_STOK_DATA.push(newItem);

    // Also update the stock quantity
    const qtyChange = newItem.type === 'stok masuk' ? newItem.quantity : -newItem.quantity;
    if (newItem.item_is_variant) {
        const variantIndex = db.MATERIAL_VARIANTS_DATA.findIndex(v => v.id_variant_material === newItem.item_id && v.id_cabang === newItem.id_cabang);
        if (variantIndex > -1) {
            db.MATERIAL_VARIANTS_DATA[variantIndex].quantity += qtyChange;
            recalculateParentStockQuantity(newItem.id_cabang, db.MATERIAL_VARIANTS_DATA[variantIndex].id_stok);
        }
    } else {
        const stockIndex = db.STOCK_DATA.findIndex(s => s.id_stok === newItem.item_id && s.id_cabang === newItem.id_cabang);
        if (stockIndex > -1) {
            db.STOCK_DATA[stockIndex].quantity = (db.STOCK_DATA[stockIndex].quantity || 0) + qtyChange;
        }
    }

    return deepClone(newItem);
};
export const updateBalanceStok = async (id: string, data: Partial<Omit<BalanceStok, 'id_balance_stok' | 'id_grup'>>): Promise<BalanceStok> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.BALANCE_STOK_DATA.findIndex(b => b.id_balance_stok === id);
    if (index > -1) {
        const oldItem = db.BALANCE_STOK_DATA[index];
        const newCabangId = data.id_cabang || oldItem.id_cabang;
        const branch = db.BRANCHES_DATA.find(b => b.id_cabang === newCabangId);
        const newGrupId = branch ? branch.id_grup : oldItem.id_grup;
        
        // Reverse old stock change
        const oldQtyChange = oldItem.type === 'stok masuk' ? -oldItem.quantity : oldItem.quantity;
        if (oldItem.item_is_variant) {
            const variantIndex = db.MATERIAL_VARIANTS_DATA.findIndex(v => v.id_variant_material === oldItem.item_id && v.id_cabang === oldItem.id_cabang);
            if(variantIndex > -1) {
                db.MATERIAL_VARIANTS_DATA[variantIndex].quantity += oldQtyChange;
                recalculateParentStockQuantity(oldItem.id_cabang, db.MATERIAL_VARIANTS_DATA[variantIndex].id_stok);
            }
        } else {
             const stockIndex = db.STOCK_DATA.findIndex(s => s.id_stok === oldItem.item_id && s.id_cabang === oldItem.id_cabang);
             if(stockIndex > -1) db.STOCK_DATA[stockIndex].quantity = (db.STOCK_DATA[stockIndex].quantity || 0) + oldQtyChange;
        }
        
        // Apply new stock change
        const newItem = { ...oldItem, ...data, id_grup: newGrupId };
        const newQtyChange = newItem.type === 'stok masuk' ? newItem.quantity : -newItem.quantity;
        if (newItem.item_is_variant) {
            const variantIndex = db.MATERIAL_VARIANTS_DATA.findIndex(v => v.id_variant_material === newItem.item_id && v.id_cabang === newItem.id_cabang);
            if (variantIndex > -1) {
                db.MATERIAL_VARIANTS_DATA[variantIndex].quantity += newQtyChange;
                recalculateParentStockQuantity(newItem.id_cabang, db.MATERIAL_VARIANTS_DATA[variantIndex].id_stok);
            }
        } else {
            const stockIndex = db.STOCK_DATA.findIndex(s => s.id_stok === newItem.item_id && s.id_cabang === newItem.id_cabang);
            if (stockIndex > -1) {
                db.STOCK_DATA[stockIndex].quantity = (db.STOCK_DATA[stockIndex].quantity || 0) + newQtyChange;
            }
        }
        
        db.BALANCE_STOK_DATA[index] = newItem;
        return deepClone(newItem);
    }
    throw new Error("Balance Stok entry not found");
};
export const deleteBalanceStok = async (id: string): Promise<{ success: boolean }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.BALANCE_STOK_DATA.findIndex(b => b.id_balance_stok === id);
    if (index > -1) {
        db.BALANCE_STOK_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false };
};
