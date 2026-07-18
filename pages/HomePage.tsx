// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Home/Beranda.
// Fungsinya adalah untuk memberikan ringkasan informasi penting kepada pengguna setelah login,
// seperti notifikasi, tugas harian, dan ringkasan kinerja pribadi.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ClockInOutWidget from '../components/ClockInOutWidget';
import { 
    ExclamationTriangleIcon, 
    PlusCircleIcon,
    CurrencyDollarIcon,
    ShoppingCartIcon,
    DocumentCheckIcon,
    InformationCircleIcon,
    BellIcon,
    TrophyIcon,
    CalendarDaysIcon,
    ArrowTrendingDownIcon,
    SpinnerIcon
} from '../components/icons';
import { useBranch } from '../contexts/BranchContext';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../backend/api';
import { DayOfWeek } from '../types';

interface ActionItem {
    id: number | string;
    text: string;
    path: string;
    type: 'warning' | 'info' | 'critical' | 'trend-down';
    date: string; // Added for sorting
}

// Memoized Stat Card to prevent re-renders on parent updates if props are same
const StatCard = React.memo(({ title, value, icon: Icon, colorClass, link }: { title: string, value: string, icon: React.ElementType, colorClass: string, link: string }) => (
    <Link to={link} className={`flex flex-col items-center justify-center p-4 bg-${colorClass}-50 hover:bg-${colorClass}-100 rounded-xl transition-colors`}>
        <Icon className={`w-8 h-8 text-${colorClass}-500 mb-2`}/>
        <span className={`text-sm font-medium text-${colorClass}-700`}>{title}</span>
    </Link>
));

const HomePage: React.FC = () => {
    const { currentUser } = useAuth();
    const { selectedBranchId, selectableBranches } = useBranch();
    const [homeData, setHomeData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const branchIdsInScope = selectableBranches.map(b => b.id_cabang);
            const data = await api.getHomePageData({
                userId: currentUser.id_user,
                karyawanId: currentUser.id_karyawan || null,
                branchId: selectedBranchId,
                branchIdsInScope: branchIdsInScope
            });
            setHomeData(data);
        } catch (error) {
            console.error("Failed to load home page data:", error);
            // Optionally set an error state to show in the UI
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, selectedBranchId, selectableBranches]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const todayStr = new Date().toISOString().split('T')[0];
    const completionStorageKey = `hpos_task_completion_${todayStr}`;
    const [completedTasks, setCompletedTasks] = useState(() => {
        try {
            const stored = localStorage.getItem(completionStorageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            return {};
        }
    });

    useEffect(() => {
        localStorage.setItem(completionStorageKey, JSON.stringify(completedTasks));
    }, [completedTasks, completionStorageKey]);
    
    const toggleTask = useCallback((taskId: string) => {
        setCompletedTasks((prev: any) => {
            const newCompleted = {...prev};
            if (newCompleted[taskId]) delete newCompleted[taskId];
            else newCompleted[taskId] = true;
            return newCompleted;
        });
    }, []);

    const userDisplayName = useMemo(() => {
        if (!currentUser) return 'Pengguna';
        return homeData?.karyawan?.nama_lengkap || currentUser.username;
    }, [currentUser, homeData?.karyawan?.nama_lengkap]);

    const finalTasksForDisplay = useMemo(() => {
        if (!homeData?.tasks) return [];
        return homeData.tasks.map((task: any) => ({ ...task, completed: !!completedTasks[task.id_task] }));
    }, [homeData?.tasks, completedTasks]);

    const criticalStockItems = useMemo(() => {
        if (!homeData?.criticalStock?.stocks) return [];
        return homeData.criticalStock.stocks; 
    }, [homeData?.criticalStock?.stocks]);

    const performanceData = useMemo(() => homeData?.performance, [homeData?.performance]);
    const attendanceData = useMemo(() => homeData?.attendance, [homeData?.attendance]);
    const notificationsData = useMemo(() => homeData?.notifications, [homeData?.notifications]);

    const iconMap = useMemo(() => ({ 'warning': ExclamationTriangleIcon, 'info': InformationCircleIcon, 'critical': ExclamationTriangleIcon, 'trend-down': ArrowTrendingDownIcon }), []);
    const colorMap = useMemo(() => ({ 'warning': 'text-amber-500', 'info': 'text-sky-500', 'critical': 'text-red-500', 'trend-down': 'text-orange-500' }), []);

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex justify-center items-center h-full">
                <SpinnerIcon className="w-10 h-10 text-sky-500" />
            </div>
        );
    }
    
    if (!homeData) {
        return <div className="p-8">Gagal memuat data. Silakan coba lagi.</div>;
    }
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-100 min-h-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Selamat Datang, {userDisplayName}!</h1>
                <p className="text-slate-500">Ini adalah pusat kendali operasional harian Anda.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                            <StatCard title="Mulai POS" value="" icon={ShoppingCartIcon} colorClass="sky" link="/penjualan/pos" />
                            <StatCard title="Stok Opname" value="" icon={DocumentCheckIcon} colorClass="amber" link="/stock-opname" />
                            <StatCard title="Transaksi" value="" icon={CurrencyDollarIcon} colorClass="emerald" link="/penjualan/transaksi" />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                         <h3 className="text-lg font-semibold text-slate-800 mb-4">Tugas Hari Ini</h3>
                         <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                            {finalTasksForDisplay.length > 0 ? (
                                finalTasksForDisplay.map((task: any) => (
                                    <div key={task.id_task} className="flex items-center bg-slate-50 p-3 rounded-lg">
                                        <input type="checkbox" id={`task-${task.id_task}`} checked={task.completed} onChange={() => toggleTask(task.id_task)} className="h-5 w-5 text-sky-600 border-slate-300 rounded-md focus:ring-sky-500 cursor-pointer"/>
                                        <label htmlFor={`task-${task.id_task}`} className={`ml-3 flex-grow text-sm text-slate-700 cursor-pointer ${task.completed ? 'line-through text-slate-400' : ''}`}>{task.nama_task}</label>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-sm text-slate-500 py-4">Tidak ada tugas terjadwal untuk hari ini.</p>
                            )}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><BellIcon className="w-6 h-6 mr-2 text-purple-500" />Pusat Aksi & Notifikasi</h3>
                        {notificationsData && notificationsData.notifications.length > 0 ? (
                            <ul className="space-y-2">
                                {notificationsData.notifications.map((item: ActionItem) => {
                                    const Icon = iconMap[item.type];
                                    const color = colorMap[item.type];
                                    return (
                                        <li key={item.id}>
                                            <Link to={item.path} className="flex items-start p-3 rounded-lg hover:bg-slate-100 transition-colors">
                                                <Icon className={`w-5 h-5 ${color} mr-3 mt-0.5 flex-shrink-0`}/>
                                                <span className="text-sm text-slate-600">{item.text}</span>
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (<p className="text-slate-500 text-sm text-center py-4">Tidak ada aksi yang memerlukan perhatian Anda.</p>)}
                        {notificationsData && notificationsData.totalCount > 15 && (
                            <div className="mt-4 text-center border-t border-slate-100 pt-3">
                                <Link to="/notifications" className="text-sm font-medium text-sky-600 hover:text-sky-800 hover:underline">
                                    Lihat Semua Notifikasi ({notificationsData.totalCount})
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
                <div className="lg:col-span-1 space-y-6">
                    {criticalStockItems.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-lg">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><ExclamationTriangleIcon className="w-6 h-6 mr-2 text-red-500"/> Stok Kritis</h3>
                            <ul className="space-y-3">
                                {criticalStockItems.map((item: any) => (
                                    <li key={item.id_stok || item.id_variant_material} className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-slate-700 truncate pr-2">{item.nama_stok || `${item.id_stok} - ${item.nama_variant}`}</span>
                                        <span className="font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">{item.quantity}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <ClockInOutWidget />
                    {attendanceData && (
                         <div className="bg-white p-6 rounded-2xl shadow-lg">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><CalendarDaysIcon className="w-6 h-6 mr-2 text-indigo-500"/> Info Kehadiran Bulan Ini</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center"><span className="text-sm text-slate-500">Total Kehadiran</span><span className="text-sm font-semibold text-slate-700">{attendanceData.attendanceCount} hari</span></div>
                                <div className="flex justify-between items-center"><span className="text-sm text-slate-500">Total Keterlambatan</span><span className={`text-sm font-semibold ${attendanceData.lateCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>{attendanceData.lateCount} hari</span></div>
                                <div className="flex justify-between items-center"><span className="text-sm text-slate-500">Sisa Cuti</span><span className="text-sm font-semibold text-slate-700">{attendanceData.leaveBalance} hari</span></div>
                            </div>
                        </div>
                    )}
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><TrophyIcon className="w-6 h-6 mr-2 text-amber-500"/> Kinerja Saya Hari Ini</h3>
                        {performanceData ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center"><span className="text-sm text-slate-500">Total Penjualan</span><span className="text-sm font-semibold text-slate-700">Rp {performanceData.totalSales.toLocaleString('id-ID')}</span></div>
                                <div className="flex justify-between items-center"><span className="text-sm text-slate-500">Jumlah Transaksi</span><span className="text-sm font-semibold text-slate-700">{performanceData.transactionCount}</span></div>
                            </div>
                        ) : (<p className="text-slate-500 text-sm">Data kinerja tidak tersedia.</p>)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;