import { db, SIMULATED_DELAY } from './database';
import { ScheduledTask, ModuleActivationSettings } from '../types';
import { deepClone } from '../utils';

// --- Settings API ---

interface GetTasksParams {
    branchId?: string | null;
    groupId?: string | null;
    search?: string;
    page?: number;
    pageSize?: number;
}

export const getScheduledTasks = async (params?: GetTasksParams): Promise<{ data: ScheduledTask[], total: number }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    
    let data = db.SCHEDULED_TASKS_DATA;

    // Filter by Scope (Branch/Group)
    if (params?.branchId) {
        // Show tasks specific to branch OR global tasks (id_cabang === null)
        // Adjust logic based on requirement. Usually settings are strictly scoped or inherited.
        // Assuming strict filtering for management table:
        data = data.filter(t => t.id_cabang === params.branchId);
    } else if (params?.groupId) {
        // Find branches in this group to filter tasks linked to those branches
        const branchesInGroup = db.BRANCHES_DATA.filter(b => b.id_grup === params.groupId).map(b => b.id_cabang);
        data = data.filter(t => 
            (t.id_cabang && branchesInGroup.includes(t.id_cabang)) || 
            (t.id_cabang === null) // Include global tasks if viewing by group context
        );
    }

    // Filter by Search
    if (params?.search) {
        const lowerTerm = params.search.toLowerCase();
        data = data.filter(t => 
            t.nama_task.toLowerCase().includes(lowerTerm)
        );
    }

    const total = data.length;

    // Pagination
    if (params?.page && params?.pageSize) {
        const start = (params.page - 1) * params.pageSize;
        const end = start + params.pageSize;
        data = data.slice(start, end);
    }

    return { data: deepClone(data), total };
};

export const createScheduledTask = async (task: Omit<ScheduledTask, 'id_task'>): Promise<ScheduledTask> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const newTask: ScheduledTask = { ...task, id_task: `TSK${Date.now()}`};
    db.SCHEDULED_TASKS_DATA.push(newTask);
    return deepClone(newTask);
};

export const updateScheduledTask = async (id: string, task: ScheduledTask): Promise<ScheduledTask> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.SCHEDULED_TASKS_DATA.findIndex(t => t.id_task === id);
    if(index > -1) {
        db.SCHEDULED_TASKS_DATA[index] = task;
        return deepClone(task);
    }
    throw new Error("Task not found");
};

export const deleteScheduledTask = async (id: string): Promise<{ success: boolean }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const index = db.SCHEDULED_TASKS_DATA.findIndex(t => t.id_task === id);
    if (index > -1) {
        db.SCHEDULED_TASKS_DATA.splice(index, 1);
        return { success: true };
    }
    return { success: false };
};

// --- API PENGATURAN MODUL ---
export const getModuleActivationSettings = async (): Promise<Record<string, ModuleActivationSettings>> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    return deepClone(db.MODULE_ACTIVATION_SETTINGS_DATA);
};

export const updateModuleActivationSettings = async (scope: 'global' | 'group' | 'branch', id: string, newSettings: ModuleActivationSettings): Promise<{ success: boolean }> => {
    await new Promise(res => setTimeout(res, SIMULATED_DELAY));
    const key = scope === 'global' ? '__global__' : id;
    db.MODULE_ACTIVATION_SETTINGS_DATA[key] = newSettings;
    return { success: true };
};