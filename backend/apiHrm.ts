import { db, SIMULATED_DELAY } from './database';
import { Karyawan, TitikAbsensi, AbsensiLog, PayrollComponent, Payroll } from '../types';
import { deepClone } from '../utils';
import { createUser } from './apiAuth'; // Re-use createUser for integrated flow

// --- API KARYAWAN & HRM TERKAIT ---

interface GetKaryawanParams {
    branchId?: string | null;
    groupId?: string | null;
    search?: string;
}

// OPTIMIZED: Server-side filtering untuk Karyawan
export const getKaryawan = async (params?: GetKaryawanParams): Promise<Karyawan[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.KARYAWAN_DATA;

    if (params?.branchId) {
        data = data.filter(k => k.id_cabang === params.branchId);
    } else if (params?.groupId) {
        data = data.filter(k => k.id_grup === params.groupId);
    }

    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(k => 
            k.nama_lengkap.toLowerCase().includes(lowerTerm) ||
            k.id_karyawan.toLowerCase().includes(lowerTerm)
        );
    }

    return deepClone(data);
};

export const getKaryawanPageData = async () => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return {
        // Note: For initial page load, frontend should ideally call filtered APIs. 
        // This aggregated function might be heavy if not careful.
        // Keeping it compatible but recommending individual fetches in frontend for scalability.
        karyawan: deepClone(db.KARYAWAN_DATA),
        branches: deepClone(db.BRANCHES_DATA),
        roles: deepClone(db.ROLES_DATA),
        users: deepClone(db.USERS_DATA.map(({ password, ...user }) => user)), // Exclude passwords
        grups: deepClone(db.GRUP_DATA),
    };
};

export const createKaryawan = async (karyawanData: Omit<Karyawan, 'id_karyawan' | 'id_user' | 'id_grup'> & { id_grup?: string, create_user_account?: boolean; username?: string; password?: string; id_role?: string }): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    const branch = db.BRANCHES_DATA.find(b => b.id_cabang === karyawanData.id_cabang);
    if (!branch) {
        return { success: false, message: "Cabang yang dipilih tidak valid." };
    }
    const grupId = branch.id_grup;

    let maxIdNum = 0;
    db.KARYAWAN_DATA.forEach(k => {
      const match = k.id_karyawan.match(/^KRY(\d+)$/i);
      if (match && parseInt(match[1]) > maxIdNum) maxIdNum = parseInt(match[1]);
    });
    const newKaryawanId = `KRY${maxIdNum + 1}`;
    
    let newUserId: string | null = null;
    
    if (karyawanData.create_user_account && karyawanData.username && karyawanData.password && karyawanData.id_role) {
        const userCreationResult = await createUser({
            id_user: '', // Akan digenerate
            username: karyawanData.username,
            password: karyawanData.password,
            id_cabang: karyawanData.id_cabang,
            id_role: karyawanData.id_role,
            id_karyawan: newKaryawanId
        });
        if (!userCreationResult.success || !userCreationResult.user) {
            return { success: false, message: userCreationResult.message || "Gagal membuat akun user." };
        }
        newUserId = userCreationResult.user.id_user;
    }
    
    const newKaryawan: Karyawan = {
        id_karyawan: newKaryawanId,
        id_grup: grupId,
        id_user: newUserId,
        nama_lengkap: karyawanData.nama_lengkap,
        id_cabang: karyawanData.id_cabang,
        posisi: karyawanData.posisi,
        departemen: karyawanData.departemen,
        tanggal_masuk: karyawanData.tanggal_masuk,
        status_karyawan: karyawanData.status_karyawan,
        email: karyawanData.email,
        telepon: karyawanData.telepon,
        alamat: karyawanData.alamat,
        tanggal_lahir: karyawanData.tanggal_lahir,
        jenis_kelamin: karyawanData.jenis_kelamin,
        foto_url: karyawanData.foto_url,
        gaji_pokok: karyawanData.gaji_pokok
    };
    
    db.KARYAWAN_DATA.push(newKaryawan);
    
    return { success: true };
};

export const updateKaryawan = async (id_karyawan: string, karyawanData: Karyawan): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.KARYAWAN_DATA.findIndex(k => k.id_karyawan === id_karyawan);
    if (index > -1) {
        const branch = db.BRANCHES_DATA.find(b => b.id_cabang === karyawanData.id_cabang);
        if (!branch) {
            return { success: false, message: "Cabang yang dipilih tidak valid." };
        }
        
        db.KARYAWAN_DATA[index] = { ...db.KARYAWAN_DATA[index], ...karyawanData, id_grup: branch.id_grup };

        // Pastikan cabang di akun user juga terupdate jika berubah
        if (db.KARYAWAN_DATA[index].id_user) {
            const userIndex = db.USERS_DATA.findIndex(u => u.id_user === db.KARYAWAN_DATA[index].id_user);
            if (userIndex > -1) {
                db.USERS_DATA[userIndex].id_cabang = db.KARYAWAN_DATA[index].id_cabang;
            }
        }
        return { success: true };
    }
    return { success: false, message: "Karyawan tidak ditemukan." };
};

export const deleteKaryawan = async (id_karyawan: string): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.KARYAWAN_DATA.findIndex(k => k.id_karyawan === id_karyawan);
    if (index > -1) {
        const karyawanToDelete = db.KARYAWAN_DATA[index];
        // Jika karyawan punya user, hapus user juga
        if (karyawanToDelete.id_user) {
            const userIndex = db.USERS_DATA.findIndex(u => u.id_user === karyawanToDelete.id_user);
            if (userIndex > -1) {
                db.USERS_DATA.splice(userIndex, 1);
            }
        }
        db.KARYAWAN_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: "Karyawan tidak ditemukan." };
};


// --- HRM Settings API ---
export const getHrmSettingsPageData = async () => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return {
        titikAbsensi: deepClone(db.TITIK_ABSENSI_DATA),
        payrollComponents: deepClone(db.PAYROLL_COMPONENTS_DATA),
        branches: deepClone(db.BRANCHES_DATA),
        grups: deepClone(db.GRUP_DATA),
    };
};
export const createTitikAbsensi = async (data: Omit<TitikAbsensi, 'id_titik_absensi'>): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const newItem: TitikAbsensi = { ...data, id_titik_absensi: `TA-${Date.now()}` };
    db.TITIK_ABSENSI_DATA.push(newItem);
    return { success: true };
};
export const updateTitikAbsensi = async (id: string, data: TitikAbsensi): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.TITIK_ABSENSI_DATA.findIndex(t => t.id_titik_absensi === id);
    if (index > -1) {
        db.TITIK_ABSENSI_DATA[index] = data;
        return { success: true };
    }
    return { success: false, message: 'Not found' };
};
export const deleteTitikAbsensi = async (id: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.TITIK_ABSENSI_DATA.findIndex(t => t.id_titik_absensi === id);
    if (index > -1) {
        db.TITIK_ABSENSI_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Not found' };
};
export const createPayrollComponent = async (data: Omit<PayrollComponent, 'id_payroll_component'>): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const newId = `PC${Date.now()}`;
    const newItem: PayrollComponent = { ...data, id_payroll_component: newId };
    db.PAYROLL_COMPONENTS_DATA.push(newItem);
    return { success: true };
};
export const updatePayrollComponent = async (id: string, data: PayrollComponent): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.PAYROLL_COMPONENTS_DATA.findIndex(pc => pc.id_payroll_component === id);
    if (index > -1) {
        db.PAYROLL_COMPONENTS_DATA[index] = data;
        return { success: true };
    }
    return { success: false, message: 'Not found' };
};
export const deletePayrollComponent = async (id: string): Promise<{ success: boolean; message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.PAYROLL_COMPONENTS_DATA.findIndex(pc => pc.id_payroll_component === id);
    if (index > -1) {
        db.PAYROLL_COMPONENTS_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'Not found' };
};

// --- HRM Page APIs ---
export const getAbsensiPageData = async () => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return {
        absensiLogs: deepClone(db.ABSENSI_LOG_DATA),
        karyawan: deepClone(db.KARYAWAN_DATA),
        branches: deepClone(db.BRANCHES_DATA),
        titikAbsensi: deepClone(db.TITIK_ABSENSI_DATA),
        grups: deepClone(db.GRUP_DATA),
    };
};
export const getClockWidgetData = async (karyawanId: string) => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const karyawan = db.KARYAWAN_DATA.find(k => k.id_karyawan === karyawanId);
    if (!karyawan) throw new Error("Karyawan not found");
    const titikAbsensi = db.TITIK_ABSENSI_DATA.filter(t => t.id_cabang === karyawan.id_cabang && t.aktif);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLog = db.ABSENSI_LOG_DATA.find(l => l.id_karyawan === karyawanId && l.waktu_clock_in.startsWith(todayStr));
    return { karyawan: deepClone(karyawan), titikAbsensi: deepClone(titikAbsensi), todayLog: deepClone(todayLog) };
};
export const performClockAction = async (payload: { karyawanId: string; isClockIn: boolean; location: { lat: number, lon: number }; nearestTitik: TitikAbsensi | null; status: 'valid' | 'luar_area' | 'gagal_gps', fotoUrl: string }): Promise<{ success: boolean, log?: AbsensiLog }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY * 2));
    const { karyawanId, isClockIn, location, nearestTitik, status, fotoUrl } = payload;
    const karyawan = db.KARYAWAN_DATA.find(k => k.id_karyawan === karyawanId);
    if (!karyawan) return { success: false };

    if (isClockIn) {
        const newLog: AbsensiLog = {
            id_absensi_log: `ALOG-${Date.now()}`,
            id_karyawan: karyawanId,
            id_grup: karyawan.id_grup,
            id_cabang_karyawan: karyawan.id_cabang,
            waktu_clock_in: new Date().toISOString(),
            latitude_clock_in: location.lat,
            longitude_clock_in: location.lon,
            id_titik_absensi_clock_in: nearestTitik?.id_titik_absensi || null,
            status_clock_in: status,
            foto_clock_in_url: fotoUrl,
            waktu_clock_out: null,
            latitude_clock_out: null,
            longitude_clock_out: null,
            id_titik_absensi_clock_out: null,
            status_clock_out: null,
            foto_clock_out_url: null
        };
        db.ABSENSI_LOG_DATA.push(newLog);
        return { success: true, log: deepClone(newLog) };
    } else {
        const todayStr = new Date().toISOString().split('T')[0];
        const logIndex = db.ABSENSI_LOG_DATA.findIndex(l => l.id_karyawan === karyawanId && l.waktu_clock_in.startsWith(todayStr) && !l.waktu_clock_out);
        if (logIndex > -1) {
            db.ABSENSI_LOG_DATA[logIndex] = {
                ...db.ABSENSI_LOG_DATA[logIndex],
                waktu_clock_out: new Date().toISOString(),
                latitude_clock_out: location.lat,
                longitude_clock_out: location.lon,
                id_titik_absensi_clock_out: nearestTitik?.id_titik_absensi || null,
                status_clock_out: status,
                foto_clock_out_url: fotoUrl
            };
            return { success: true, log: deepClone(db.ABSENSI_LOG_DATA[logIndex]) };
        }
        return { success: false };
    }
};

// --- Payroll API ---
export const getPayrolls = async (): Promise<Payroll[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return deepClone(db.PAYROLL_DATA);
};
export const getPayrollComponents = async (): Promise<PayrollComponent[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return deepClone(db.PAYROLL_COMPONENTS_DATA);
};
export const getAbsensiLogs = async (): Promise<AbsensiLog[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return deepClone(db.ABSENSI_LOG_DATA);
};
export const addPayroll = async (payroll: Payroll): Promise<void> => {
    await new Promise(res => setTimeout(res, 50)); // quicker for batch
    db.PAYROLL_DATA.push(payroll);
};
export const updatePayroll = async (payroll: Payroll): Promise<void> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.PAYROLL_DATA.findIndex(p => p.id_payroll === payroll.id_payroll);
    if (index > -1) {
        db.PAYROLL_DATA[index] = payroll;
    }
};
export const deletePayroll = async (id: string): Promise<void> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    db.PAYROLL_DATA = db.PAYROLL_DATA.filter(p => p.id_payroll !== id);
};
