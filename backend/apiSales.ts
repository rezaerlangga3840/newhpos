import { db, SIMULATED_DELAY } from './database';
import { Transaction, SelfOrder, Customer, Promo, PaymentMethod, DeliveryFeeSettings, Meja, TransactionItem, BOMEntryKomponen, BalanceStok } from '../types';
import { deepClone } from '../utils';
import { calculateHppForItem, recalculateParentStockQuantity } from './businessLogic';

// --- CORE TRANSACTION LOGIC ---

export const createPosTransaction = async (payload: Omit<Transaction, 'id_transaksi' | 'id_grup'>): Promise<{ success: boolean; transaction?: Transaction; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));

    const branch = db.BRANCHES_DATA.find(b => b.id_cabang === payload.id_cabang);
    if (!branch) {
        return { success: false, message: `Cabang dengan ID ${payload.id_cabang} tidak ditemukan.` };
    }
    const grupId = branch.id_grup;

    // Deduct stock
    for (const item of payload.items) {
        // Find BOM for this item
        const boms = db.BOM_DATA.filter(b => 
            b.id_cabang === payload.id_cabang && 
            b.id_stok_product === item.id_stok && 
            b.id_variant_product === item.id_variant_product
        );
        
        if (boms.length > 0) {
            // Deduct components from BOM
            for (const bomEntry of boms) {
                const quantityToDeduct = item.quantity * bomEntry.quantity_komponen;
                const komponen: BOMEntryKomponen = bomEntry.komponen;
                if (komponen.type === 'stok') {
                    const stockIndex = db.STOCK_DATA.findIndex(s => s.id_stok === komponen.id_stok && s.id_cabang === payload.id_cabang);
                    if (stockIndex > -1) {
                        db.STOCK_DATA[stockIndex].quantity = (db.STOCK_DATA[stockIndex].quantity || 0) - quantityToDeduct;
                    }
                } else if (komponen.type === 'material_variant') {
                    const variantIndex = db.MATERIAL_VARIANTS_DATA.findIndex(v => v.id_variant_material === komponen.id_variant_material && v.id_cabang === payload.id_cabang);
                    if (variantIndex > -1) {
                        db.MATERIAL_VARIANTS_DATA[variantIndex].quantity -= quantityToDeduct;
                        // Recalculate parent stock
                        recalculateParentStockQuantity(payload.id_cabang, db.MATERIAL_VARIANTS_DATA[variantIndex].id_stok);
                    }
                }
            }
        } else {
            // No BOM, deduct parent product directly
            const stockIndex = db.STOCK_DATA.findIndex(s => s.id_stok === item.id_stok && s.id_cabang === payload.id_cabang);
            if (stockIndex > -1) {
                 db.STOCK_DATA[stockIndex].quantity = (db.STOCK_DATA[stockIndex].quantity || 0) - item.quantity;
            }
        }
    }
    
    // Calculate HPP
    let totalHpp = 0;
    for (const item of payload.items) {
        totalHpp += calculateHppForItem(payload.id_cabang, item.id_stok, item.id_variant_product) * item.quantity;
    }

    const newTransactionId = payload.asal_data === 'Self-Order' ? `T-POSSO-${Date.now()}` : `T-POS-${Date.now()}`;
    const newTransaction: Transaction = { 
        ...payload, 
        id_grup: grupId,
        id_transaksi: newTransactionId,
        status_pesanan: payload.status_pesanan || 'menunggu_persiapan', // Set status for KDS
        total_hpp: totalHpp,
        laba_kotor: payload.total_keseluruhan - totalHpp
    };

    // BACKEND: Add BalanceStok log for every component deducted
    for (const item of newTransaction.items) {
        const boms = db.BOM_DATA.filter(b => 
            b.id_cabang === newTransaction.id_cabang && 
            b.id_stok_product === item.id_stok && 
            b.id_variant_product === item.id_variant_product
        );

        if (boms.length > 0) {
            for (const bomEntry of boms) {
                const quantityToLog = item.quantity * bomEntry.quantity_komponen;
                const komponen = bomEntry.komponen;
                let logItemId: string, logIsVariant: boolean, logUnitId: string;
                if (komponen.type === 'stok') {
                    logItemId = komponen.id_stok; logIsVariant = false; logUnitId = bomEntry.unit_komponen;
                } else {
                    logItemId = komponen.id_variant_material; logIsVariant = true; logUnitId = bomEntry.unit_komponen;
                }
                const newBalanceLog: BalanceStok = {
                    id_balance_stok: `BS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    id_grup: grupId,
                    id_cabang: newTransaction.id_cabang,
                    id_transaksi: newTransactionId,
                    type: 'keluar POS',
                    item_id: logItemId,
                    item_is_variant: logIsVariant,
                    quantity: quantityToLog,
                    unit_id: logUnitId,
                    tanggal: newTransaction.datetime,
                    id_user: newTransaction.id_user,
                };
                db.BALANCE_STOK_DATA.push(newBalanceLog);
            }
        } else {
            const product = db.STOCK_DATA.find(s => s.id_stok === item.id_stok && s.id_cabang === newTransaction.id_cabang);
            if (product) {
                const newBalanceLog: BalanceStok = {
                    id_balance_stok: `BS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    id_grup: grupId,
                    id_cabang: newTransaction.id_cabang,
                    id_transaksi: newTransactionId,
                    type: 'keluar POS',
                    item_id: item.id_stok,
                    item_is_variant: false,
                    quantity: item.quantity,
                    unit_id: product.unit,
                    tanggal: newTransaction.datetime,
                    id_user: newTransaction.id_user,
                };
                db.BALANCE_STOK_DATA.push(newBalanceLog);
            }
        }
    }

    db.TRANSACTIONS_DATA.push(newTransaction);
    return { success: true, transaction: deepClone(newTransaction) };
};

// --- DATA GETTERS FOR PAGES ---

export const getTransaksiPageData = async () => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return {
        transactions: deepClone(db.TRANSACTIONS_DATA),
        branches: deepClone(db.BRANCHES_DATA),
        users: deepClone(db.USERS_DATA.map(({ password, ...user }) => user)),
        karyawan: deepClone(db.KARYAWAN_DATA),
        stocks: deepClone(db.STOCK_DATA),
        productVariants: deepClone(db.PRODUCT_VARIANTS_DATA),
        boms: deepClone(db.BOM_DATA),
        customers: deepClone(db.CUSTOMERS_DATA),
        grups: deepClone(db.GRUP_DATA),
    };
};

export const getPenjualanSettingsPageData = async () => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return {
        promos: deepClone(db.PROMO_DATA),
        branches: deepClone(db.BRANCHES_DATA),
        stocks: deepClone(db.STOCK_DATA),
        productVariants: deepClone(db.PRODUCT_VARIANTS_DATA),
        customers: deepClone(db.CUSTOMERS_DATA),
        paymentMethods: deepClone(db.PAYMENT_METHODS_DATA),
        grups: deepClone(db.GRUP_DATA),
    };
};


// --- API METODE PEMBAYARAN ---
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return deepClone(db.PAYMENT_METHODS_DATA);
};
export const createPaymentMethod = async (data: Omit<PaymentMethod, 'id_metode'>): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    if (db.PAYMENT_METHODS_DATA.some(pm => 
        pm.id_grup === data.id_grup && 
        pm.id_cabang === data.id_cabang && 
        pm.nama_metode.toLowerCase() === data.nama_metode.toLowerCase()
    )) {
        const scope = data.id_cabang ? `cabang ${data.id_cabang}` : `grup ${data.id_grup}`;
        return { success: false, message: `Metode pembayaran "${data.nama_metode}" sudah ada di ${scope}.` };
    }
    const newId = `PM${Date.now()}`;
    const newItem: PaymentMethod = { ...data, id_metode: newId };
    db.PAYMENT_METHODS_DATA.push(newItem);
    return { success: true };
};
export const updatePaymentMethod = async (id_metode: string, data: Partial<Omit<PaymentMethod, 'id_metode'>>): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.PAYMENT_METHODS_DATA.findIndex(pm => pm.id_metode === id_metode);
    if (index === -1) return { success: false, message: 'Metode pembayaran tidak ditemukan.' };
    
    const originalItem = db.PAYMENT_METHODS_DATA[index];
    // Prevent changing scope on edit
    const dataToUpdate = { ...data };
    delete (dataToUpdate as any).id_cabang;
    delete (dataToUpdate as any).id_grup;

    if (data.nama_metode && db.PAYMENT_METHODS_DATA.some(pm => 
        pm.id_metode !== id_metode &&
        pm.id_grup === originalItem.id_grup &&
        pm.id_cabang === originalItem.id_cabang &&
        pm.nama_metode.toLowerCase() === data.nama_metode.toLowerCase()
    )) {
        const scope = originalItem.id_cabang ? `cabang ${originalItem.id_cabang}` : `grup ${originalItem.id_grup}`;
        return { success: false, message: `Nama metode "${data.nama_metode}" sudah digunakan di ${scope}.` };
    }
    db.PAYMENT_METHODS_DATA[index] = { ...originalItem, ...dataToUpdate };
    return { success: true };
};
export const deletePaymentMethod = async (id_metode: string): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    // In a real app, check if the method is used in any transactions before deleting.
    const index = db.PAYMENT_METHODS_DATA.findIndex(pm => pm.id_metode === id_metode);
    if (index > -1) {
        db.PAYMENT_METHODS_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Metode pembayaran tidak ditemukan.' };
};

// --- API BIAYA PENGANTARAN ---
export const getDeliveryFeeSettings = async (): Promise<DeliveryFeeSettings[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return deepClone(db.DELIVERY_FEE_SETTINGS_DATA);
};

export const getDeliveryFeeSettingsForBranch = async (branchId: string): Promise<DeliveryFeeSettings | null> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const settings = db.DELIVERY_FEE_SETTINGS_DATA.find(s => s.id_cabang === branchId);
    return settings ? deepClone(settings) : null;
};

export const saveDeliveryFeeSettings = async (settings: DeliveryFeeSettings): Promise<{ success: boolean }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.DELIVERY_FEE_SETTINGS_DATA.findIndex(s => s.id_cabang === settings.id_cabang);
    if (index > -1) {
        db.DELIVERY_FEE_SETTINGS_DATA[index] = settings;
    } else {
        db.DELIVERY_FEE_SETTINGS_DATA.push(settings);
    }
    return { success: true };
};


// --- API SELF ORDER ---
export const createSelfOrder = async (orderData: Omit<SelfOrder, 'id_self_order' | 'status' | 'created_at'>): Promise<{ success: boolean, order?: SelfOrder | Transaction, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY * 2));

    if (orderData.payment_method === 'kasir') {
        const transactionPayload: Omit<Transaction, 'id_transaksi' | 'id_grup'> = {
            id_cabang: orderData.id_cabang,
            datetime: new Date().toISOString(),
            id_user: 'SELF_ORDER_SYSTEM', // Special user for system-generated orders
            id_reff: `SO-${orderData.id_meja}-${Date.now()}`,
            asal_data: 'Self-Order',
            items: orderData.items,
            subtotal_sebelum_diskon: orderData.subtotal,
            diskon_nilai: orderData.discount,
            id_promo_applied: orderData.id_promo_applied,
            biaya_pengantaran: orderData.delivery_fee,
            total_keseluruhan: orderData.total,
            metode_pembayaran: 'Tunai', // This will be updated by the cashier later
            status_pembayaran: 'belum lunas',
            status_pesanan: 'menunggu_persiapan', // Sent to KDS
            catatan: `Pesanan dari ${orderData.customer_name}`,
        };

        const response = await createPosTransaction(transactionPayload);
        if (response.success && response.transaction) {
            return { success: true, order: response.transaction };
        } else {
            return { success: false, message: "Gagal membuat transaksi untuk pembayaran di kasir." };
        }
    } else { // Any non-cash method
        // Generate a unique total for QRIS payment matching
        const uniqueTotal = orderData.total + Math.floor(Math.random() * (999 - 100 + 1) + 100);

        const newOrder: SelfOrder = {
            ...orderData,
            id_self_order: `SO-${Date.now()}`,
            status: 'menunggu_pembayaran',
            created_at: new Date().toISOString(),
            total: uniqueTotal,
            id_promo_applied: orderData.id_promo_applied,
        };
        db.SELF_ORDERS_DATA.push(newOrder);
        return { success: true, order: deepClone(newOrder) };
    }
};

export const getSelfOrders = async (): Promise<SelfOrder[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    // Orders are now removed manually by cashier confirmation, expiry logic is removed.
    return deepClone(db.SELF_ORDERS_DATA);
};

export const confirmSelfOrderPayment = async (selfOrderId: string, userId: string): Promise<{ success: boolean, transaction?: Transaction, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY * 3));
    const orderIndex = db.SELF_ORDERS_DATA.findIndex(o => o.id_self_order === selfOrderId);
    if (orderIndex === -1) {
        return { success: false, message: 'Self-Order tidak ditemukan. Mungkin sudah dikonfirmasi atau dibatalkan.' };
    }
    const order = db.SELF_ORDERS_DATA[orderIndex];
    const promo = order.id_promo_applied ? db.PROMO_DATA.find(p => p.id_promo === order.id_promo_applied) : null;
    
    // Convert to transaction
    const transactionPayload: Omit<Transaction, 'id_transaksi' | 'id_grup'> = {
        id_cabang: order.id_cabang,
        datetime: new Date().toISOString(),
        id_user: userId,
        id_reff: order.id_self_order,
        asal_data: 'Self-Order',
        items: order.items,
        subtotal_sebelum_diskon: order.subtotal,
        diskon_nilai: order.discount,
        id_promo_applied: order.id_promo_applied,
        diskon_tipe: promo ? (promo.tipe_promo === 'persentase' ? 'persentase' : 'nominal') : (order.discount > 0 ? 'nominal' : null),
        biaya_pengantaran: order.delivery_fee,
        total_keseluruhan: order.total,
        metode_pembayaran: order.payment_method, // Use the selected method name
        status_pembayaran: 'lunas',
        status_pesanan: 'menunggu_persiapan',
        // Omitting optional fields for simplicity
    };
    
    const { transaction } = await createPosTransaction(transactionPayload);

    if (transaction) {
        // Remove from pending self-orders
        db.SELF_ORDERS_DATA.splice(orderIndex, 1);
        return { success: true, transaction };
    } else {
        return { success: false, message: 'Gagal membuat transaksi dari Self-Order.' };
    }
};

// --- API POS PAGE ---
export const getPosPageData = async (branchId: string) => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY * 2)); // Simulate a larger data fetch
    
    // Filter data based on branchId
    const allStocks = deepClone(db.STOCK_DATA);
    const products = allStocks.filter(s => s.id_cabang === branchId && s.type === 'product');
    const productVariants = deepClone(db.PRODUCT_VARIANTS_DATA).filter(pv => pv.id_cabang === branchId);
    const materialVariants = deepClone(db.MATERIAL_VARIANTS_DATA).filter(mv => mv.id_cabang === branchId);
    const units = deepClone(db.UNIT_DATA);
    const boms = deepClone(db.BOM_DATA).filter(b => b.id_cabang === branchId);
    const promos = deepClone(db.PROMO_DATA).filter(p => (p.id_cabang === branchId || p.id_cabang === null) && p.aktif);
    const customers = deepClone(db.CUSTOMERS_DATA); // Customers are global for now
    const tables = deepClone(db.MEJA_DATA).filter(t => t.id_cabang === branchId);
    const karyawan = deepClone(db.KARYAWAN_DATA).filter(k => k.id_cabang === branchId && k.status_karyawan === 'aktif');
    
    const branch = db.BRANCHES_DATA.find(b => b.id_cabang === branchId);
    const groupId = branch?.id_grup;
    const paymentMethods = deepClone(db.PAYMENT_METHODS_DATA).filter(pm => 
        pm.aktif && 
        (pm.id_cabang === branchId || (pm.id_grup === groupId && pm.id_cabang === null))
    );
    
    const unitMap = new Map(units.map(u => [u.id_unit, u.nama_unit]));

    // Simulate active dine-in orders by finding transactions linked to 'Terisi' tables
    const activeDineInOrders: Record<string, any> = {};
    const filledTables = tables.filter(t => t.status === 'Terisi' && t.id_pesanan_aktif);
    for (const table of filledTables) {
        const transaction = db.TRANSACTIONS_DATA.find(t => t.id_transaksi === table.id_pesanan_aktif);
        if (transaction) {
            const customer = transaction.id_pelanggan ? customers.find(c => c.id_pelanggan === transaction.id_pelanggan) : null;
            const temporaryCustomerName = table.nama_pelanggan_reservasi;
            
            const cartItems: TransactionItem[] = transaction.items.map(item => {
                const product = allStocks.find(s => s.id_stok === item.id_stok && s.id_cabang === branchId);
                const variant = item.id_variant_product ? productVariants.find(v => v.id_variant_product === item.id_variant_product) : undefined;
                return {
                    ...item,
                    nama_stok: product?.nama_stok || 'N/A',
                    nama_varian_produk: variant?.nama_variant_product,
                    photo_url: variant?.photo_url || product?.photo_url,
                    unit_nama: unitMap.get(product?.unit || '') || 'N/A'
                };
            });

            activeDineInOrders[table.id_meja] = {
                name: table.nama_meja,
                items: cartItems,
                heldAt: new Date(transaction.datetime).getTime(),
                customer: customer,
                temporaryCustomerName: temporaryCustomerName,
                guestCount: table.jumlah_tamu_reservasi
            };
        }
    }
    
    // Simulate top selling items (basic logic for now)
    const salesCounts = new Map<string, number>(); // key: 'stok:P1' or 'variant:VP1'
    db.TRANSACTIONS_DATA.forEach(trx => {
        if (trx.id_cabang === branchId) {
            trx.items.forEach(item => {
                const key = item.id_variant_product ? `variant:${item.id_variant_product}` : `stok:${item.id_stok}`;
                salesCounts.set(key, (salesCounts.get(key) || 0) + item.quantity);
            });
        }
    });

    const sellableItems: any[] = [
        ...products,
        ...productVariants
    ];

    const topSellingItems = sellableItems
        .map(item => {
            const isVariant = 'id_stok_product' in item;
            const key = isVariant ? `variant:${item.id_variant_product}` : `stok:${item.id_stok}`;
            return { ...item, sales: salesCounts.get(key) || 0 };
        })
        .filter(item => item.sales > 0)
        .sort((a,b) => b.sales - a.sales)
        .slice(0, 5);

    return {
        products,
        productVariants,
        allStocks: allStocks.filter(s => s.id_cabang === branchId),
        materialVariants,
        units,
        boms,
        promos,
        topSellingItems,
        customers,
        tables,
        karyawan,
        activeDineInOrders,
        paymentMethods
    };
};
export const getSelfOrderPageData = async (branchId: string): Promise<any> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const allStocks = deepClone(db.STOCK_DATA);
    const branch = db.BRANCHES_DATA.find(b => b.id_cabang === branchId);
    
    if (!branch) {
        throw new Error("Branch not found");
    }

    const groupId = branch.id_grup;

    const products = allStocks.filter(s => s.id_cabang === branchId && s.type === 'product');
    const productVariants = deepClone(db.PRODUCT_VARIANTS_DATA).filter(pv => pv.id_cabang === branchId);
    const units = deepClone(db.UNIT_DATA);
    const promos = deepClone(db.PROMO_DATA).filter(p => (p.id_cabang === branchId || (p.id_cabang === null && p.id_grup === groupId)) && p.aktif);
    const allMaterialVariants = deepClone(db.MATERIAL_VARIANTS_DATA).filter(mv => mv.id_cabang === branchId);
    
    const paymentMethods = deepClone(db.PAYMENT_METHODS_DATA).filter(pm => 
        pm.aktif && 
        pm.tipe_metode !== 'Cash' &&
        (pm.id_cabang === branchId || (pm.id_grup === groupId && pm.id_cabang === null))
    );


    // --- NEW LOGIC FOR BEST SELLERS ---
    const salesCounts = new Map<string, number>(); // key: 'stok:P1' or 'variant:VP1'
    db.TRANSACTIONS_DATA.forEach(trx => {
        if (trx.id_cabang === branchId) {
            trx.items.forEach(item => {
                const key = item.id_variant_product ? `variant:${item.id_variant_product}` : `stok:${item.id_stok}`;
                salesCounts.set(key, (salesCounts.get(key) || 0) + item.quantity);
            });
        }
    });

    const allSellableItems = [
        ...products.map(p => ({
            ...p,
            item_type: 'product' as const,
            sales: salesCounts.get(`stok:${p.id_stok}`) || 0
        })),
        ...productVariants.map(v => {
            const parent = products.find(p => p.id_stok === v.id_stok_product);
            return {
                ...v,
                kategori: parent?.kategori,
                item_type: 'variant' as const,
                sales: salesCounts.get(`variant:${v.id_variant_product}`) || 0
            };
        })
    ];

    const bestSellingItems = [...allSellableItems]
        .filter(item => item.sales > 0)
        .sort((a,b) => b.sales - a.sales)
        .slice(0,10);

    // --- NEW LOGIC FOR LEAST SELLERS ("Disarankan untukmu") ---
    const sellableItemsForRecommendation = allSellableItems.filter(item => {
        if (item.item_type === 'product') {
            // Exclude parent products that have variants
            const hasVariants = productVariants.some(v => v.id_stok_product === item.id_stok);
            return !hasVariants;
        }
        return true; // Always include variants
    });

    const groupedByCategory = sellableItemsForRecommendation.reduce((acc, item) => {
        const category = item.kategori || 'Lain-lain';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as Record<string, typeof sellableItemsForRecommendation>);

    const leastSoldPerCategory: (typeof sellableItemsForRecommendation) = [];
    for (const category in groupedByCategory) {
        if (Object.prototype.hasOwnProperty.call(groupedByCategory, category)) {
            const itemsInCategory = groupedByCategory[category];
            if (itemsInCategory.length > 0) {
                // Sort by sales ascending and take the first one
                itemsInCategory.sort((a, b) => a.sales - b.sales);
                leastSoldPerCategory.push(itemsInCategory[0]);
            }
        }
    }
    
    const leastSellingItems = leastSoldPerCategory.sort((a, b) => a.sales - b.sales).slice(0, 10);

    return {
        branch,
        products,
        productVariants,
        allMaterialVariants,
        units,
        promos,
        allStocks: allStocks.filter(s => s.id_cabang === branchId),
        bestSellingItems,
        leastSellingItems,
        paymentMethods,
    };
};

export const saveDineInOrder = async (payload: {
    tableId: string;
    items: TransactionItem[];
    customerId: string | null;
    userId: string;
}): Promise<{ success: boolean; transaction?: Transaction; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const { tableId, items, customerId, userId } = payload;

    const table = db.MEJA_DATA.find(t => t.id_meja === tableId);
    if (!table || table.status !== 'Terisi' || !table.id_pesanan_aktif) {
        return { success: false, message: "Sesi pesanan di meja ini belum dimulai atau meja tidak valid." };
    }
    const branch = db.BRANCHES_DATA.find(b => b.id_cabang === table.id_cabang);
    const grupId = branch ? branch.id_grup : '';

    const transactionId = table.id_pesanan_aktif;
    const existingTransactionIndex = db.TRANSACTIONS_DATA.findIndex(t => t.id_transaksi === transactionId);
    const total = items.reduce((sum, item) => sum + item.total_harga_item, 0);

    if (existingTransactionIndex > -1) {
        // Update existing transaction
        const trx = db.TRANSACTIONS_DATA[existingTransactionIndex];
        trx.items = items; // Overwrite with the full current cart
        trx.subtotal_sebelum_diskon = total;
        trx.total_keseluruhan = total; // Discounts are finalized at payment
        trx.id_pelanggan = customerId;
        trx.datetime = new Date().toISOString();
        trx.status_pesanan = 'menunggu_persiapan'; // Send/re-send to KDS
        trx.id_user = userId; // Update user in case server changes
        trx.id_grup = grupId;

        return { success: true, transaction: deepClone(trx) };
    } else {
        // Create new transaction if it doesn't exist
        const newTransaction: Transaction = {
            id_transaksi: transactionId,
            id_cabang: table.id_cabang,
            id_grup: grupId,
            datetime: new Date().toISOString(),
            id_user: userId,
            id_pelanggan: customerId,
            asal_data: 'POS Dine-in',
            items: items,
            subtotal_sebelum_diskon: total,
            total_keseluruhan: total,
            status_pesanan: 'menunggu_persiapan',
            status_pembayaran: 'belum lunas',
        };
        db.TRANSACTIONS_DATA.push(newTransaction);
        return { success: true, transaction: deepClone(newTransaction) };
    }
};

export const getTransactionById = async (transactionId: string): Promise<Transaction | undefined> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY / 2));
    const trx = db.TRANSACTIONS_DATA.find(t => t.id_transaksi === transactionId);
    return trx ? deepClone(trx) : undefined;
};

export const getKdsOrders = async ({ branchId, station }: { branchId: string; station: string }): Promise<Transaction[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY / 2));
    const kdsStatuses: Transaction['status_pesanan'][] = ['menunggu_persiapan', 'sedang_dibuat'];
    let orders = db.TRANSACTIONS_DATA.filter(t => t.id_cabang === branchId && kdsStatuses.includes(t.status_pesanan));

    if (station !== 'Semua') {
        orders = orders.filter(order => order.items.some(item => {
            const product = db.STOCK_DATA.find(s => s.id_stok === item.id_stok);
            return product?.stasiun_dapur === station;
        }));
    }
    return deepClone(orders);
};
export const updateOrderStatus = async ({ transactionId, newStatus }: { transactionId: string, newStatus: Transaction['status_pesanan'] }): Promise<{ success: boolean }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.TRANSACTIONS_DATA.findIndex(t => t.id_transaksi === transactionId);
    if (index > -1) {
        db.TRANSACTIONS_DATA[index].status_pesanan = newStatus;
        return { success: true };
    }
    return { success: false };
};

// --- API KDS ---
export const getKdsPageData = async () => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return {
        stocks: deepClone(db.STOCK_DATA),
        productVariants: deepClone(db.PRODUCT_VARIANTS_DATA),
        tables: deepClone(db.MEJA_DATA),
        customers: deepClone(db.CUSTOMERS_DATA),
    };
};

// --- API Meja/Dine-in ---
export const getTables = async (): Promise<Meja[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return deepClone(db.MEJA_DATA);
};
export const createTable = async (data: Omit<Meja, 'id_meja' | 'status' | 'id_pesanan_aktif' | 'waktu_terisi' | 'id_server' | 'nama_pelanggan_reservasi' | 'jumlah_tamu_reservasi' | 'telepon_pelanggan_reservasi'>): Promise<{ success: boolean, table?: Meja }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const newTable: Meja = {
        ...data,
        id_meja: `MJA${Date.now()}`,
        status: 'Tersedia',
        id_pesanan_aktif: null,
        waktu_terisi: null,
        id_server: null,
        nama_pelanggan_reservasi: null,
        jumlah_tamu_reservasi: null,
        telepon_pelanggan_reservasi: null,
    };
    db.MEJA_DATA.push(newTable);
    return { success: true, table: deepClone(newTable) };
};
export const updateTable = async (id: string, data: Partial<Omit<Meja, 'id_meja'>>): Promise<{ success: boolean, table?: Meja }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.MEJA_DATA.findIndex(t => t.id_meja === id);
    if (index > -1) {
        db.MEJA_DATA[index] = { ...db.MEJA_DATA[index], ...data };
        return { success: true, table: deepClone(db.MEJA_DATA[index]) };
    }
    return { success: false };
};
export const deleteTable = async (id: string): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.MEJA_DATA.findIndex(t => t.id_meja === id);
    if (index > -1) {
        db.MEJA_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Meja not found' };
};
export const updateTableState = async (id: string, state: Partial<Meja>): Promise<{ success: boolean, table?: Meja }> => {
    return updateTable(id, state);
};
export const mergeTables = async (sourceIds: string[], destId: string): Promise<{ success: boolean, updatedTables?: Meja[], message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const destIndex = db.MEJA_DATA.findIndex(t => t.id_meja === destId);
    if (destIndex === -1) return { success: false, message: 'Destination table not found' };

    const sourceTables = db.MEJA_DATA.filter(t => sourceIds.includes(t.id_meja));
    if (sourceTables.length !== sourceIds.length) return { success: false, message: 'One or more source tables not found' };

    const updatedTables: Meja[] = [];
    const firstSource = sourceTables[0];

    // Update destination table
    db.MEJA_DATA[destIndex] = { ...db.MEJA_DATA[destIndex], ...firstSource, status: 'Terisi', nama_meja: db.MEJA_DATA[destIndex].nama_meja };
    updatedTables.push(deepClone(db.MEJA_DATA[destIndex]));

    // Clear source tables
    sourceIds.forEach(id => {
        const srcIndex = db.MEJA_DATA.findIndex(t => t.id_meja === id);
        if (srcIndex > -1) {
            db.MEJA_DATA[srcIndex] = { ...db.MEJA_DATA[srcIndex], status: 'Perlu Dibersihkan', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null };
            updatedTables.push(deepClone(db.MEJA_DATA[srcIndex]));
        }
    });

    return { success: true, updatedTables };
};

// --- API Promo ---
export const createPromo = async (data: Omit<Promo, 'id_promo'>): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const newPromo: Promo = { ...data, id_promo: `PRM${Date.now()}` };
    db.PROMO_DATA.push(newPromo);
    return { success: true };
};
export const updatePromo = async (id: string, data: Omit<Promo, 'id_promo'>): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.PROMO_DATA.findIndex(p => p.id_promo === id);
    if (index > -1) {
        db.PROMO_DATA[index] = { ...data, id_promo: id };
        return { success: true };
    }
    return { success: false, message: 'Promo not found' };
};
export const deletePromo = async (id: string): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.PROMO_DATA.findIndex(p => p.id_promo === id);
    if (index > -1) {
        db.PROMO_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Promo not found' };
};

// --- API Customer ---
interface GetCustomersParams {
    groupId?: string | null;
    search?: string;
}

// OPTIMIZED: Server-side filtering for Customers
export const getCustomers = async (params?: GetCustomersParams): Promise<Customer[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.CUSTOMERS_DATA;

    if (params?.groupId) {
        data = data.filter(c => c.id_grup === params.groupId);
    }

    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(c => 
            c.nama_pelanggan.toLowerCase().includes(lowerTerm) ||
            (c.telepon && c.telepon.includes(lowerTerm)) ||
            (c.email && c.email.toLowerCase().includes(lowerTerm)) ||
            c.id_pelanggan.toLowerCase().includes(lowerTerm)
        );
    }

    return deepClone(data);
};
export const createCustomer = async (data: Omit<Customer, 'id_pelanggan' | 'tanggal_daftar'>): Promise<Customer> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const newCustomer: Customer = {
        ...data,
        id_pelanggan: `CUST${Date.now()}`,
        tanggal_daftar: new Date().toISOString(),
    };
    db.CUSTOMERS_DATA.push(newCustomer);
    return deepClone(newCustomer);
};
export const updateCustomer = async (id: string, data: Partial<Omit<Customer, 'id_pelanggan'>>): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.CUSTOMERS_DATA.findIndex(c => c.id_pelanggan === id);
    if (index > -1) {
        db.CUSTOMERS_DATA[index] = { ...db.CUSTOMERS_DATA[index], ...data };
        return { success: true };
    }
    return { success: false, message: 'Customer not found' };
};
export const deleteCustomer = async (id: string): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.CUSTOMERS_DATA.findIndex(c => c.id_pelanggan === id);
    if (index > -1) {
        db.CUSTOMERS_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Customer not found' };
};

// --- API Transaksi ---
export const updateTransaction = async (id: string, data: Partial<Omit<Transaction, 'id_transaksi'>>): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.TRANSACTIONS_DATA.findIndex(t => t.id_transaksi === id);
    if (index > -1) {
        db.TRANSACTIONS_DATA[index] = { ...db.TRANSACTIONS_DATA[index], ...data };
        return { success: true };
    }
    return { success: false, message: 'Transaction not found' };
};
export const deleteTransaction = async (id: string): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.TRANSACTIONS_DATA.findIndex(t => t.id_transaksi === id);
    if (index > -1) {
        // Here you would reverse stock changes. For simulation, just delete.
        db.TRANSACTIONS_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Transaction not found' };
};