// FRONTEND: Komponen ini mengelola UI untuk halaman Pengaturan Modul.
// Fungsinya adalah untuk memungkinkan superuser mengaktifkan/menonaktifkan modul seperti BOM dan KDS
// secara global, per grup, atau per cabang dengan performa tinggi.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useModuleActivation } from '../../contexts/ModuleActivationContext';
import { useAccess } from '../../contexts/AccessContext';
import * as api from '../../backend/api';
import { Grup, Branch } from '../../types';
import { SpinnerIcon, BuildingStorefrontIcon, UsersIcon, GlobeAltIcon, WrenchScrewdriverIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon } from '../../components/icons';

const PAGE_PATH = '/settings/module-settings';
const PAGE_SIZE = 5; // Groups per page

const ModuleToggle: React.FC<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => (
    <label className="flex items-center space-x-3 cursor-pointer">
        <div className="relative">
            <input 
                type="checkbox" 
                className="sr-only" 
                checked={checked} 
                onChange={e => onChange(e.target.checked)}
                disabled={disabled}
            />
            <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-sky-500' : 'bg-slate-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-full' : ''}`}></div>
        </div>
        <span className={`text-sm font-medium ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{label}</span>
    </label>
);

const ModuleSettingsPage: React.FC = () => {
    const { canUpdate, isAccessDataLoaded } = useAccess();
    const { updateSettings, isModuleDataLoaded, getSettingsForScope } = useModuleActivation();
    
    // Pagination & Data States
    const [grups, setGrups] = useState<Grup[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalGroups, setTotalGroups] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch Groups with Pagination and Search
    const fetchGroupsData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Paginated Groups
            const grupResult = await api.getGrups({ 
                page: page, 
                pageSize: PAGE_SIZE, 
                search: searchTerm 
            });

            // Handle response flexibility (array vs object) based on API implementation
            let currentGrups: Grup[] = [];
            if (Array.isArray(grupResult)) {
                currentGrups = grupResult;
                setTotalGroups(grupResult.length); // Assume un-paginated if array returned
            } else {
                currentGrups = grupResult.data;
                setTotalGroups(grupResult.total);
            }
            setGrups(currentGrups);

            // 2. Fetch Branches ONLY for these Groups
            if (currentGrups.length > 0) {
                const groupIds = currentGrups.map(g => g.id_grup);
                const branchesData = await api.getBranches({ groupIds });
                setBranches(branchesData);
            } else {
                setBranches([]);
            }
        } catch (error) {
            console.error("Failed to load data for module settings", error);
        } finally {
            setIsLoading(false);
        }
    }, [page, searchTerm]);

    useEffect(() => {
        if (isAccessDataLoaded) {
            fetchGroupsData();
        }
    }, [isAccessDataLoaded, fetchGroupsData]);

    const handleSettingChange = (scope: 'global' | 'group' | 'branch', id: string, module: 'bom' | 'kds', value: boolean) => {
        const currentSettings = getSettingsForScope(scope, id);
        const newSettings = { ...currentSettings, [module]: value };
        updateSettings(scope, id, newSettings);
    };

    const isEditable = canUpdate(PAGE_PATH);
    const totalPages = Math.ceil(totalGroups / PAGE_SIZE);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };
    
    // Debounce search input
    useEffect(() => {
        setPage(1); // Reset to page 1 on search
    }, [searchTerm]);

    if (!isModuleDataLoaded) {
        return (
            <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex justify-center items-center">
                <SpinnerIcon className="w-8 h-8 text-sky-500" />
            </div>
        );
    }

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 pb-4 border-b border-slate-200">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 flex items-center">
                        <WrenchScrewdriverIcon className="w-8 h-8 mr-3 text-sky-600"/> Pengaturan Modul
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl">Aktifkan atau nonaktifkan modul Produksi (BOM) dan Dapur (KDS). Pengaturan cabang akan menimpa pengaturan grup, dan pengaturan grup akan menimpa pengaturan global.</p>
                </div>
            </div>

            <div className="mb-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                 <div className="relative w-full sm:w-1/2 md:w-1/3">
                    <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Cari grup..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="form-input w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 transition duration-150 text-sm"
                    />
                </div>
            </div>
            
            <div className="space-y-8">
                {/* Global Settings */}
                <section>
                    <div className="flex items-center mb-4">
                        <GlobeAltIcon className="w-6 h-6 mr-3 text-slate-500"/>
                        <h2 className="text-xl font-semibold text-slate-700">Pengaturan Global (Default)</h2>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center space-x-8">
                        <ModuleToggle label="Produksi (BOM)" checked={getSettingsForScope('global', '__global__').bom} onChange={v => handleSettingChange('global', '__global__', 'bom', v)} disabled={!isEditable} />
                        <ModuleToggle label="Dapur (KDS)" checked={getSettingsForScope('global', '__global__').kds} onChange={v => handleSettingChange('global', '__global__', 'kds', v)} disabled={!isEditable} />
                    </div>
                </section>

                {/* Group and Branch Settings (Paginated) */}
                <div className="space-y-6">
                    {isLoading ? (
                         <div className="flex justify-center py-10"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>
                    ) : grups.length === 0 ? (
                        <div className="text-center text-slate-500 py-10">
                            <p>Tidak ada grup yang ditemukan.</p>
                        </div>
                    ) : (
                        grups.map(grup => {
                            const branchesForGroup = branches.filter(b => b.id_grup === grup.id_grup);
                            
                            return (
                                <div key={grup.id_grup} className="p-4 rounded-lg border border-slate-200">
                                    <div className="flex items-center mb-3">
                                        <UsersIcon className="w-5 h-5 mr-2 text-slate-400"/>
                                        <h3 className="text-lg font-semibold text-slate-600">{grup.nama_grup}</h3>
                                    </div>
                                    <div className="pl-7 space-y-3">
                                         <div className="bg-slate-100 p-3 rounded-md flex items-center space-x-8">
                                            <ModuleToggle label="BOM (Grup)" checked={getSettingsForScope('group', grup.id_grup).bom} onChange={v => handleSettingChange('group', grup.id_grup, 'bom', v)} disabled={!isEditable}/>
                                            <ModuleToggle label="KDS (Grup)" checked={getSettingsForScope('group', grup.id_grup).kds} onChange={v => handleSettingChange('group', grup.id_grup, 'kds', v)} disabled={!isEditable}/>
                                        </div>
                                        <div className="space-y-2 pt-2">
                                            {branchesForGroup.map(branch => (
                                                <div key={branch.id_cabang} className="flex items-center justify-between p-3 bg-white border rounded-md">
                                                    <div className="flex items-center">
                                                        <BuildingStorefrontIcon className="w-5 h-5 mr-3 text-slate-400"/>
                                                        <p className="text-sm font-medium">{branch.Nama}</p>
                                                    </div>
                                                    <div className="flex items-center space-x-8">
                                                        <ModuleToggle label="BOM" checked={getSettingsForScope('branch', branch.id_cabang).bom} onChange={v => handleSettingChange('branch', branch.id_cabang, 'bom', v)} disabled={!isEditable}/>
                                                        <ModuleToggle label="KDS" checked={getSettingsForScope('branch', branch.id_cabang).kds} onChange={v => handleSettingChange('branch', branch.id_cabang, 'kds', v)} disabled={!isEditable}/>
                                                    </div>
                                                </div>
                                            ))}
                                            {branchesForGroup.length === 0 && (
                                                <p className="text-xs text-slate-400 italic">Belum ada cabang di grup ini.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-4 mt-6">
                        <button
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page === 1 || isLoading}
                            className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        <span className="text-sm text-slate-600">
                            Halaman <span className="font-semibold">{page}</span> dari <span className="font-semibold">{totalPages}</span>
                        </span>
                        <button
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page === totalPages || isLoading}
                            className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModuleSettingsPage;