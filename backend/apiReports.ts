import { db, SIMULATED_DELAY } from './database';
import { deepClone } from '../utils';
import { Stok, MaterialVariant, DayOfWeek } from '../types';


// --- Home & Dashboard ---
// BACKEND: Optimized getHomePageData
export const getHomePageData = async (params: { userId: string; karyawanId: string | null; branchId: string | null; branchIdsInScope: string[] }) => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const { userId, karyawanId, branchId, branchIdsInScope } = params;

    // Optimized: Fetch Karyawan directly
    const karyawan = karyawanId ? db.KARYAWAN_DATA.find(k => k.id_karyawan === karyawanId) : null;
    
    // Optimized: Date handling
    const today = new Date();
    const todayDay = today.toLocaleDateString('id-ID', { weekday: 'long' }) as DayOfWeek;
    const todayDateStr = today.toISOString().split('T')[0];

    // Optimized: Filter tasks in one pass
    const tasks = db.SCHEDULED_TASKS_DATA.filter(t => {
        if (!t.aktif) return false;
        if (t.id_cabang !== null && !branchIdsInScope.includes(t.id_cabang)) return false;
        if (t.tipe_ulangi === 'sekali') return t.tanggal_sekali === todayDateStr;
        if (t.tipe_ulangi === 'harian') return true;
        if (t.tipe_ulangi === 'mingguan') return t.hari_mingguan.includes(todayDay);
        return false;
    });

    // Optimized: Filter critical stock & variants in one pass (no full cloning)
    const criticalStock: (Stok | MaterialVariant)[] = [];
    
    // Helper Maps to avoid nested loops inside loops
    const stockMap = new Map<string, string>(); // id -> nama
    if (branchIdsInScope.length > 0) {
        for(const s of db.STOCK_DATA) {
            if(branchIdsInScope.includes(s.id_cabang)) {
                stockMap.set(s.id_stok, s.nama_stok);
                if (s.stok_kritis !== null && s.quantity !== null && s.quantity < s.stok_kritis) {
                    criticalStock.push(s);
                }
            }
        }
        for(const mv of db.MATERIAL_VARIANTS_DATA) {
             if(branchIdsInScope.includes(mv.id_cabang)) {
                if (mv.stok_kritis !== null && mv.quantity < mv.stok_kritis) {
                    // Enrich variant name directly here
                    const parentName = stockMap.get(mv.id_stok) || mv.id_stok;
                    criticalStock.push({ ...mv, nama_variant: `${parentName} - ${mv.nama_variant}` }); // Simplified structure for frontend
                }
             }
        }
    }
    
    // Sort and limit critical stock on backend to reduce payload
    const limitedCriticalStock = criticalStock.slice(0, 5);
    
    // Optimized: Transaction counting
    let totalSales = 0;
    let transactionCount = 0;
    
    // Loop once instead of filter().reduce()
    for (const t of db.TRANSACTIONS_DATA) {
        if (t.id_user === userId && t.datetime.startsWith(todayDateStr)) {
            totalSales += t.total_keseluruhan;
            transactionCount++;
        }
    }

    // Dummy notification data (static for now)
    const notifications = { 
        notifications: [{id: 1, text: "Opname bulanan cabang CB1 telah dikonfirmasi.", path: "/reports/opname-history", type: 'info', date: new Date().toISOString()}], 
        totalCount: 1 
    };

    // Return strict payload (no deepClone of massive arrays)
    return {
        karyawan: deepClone(karyawan),
        tasks: deepClone(tasks),
        criticalStock: { stocks: limitedCriticalStock, variants: [] }, // Frontend expects this structure, keep it but populate 'stocks' with mixed items for simplicity or separate if needed
        performance: { totalSales, transactionCount },
        attendance: { attendanceCount: 15, lateCount: 2, leaveBalance: 10 },
        notifications
    };
};

export const getDashboardData = async (params: { timePeriod: number, groupId: string | null, branchIds: string[] }) => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY)); // Keep delay small
    const { timePeriod, groupId, branchIds } = params;

    const now = new Date();
    // Hitung range tanggal periode saat ini
    const startDateCurrent = new Date();
    startDateCurrent.setDate(now.getDate() - timePeriod);
    
    // Hitung range tanggal periode sebelumnya (untuk perbandingan)
    const endDatePrevious = new Date(startDateCurrent);
    const startDatePrevious = new Date(endDatePrevious);
    startDatePrevious.setDate(endDatePrevious.getDate() - timePeriod);

    // Helper untuk konversi date ke time value agar perbandingan cepat
    const startCurrTime = startDateCurrent.getTime();
    const endPreviousTime = endDatePrevious.getTime();
    const startPrevTime = startDatePrevious.getTime();

    // Struktur Data untuk Agregasi
    let currentStats = { totalRevenue: 0, transactionCount: 0, activeBranches: new Set<string>() };
    let previousStats = { totalRevenue: 0, transactionCount: 0, avgTransaction: 0 };
    
    const branchPerformance = new Map<string, number>(); // id_cabang -> revenue
    const productPerformance = new Map<string, { name: string, quantity: number, profit: number }>();
    const chartDataMap = new Map<string, number>(); // key (date/hour) -> revenue

    // Optimasi Lookup
    const stockMap = new Map<string, string>();
    const variantMap = new Map<string, string>();
    
    if (branchIds.length > 0) {
         db.STOCK_DATA.forEach(s => {
             if (branchIds.includes(s.id_cabang)) stockMap.set(s.id_stok, s.nama_stok);
         });
         db.PRODUCT_VARIANTS_DATA.forEach(v => {
             if (branchIds.includes(v.id_cabang)) variantMap.set(v.id_variant_product, v.nama_variant_product || v.id_variant_product);
         });
    }

    // Single-Pass Loop Transaction Data
    // Kita hanya loop satu kali melalui transaksi untuk mengisi semua statistik
    for (const trx of db.TRANSACTIONS_DATA) {
        // Filter Scope Cabang/Grup
        if (groupId && trx.id_grup !== groupId) continue;
        if (branchIds.length > 0 && !branchIds.includes(trx.id_cabang)) continue;
        if (trx.status_pembayaran !== 'lunas') continue; // Hanya hitung yang lunas

        const trxTime = new Date(trx.datetime).getTime();
        const grossProfit = trx.laba_kotor || 0;

        // 1. Current Period Stats
        if (trxTime >= startCurrTime) {
            currentStats.totalRevenue += trx.total_keseluruhan;
            currentStats.transactionCount++;
            currentStats.activeBranches.add(trx.id_cabang);

            // Branch Performance
            branchPerformance.set(trx.id_cabang, (branchPerformance.get(trx.id_cabang) || 0) + trx.total_keseluruhan);

            // Chart Data Construction
            let chartKey: string;
            const dateObj = new Date(trx.datetime);
            if (timePeriod === 1) {
                // Per Hour for 1 day view
                chartKey = `${String(dateObj.getHours()).padStart(2, '0')}:00`;
            } else {
                // Per Day for > 1 day view
                chartKey = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            }
            chartDataMap.set(chartKey, (chartDataMap.get(chartKey) || 0) + trx.total_keseluruhan);

            // Product Performance (Best Selling & Profitable)
            trx.items.forEach(item => {
                const itemId = item.id_variant_product || item.id_stok;
                const itemName = item.id_variant_product 
                    ? `${stockMap.get(item.id_stok) || 'Produk'} - ${variantMap.get(item.id_variant_product) || 'Varian'}`
                    : (stockMap.get(item.id_stok) || item.id_stok);

                // Estimasi profit per item (simple proportion based on transaction profit)
                // Note: This is an approximation. Real profit per item needs HPP per item stored in trx items.
                const itemRatio = item.total_harga_item / (trx.total_keseluruhan || 1);
                const itemProfit = grossProfit * itemRatio;

                if (!productPerformance.has(itemId)) {
                    productPerformance.set(itemId, { name: itemName, quantity: 0, profit: 0 });
                }
                const record = productPerformance.get(itemId)!;
                record.quantity += item.quantity;
                record.profit += itemProfit;
            });

        } 
        // 2. Previous Period Stats
        else if (trxTime >= startPrevTime && trxTime < startCurrTime) {
            previousStats.totalRevenue += trx.total_keseluruhan;
            previousStats.transactionCount++;
        }
    }

    // Final Calculations
    const avgTransactionCurrent = currentStats.transactionCount > 0 
        ? currentStats.totalRevenue / currentStats.transactionCount 
        : 0;
    const avgTransactionPrevious = previousStats.transactionCount > 0 
        ? previousStats.totalRevenue / previousStats.transactionCount 
        : 0;

    // Sorting & Formatting
    
    // Branches
    let bestBranch = null;
    let worstBranch = null;
    if (branchPerformance.size > 0) {
        const sortedBranches = Array.from(branchPerformance.entries()).sort((a, b) => b[1] - a[1]);
        const bestId = sortedBranches[0][0];
        const worstId = sortedBranches[sortedBranches.length - 1][0];
        const branchNameMap = new Map(db.BRANCHES_DATA.map(b => [b.id_cabang, b.Nama]));
        
        bestBranch = { name: branchNameMap.get(bestId) || bestId, totalRevenue: sortedBranches[0][1] };
        worstBranch = { name: branchNameMap.get(worstId) || worstId, totalRevenue: sortedBranches[sortedBranches.length - 1][1] };
    }

    // Products
    const allProducts = Array.from(productPerformance.values());
    const topSellingProducts = [...allProducts].sort((a, b) => b.quantity - a.quantity).slice(0, 5).map(p => ({ id: p.name, name: p.name, quantity: p.quantity }));
    const topProfitableProducts = [...allProducts].sort((a, b) => b.profit - a.profit).slice(0, 5).map(p => ({ name: p.name, profit: p.profit }));

    // Chart Data (Fill gaps)
    const finalChartData: { label: string, value: number }[] = [];
    if (timePeriod === 1) {
        // Fill 24 hours
        for (let i = 8; i <= 22; i++) { // Operational hours approx
            const key = `${String(i).padStart(2, '0')}:00`;
            finalChartData.push({ label: key, value: chartDataMap.get(key) || 0 });
        }
    } else {
        // Fill days
        for (let i = 0; i < timePeriod; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (timePeriod - 1 - i));
            const key = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            finalChartData.push({ label: key, value: chartDataMap.get(key) || 0 });
        }
    }

    return {
        currentStats: {
            totalRevenue: currentStats.totalRevenue,
            transactionCount: currentStats.transactionCount,
            avgTransaction: avgTransactionCurrent,
            activeBranches: currentStats.activeBranches.size
        },
        previousStats: {
            totalRevenue: previousStats.totalRevenue,
            transactionCount: previousStats.transactionCount,
            avgTransaction: avgTransactionPrevious
        },
        bestBranch,
        worstBranch,
        topSellingProducts,
        topProfitableProducts,
        chartData: finalChartData
    };
};


// --- Reports API ---
export const getSalesReport = async (params: { startDate: string, endDate: string, branchId: string | null }): Promise<any> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return { transactions: [], summaryStats: { totalRevenue: 0, totalProfit: 0, transactionCount: 0, averageTransaction: 0 }, userDisplayMap: {}, branchMap: {} };
};
export const getStockReport = async (params: any): Promise<any> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return { mergedStockList: [] };
};
export const getInventoryValuationReport = async (params: any): Promise<any> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return { valuationList: [], summaryStats: { totalValue: 0, itemCount: 0 } };
};
export const getOpnameHistoryReport = async (params: any): Promise<any> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return { sessions: [], userDisplayMap: {}, branchMap: {} };
};
export const getAttendanceReport = async (params: any): Promise<any> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return { logs: [], karyawanMap: {}, branchMap: {} };
};
export const getPayrollReport = async (params: any): Promise<any> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return { payrolls: [], summaryStats: { totalPaid: 0, employeeCount: 0 }, karyawanMap: {}, branchMap: {} };
};
