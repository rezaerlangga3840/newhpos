import { db, SIMULATED_DELAY } from './database';
import { User, Karyawan } from '../types';
import { deepClone } from '../utils';

// --- API OTENTIKASI & USER ---
export const authenticateUser = async (username: string, password: string): Promise<{ success: boolean; user?: Omit<User, 'password'>; message?: string }> => {
    await new Promise(res => setTimeout(res, 500));
    const user = db.USERS_DATA.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user && user.password === password) {
        const { password: _, ...userWithoutPassword } = user;
        return { success: true, user: userWithoutPassword };
    }
    return { success: false, message: 'Username atau password salah.' };
};

interface GetUsersParams {
    branchId?: string | null;
    groupId?: string | null;
    search?: string;
}

// OPTIMIZED: Server-side filtering untuk Users
export const getUsers = async (params?: GetUsersParams): Promise<User[]> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.USERS_DATA.map(({ password, ...user }) => user);

    // Filter by Scope
    if (params?.branchId) {
        // Show users specific to this branch
        data = data.filter(u => u.id_cabang === params.branchId);
    } else if (params?.groupId) {
        // Show users in this group (linked via branch or role logic if complex, simplified here)
        // Find branches in this group first
        const branchesInGroup = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
        
        data = data.filter(u => {
            // Include users linked to branches in this group
            if (u.id_cabang && branchesInGroup.includes(u.id_cabang)) return true;
            // Include users who might be group-level admins (if logic allows id_cabang to be null but implied group)
            // For now, based on schema, users are linked to branches directly or null (system).
            return false;
        });
    }

    // Filter by Search
    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(u => 
            u.username.toLowerCase().includes(lowerTerm) ||
            u.id_user.toLowerCase().includes(lowerTerm)
        );
    }

    return deepClone(data);
};

export const createUser = async (userData: User): Promise<{ success: boolean, message?: string, user?: User }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    if (db.USERS_DATA.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
        return { success: false, message: `Username "${userData.username}" sudah digunakan.` };
    }
    if (userData.id_karyawan && db.USERS_DATA.some(u => u.id_karyawan === userData.id_karyawan)) {
        return { success: false, message: `Karyawan sudah terhubung dengan user lain.` };
    }

    let maxIdNum = 0;
    db.USERS_DATA.forEach(u => {
      const match = u.id_user.match(/^US(\d+)$/i);
      if (match && parseInt(match[1]) > maxIdNum) maxIdNum = parseInt(match[1]);
    });
    const newId = `US${maxIdNum + 1}`;
    const newUser: User = { ...userData, id_user: newId };
    db.USERS_DATA.push(newUser);
    if (newUser.id_karyawan) {
        const karyawanIndex = db.KARYAWAN_DATA.findIndex(k => k.id_karyawan === newUser.id_karyawan);
        if (karyawanIndex > -1) {
            db.KARYAWAN_DATA[karyawanIndex].id_user = newId;
        }
    }
    const { password, ...userWithoutPassword } = newUser;
    return { success: true, user: userWithoutPassword };
};

export const updateUser = async (id_user: string, userData: Partial<User>): Promise<{ success: boolean, message?: string, user?: User }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.USERS_DATA.findIndex(u => u.id_user === id_user);
    if (index === -1) {
        return { success: false, message: 'User tidak ditemukan.' };
    }

    const existingUser = db.USERS_DATA[index];
    if (userData.username && userData.username !== existingUser.username && db.USERS_DATA.some(u => u.id_user !== id_user && u.username.toLowerCase() === userData.username!.toLowerCase())) {
        return { success: false, message: `Username "${userData.username}" sudah digunakan.` };
    }
    if (userData.id_karyawan && userData.id_karyawan !== existingUser.id_karyawan && db.USERS_DATA.some(u => u.id_karyawan === userData.id_karyawan)) {
         return { success: false, message: `Karyawan sudah terhubung dengan user lain.` };
    }

    const oldKaryawanId = existingUser.id_karyawan;
    const newKaryawanId = userData.id_karyawan;

    const updatedUser = { ...existingUser, ...userData };
    if (!userData.password) {
        updatedUser.password = existingUser.password;
    }
    db.USERS_DATA[index] = updatedUser;
    
    // Update link karyawan
    if (oldKaryawanId !== newKaryawanId) {
        if (oldKaryawanId) {
            const oldKaryawanIndex = db.KARYAWAN_DATA.findIndex(k => k.id_karyawan === oldKaryawanId);
            if (oldKaryawanIndex > -1) db.KARYAWAN_DATA[oldKaryawanIndex].id_user = null;
        }
        if (newKaryawanId) {
            const newKaryawanIndex = db.KARYAWAN_DATA.findIndex(k => k.id_karyawan === newKaryawanId);
            if (newKaryawanIndex > -1) db.KARYAWAN_DATA[newKaryawanIndex].id_user = id_user;
        }
    }
    const { password, ...userWithoutPassword } = updatedUser;
    return { success: true, user: userWithoutPassword };
};

export const deleteUser = async (id_user: string): Promise<{ success: boolean, message?: string }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.USERS_DATA.findIndex(u => u.id_user === id_user);
    if (index > -1) {
        const userToDelete = db.USERS_DATA[index];
        if (userToDelete.id_karyawan) {
             const karyawanIndex = db.KARYAWAN_DATA.findIndex(k => k.id_karyawan === userToDelete.id_karyawan);
             if (karyawanIndex > -1) db.KARYAWAN_DATA[karyawanIndex].id_user = null;
        }
        db.USERS_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false, message: 'User tidak ditemukan.' };
};

// --- PROFIL USER ---
export const getProfilePageData = async (userId: string) => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const user = db.USERS_DATA.find(u => u.id_user === userId);
    if (!user) throw new Error("User not found");
    
    const karyawan = user.id_karyawan ? db.KARYAWAN_DATA.find(k => k.id_karyawan === user.id_karyawan) : null;
    const { password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, karyawan: deepClone(karyawan) };
};

export const updateKaryawanProfile = async (karyawanId: string, profileData: Partial<Karyawan>) => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.KARYAWAN_DATA.findIndex(k => k.id_karyawan === karyawanId);
    if (index > -1) {
        db.KARYAWAN_DATA[index] = { ...db.KARYAWAN_DATA[index], ...profileData };
        return { success: true };
    }
    return { success: false, message: "Data karyawan tidak ditemukan." };
};

export const updateUserAccount = async (payload: { userId: string, username: string, currentPassword: string, newPassword?: string }) => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.USERS_DATA.findIndex(u => u.id_user === payload.userId);
    if (index === -1) return { success: false, message: "User tidak ditemukan." };
    
    const user = db.USERS_DATA[index];
    if (user.password !== payload.currentPassword) {
        return { success: false, message: "Password saat ini salah." };
    }
    
    if (payload.username !== user.username && db.USERS_DATA.some(u => u.id_user !== payload.userId && u.username.toLowerCase() === payload.username.toLowerCase())) {
        return { success: false, message: `Username "${payload.username}" sudah digunakan.` };
    }

    user.username = payload.username;
    if (payload.newPassword) {
        user.password = payload.newPassword;
    }
    
    db.USERS_DATA[index] = user;
    return { success: true, message: "Akun berhasil diperbarui. Silakan login kembali jika Anda mengubah password." };
};
