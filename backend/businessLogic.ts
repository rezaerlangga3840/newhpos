import { db } from './database';

// FUNGSI BANTU (LOGIKA BISNIS INTERNAL)

export const calculateHppForProduct = (id_cabang: string, id_stok_product: string, id_variant_product: string | null): number => {
    const relevantBoms = db.BOM_DATA.filter(b => 
        b.id_cabang === id_cabang && 
        b.id_stok_product === id_stok_product && 
        b.id_variant_product === id_variant_product
    );

    if (relevantBoms.length === 0) {
        // Jika tidak ada BOM, coba cari harga beli dari produk itu sendiri (untuk produk jadi yang dibeli)
        const productStock = db.STOCK_DATA.find(s => s.id_cabang === id_cabang && s.id_stok === id_stok_product);
        return productStock?.harga_beli || 0;
    }

    let totalHpp = 0;

    for (const bomEntry of relevantBoms) {
        const { komponen, quantity_komponen } = bomEntry;
        let componentCostPerUnit = 0; // Ini adalah biaya per unit pemakaian (e.g., per gram, per pcs)

        if (komponen.type === 'stok') {
            const stokItem = db.STOCK_DATA.find(s => s.id_cabang === id_cabang && s.id_stok === komponen.id_stok);
            componentCostPerUnit = stokItem?.harga_beli || 0;
        } else if (komponen.type === 'material_variant') {
            const variantItem = db.MATERIAL_VARIANTS_DATA.find(mv => 
                mv.id_cabang === id_cabang && 
                mv.id_stok === komponen.id_stok_material && 
                mv.id_variant_material === komponen.id_variant_material
            );
            
            if (variantItem) {
                const hargaBeli = variantItem.harga_beli || 0;
                const netto = variantItem.netto;
                // FIX: Calculate cost per netto unit if netto is available
                if (netto && netto > 0) {
                    componentCostPerUnit = hargaBeli / netto;
                } else {
                    componentCostPerUnit = hargaBeli;
                }
            }
        }

        totalHpp += (componentCostPerUnit * quantity_komponen);
    }
    
    return totalHpp;
};

export const calculateHppForItem = (id_cabang: string, id_stok: string, id_variant_product: string | null): number => {
    // Check if it's a variant with a BOM
    if (id_variant_product) {
        const hpp = calculateHppForProduct(id_cabang, id_stok, id_variant_product);
        if (hpp > 0) return hpp;
    }

    // Check if base product has a BOM (for products sold without specific variants but have a default BOM)
    const baseProductHpp = calculateHppForProduct(id_cabang, id_stok, null);
    if (baseProductHpp > 0) return baseProductHpp;
    
    // Fallback to harga_beli of the parent stock item if no BOM is found
    const stockItem = db.STOCK_DATA.find(s => s.id_cabang === id_cabang && s.id_stok === id_stok);
    return stockItem?.harga_beli || 0;
};

// Logika bisnis untuk menghitung ulang jumlah total stok induk berdasarkan variannya.
export const recalculateParentStockQuantity = (idCabang: string, idStokParent: string): void => {
  const parentStockItem = db.STOCK_DATA.find(
    s => s.id_cabang === idCabang && s.id_stok === idStokParent && (s.type === 'material' || s.type === 'wip')
  );
  if (parentStockItem) {
    const variantsOfParent = db.MATERIAL_VARIANTS_DATA.filter(
      v => v.id_cabang === idCabang && v.id_stok === idStokParent
    );
    const totalVariantQuantity = variantsOfParent.reduce((sum, variant) => sum + variant.quantity, 0);
    parentStockItem.quantity = totalVariantQuantity;
  }
};
