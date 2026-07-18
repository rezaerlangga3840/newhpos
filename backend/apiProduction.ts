import { db, SIMULATED_DELAY } from './database';
import { BOMEntry, GroupedBom, Stok, ProductVariant } from '../types';
import { deepClone } from '../utils';
import { calculateHppForProduct } from './businessLogic';

interface GetBomParams {
    branchId?: string | null;
    groupId?: string | null;
    search?: string;
}

// OPTIMIZED: Grouping logic with Server-Side Join for Components
const groupBomsOptimized = (boms: BOMEntry[], stocks: Stok[], variants: ProductVariant[]): GroupedBom[] => {
    const grouped = new Map<string, GroupedBom>();
    
    // Create Lookup Maps for O(1) access to Product Parents
    const stockMap = new Map(stocks.map(s => [s.id_stok, s]));
    const variantMap = new Map(variants.map(v => [v.id_variant_product, v]));

    // Helper Maps for Component Lookup (To enrich data server-side)
    // We access the global DB directly here for reference data to avoid passing huge arrays
    // In a real DB, this would be a SQL JOIN
    const globalStockMap = new Map(db.STOCK_DATA.map(s => [s.id_stok, s]));
    const globalVariantMap = new Map(db.MATERIAL_VARIANTS_DATA.map(mv => [mv.id_variant_material, mv]));
    const globalUnitMap = new Map(db.UNIT_DATA.map(u => [u.id_unit, u.nama_unit]));

    boms.forEach(bom => {
      const key = `${bom.id_cabang}:${bom.id_stok_product}:${bom.id_variant_product}`;
      
      if (!grouped.has(key)) {
        const product = stockMap.get(bom.id_stok_product);
        const variant = bom.id_variant_product ? variantMap.get(bom.id_variant_product) : null;
        
        // Skip consistency check failure (phantom BOMs)
        if (!product) return; 

        grouped.set(key, {
          productKey: key,
          id_grup: bom.id_grup,
          id_cabang: bom.id_cabang,
          id_stok_product: bom.id_stok_product,
          id_variant_product: bom.id_variant_product,
          productName: product.nama_stok,
          variantName: variant?.nama_variant_product || '',
          totalHpp: 0, // will calculate later
          components: [],
        });
      }

      // ENRICHMENT: Inject display data so client doesn't need to fetch all stocks
      const enrichedBom = { ...bom } as any;
      
      if (bom.komponen.type === 'stok') {
          const compStock = globalStockMap.get(bom.komponen.id_stok);
          enrichedBom._cached_name = compStock?.nama_stok || bom.komponen.id_stok;
          enrichedBom._cached_cost = compStock?.harga_beli || 0;
          enrichedBom._cached_unit = globalUnitMap.get(compStock?.unit || '') || bom.unit_komponen;
      } else {
          const compVariant = globalVariantMap.get(bom.komponen.id_variant_material);
          const parentStock = compVariant ? globalStockMap.get(compVariant.id_stok) : null;
          enrichedBom._cached_name = compVariant ? `${parentStock?.nama_stok || '?'} - ${compVariant.nama_variant}` : bom.komponen.id_variant_material;
          
          let cost = 0;
          if (compVariant) {
            const hargaBeli = compVariant.harga_beli || 0;
            const netto = compVariant.netto;
            if (netto && netto > 0) {
                cost = hargaBeli / netto;
            } else {
                cost = hargaBeli;
            }
          }
          enrichedBom._cached_cost = cost;
          enrichedBom._cached_unit = compVariant ? (globalUnitMap.get(compVariant.unit_netto || compVariant.unit) || '') : bom.unit_komponen;
      }

      grouped.get(key)!.components.push(enrichedBom);
    });

    const result = Array.from(grouped.values());

    // Calculate HPP only for the filtered result set
    result.forEach(group => {
        group.totalHpp = calculateHppForProduct(group.id_cabang, group.id_stok_product, group.id_variant_product);
    });

    return result;
};

export const getBoms = async (params?: GetBomParams): Promise<GroupedBom[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let filteredBoms = db.BOM_DATA;

    // 1. Filter Raw BOM Data first
    if (params?.branchId) {
        filteredBoms = filteredBoms.filter(b => b.id_cabang === params.branchId);
    } else if (params?.groupId) {
        // Get branch IDs for group to filter BOMs correctly (since BOMs are linked to branch)
        const branchIds = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
        filteredBoms = filteredBoms.filter(b => branchIds.includes(b.id_cabang));
    }

    // 2. Prepare reference data (Scope restricted for performance)
    let relevantStocks = db.STOCK_DATA;
    let relevantVariants = db.PRODUCT_VARIANTS_DATA;
    
    if (params?.branchId) {
        relevantStocks = relevantStocks.filter(s => s.id_cabang === params.branchId);
        relevantVariants = relevantVariants.filter(v => v.id_cabang === params.branchId);
    }

    // 3. Group & Enrich
    let result = groupBomsOptimized(filteredBoms, relevantStocks, relevantVariants);

    // 4. Filter by Search (on Product Name)
    if (params?.search) {
        const term = params.search.toLowerCase();
        result = result.filter(g => 
            g.productName.toLowerCase().includes(term) || 
            (g.variantName && g.variantName.toLowerCase().includes(term))
        );
    }

    return deepClone(result);
};

// NEW: API to get products that DON'T have a BOM yet (for Dropdown)
// This is much lighter than sending all products to client
export const getBomCandidateProducts = async (branchId: string): Promise<{
    parentProducts: {id: string, name: string}[],
    variants: {id: string, name: string, parentId: string}[]
}> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    const existingBoms = new Set(db.BOM_DATA
        .filter(b => b.id_cabang === branchId)
        .map(b => `${b.id_stok_product}:${b.id_variant_product || 'null'}`)
    );

    const products = db.STOCK_DATA.filter(s => s.id_cabang === branchId && s.type === 'product');
    const variants = db.PRODUCT_VARIANTS_DATA.filter(v => v.id_cabang === branchId);

    const parentProducts: {id: string, name: string}[] = [];
    const availableVariants: {id: string, name: string, parentId: string}[] = [];

    // Check Variants first
    variants.forEach(v => {
        if (!existingBoms.has(`${v.id_stok_product}:${v.id_variant_product}`)) {
            availableVariants.push({
                id: v.id_variant_product,
                name: v.nama_variant_product || v.id_variant_product,
                parentId: v.id_stok_product
            });
        }
    });

    // Check Parent Products (only if they don't have variants or if we want to allow base BOM)
    // Business rule: If product has variants, usually BOM is on variant. 
    // But sometimes base product needs BOM if it's sold directly.
    products.forEach(p => {
        // If BOM for base product doesn't exist
        if (!existingBoms.has(`${p.id_stok}:null`)) {
             // Check if this product has variants. If it has variants, we usually define BOM per variant.
             // But let's allow defining base BOM if needed (user discretion).
             parentProducts.push({
                 id: p.id_stok,
                 name: p.nama_stok
             });
        }
    });

    return { parentProducts, variants: availableVariants };
};

export const createBom = async (data: Omit<BOMEntry, 'id_bom'>): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    if (!data.id_grup) {
        return { success: false, message: 'Grup ID is required for creating a BOM.' };
    }
    const newBom: BOMEntry = { ...data, id_bom: `BM${Date.now()}${Math.random()}` };
    db.BOM_DATA.push(newBom);
    return { success: true };
};
export const updateBom = async (id: string, data: Omit<BOMEntry, 'id_bom' | 'id_grup'>): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.BOM_DATA.findIndex(b => b.id_bom === id);
    if (index > -1) {
        const branch = db.BRANCHES_DATA.find(b => b.id_cabang === data.id_cabang);
        if (!branch) return { success: false, message: 'Cabang tidak valid.' };
        db.BOM_DATA[index] = { ...data, id_grup: branch.id_grup, id_bom: id };
        return { success: true };
    }
    return { success: false, message: 'BOM entry not found' };
};
export const deleteBom = async (id: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.BOM_DATA.findIndex(b => b.id_bom === id);
    if (index > -1) {
        db.BOM_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'BOM entry not found' };
};
