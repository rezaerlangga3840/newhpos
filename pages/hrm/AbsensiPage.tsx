// FRONTEND: Komponen ini menampilkan halaman log (riwayat) kehadiran karyawan.
// Fungsinya adalah untuk mengambil dan memfilter data absensi berdasarkan tanggal dan cabang,
// lalu menampilkannya dalam format tabel untuk keperluan monitoring.

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { AbsensiLog, Karyawan, Branch, TitikAbsensi, Grup } from '../../types';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { CalendarDaysIcon, SpinnerIcon, CameraIcon, XMarkIcon } from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';


const PAGE_PATH = '/hrm/absensi'; // Path for permission checks (view log, edit log, etc.)

// FIX: Changed to a named export to resolve import error in App.tsx.
export const AbsensiPage: React.FC = () => {
  const { selectedBranchId, selectedGroupId, userRoleType, selectableBranches } = useBranch();
  const { currentUser } = useAuth();
  const { canRead, isAccessDataLoaded } = useAccess();

  const [logs, setLogs] = useState<AbsensiLog[]>([]);
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [titikAbsensiList, setTitikAbsensiList] = useState<TitikAbsensi[]>([]);
  const [grups, setGrups] = useState<Grup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const data = await api.getAbsensiPageData();
        setLogs(data.absensiLogs);
        setKaryawanList(data.karyawan);
        setBranches(data.branches);
        setTitikAbsensiList(data.titikAbsensi);
        setGrups(data.grups);
    } catch (error) {
        console.error("Failed to load absensi data:", error);
        alert("Gagal memuat data absensi.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAccessDataLoaded) {
        fetchData();
    }
  }, [isAccessDataLoaded, fetchData]);


  const karyawanMap = useMemo(() => karyawanList.reduce((map, k) => { map[k.id_karyawan] = k.nama_lengkap; return map; }, {} as Record<string, string>), [karyawanList]);
  const branchMap = useMemo(() => branches.reduce((map, b) => { map[b.id_cabang] = b.Nama; return map; }, {} as Record<string, string>), [branches]);
  const titikAbsensiMap = useMemo(() => titikAbsensiList.reduce((map, t) => { map[t.id_titik_absensi] = t.nama_titik; return map; }, {} as Record<string, string>), [titikAbsensiList]);
  const grupMap = useMemo(() => grups.reduce((map, g) => { map[g.id_grup] = g.nama_grup; return map; }, {} as Record<string, string>), [grups]);

  const displayedLogs = useMemo(() => {
    let filtered = [...logs];

    // Filter by global branch selection or user's branch context
    if (selectedBranchId) {
      filtered = filtered.filter(log => log.id_cabang_karyawan === selectedBranchId);
    } else if (selectedGroupId) {
      filtered = filtered.filter(log => log.id_grup === selectedGroupId);
    } else if (userRoleType !== 'superuser' && currentUser?.id_karyawan) {
      const userKaryawan = karyawanList.find(k => k.id_karyawan === currentUser!.id_karyawan);
      if (userKaryawan) {
        if (userRoleType === 'administrator') { // Admin sees all logs in their branch's group
            const adminBranch = branches.find(b => b.id_cabang === userKaryawan.id_cabang);
            if (adminBranch?.id_grup) {
                const branchesInGroup = branches.filter(b => b.id_grup === adminBranch.id_grup).map(b => b.id_cabang);
                filtered = filtered.filter(log => branchesInGroup.includes(log.id_cabang_karyawan));
            } else {
                filtered = []; // Should not happen if admin is tied to a branch
            }
        } else { // 'other' user sees only their own branch's logs
            filtered = filtered.filter(log => log.id_cabang_karyawan === userKaryawan.id_cabang);
        }
      } else {
        filtered = []; // No karyawan data for current user
      }
    }
    
    // Filter by date
    if (filterDate) {
      filtered = filtered.filter(log => log.waktu_clock_in.startsWith(filterDate));
    }

    return filtered.sort((a, b) => new Date(b.waktu_clock_in).getTime() - new Date(a.waktu_clock_in).getTime());
  }, [logs, selectedBranchId, selectedGroupId, userRoleType, currentUser, filterDate, karyawanList, branches]);
  
  const columns = useMemo<ColumnDef<AbsensiLog>[]>(() => [
    { header: 'Grup', accessor: (log) => grupMap[log.id_grup] || log.id_grup, sortable: true },
    { header: 'Cabang', accessor: (log) => branchMap[log.id_cabang_karyawan] || log.id_cabang_karyawan, sortable: true },
    { header: 'Karyawan', accessor: (log) => karyawanMap[log.id_karyawan] || log.id_karyawan, sortable: true },
    { 
      header: 'Clock In', 
      accessor: 'waktu_clock_in', 
      sortable: true,
      render: (log) => (
        <div>
          <p>{new Date(log.waktu_clock_in).toLocaleTimeString('id-ID')}</p>
          <p className="text-xs text-slate-500">{titikAbsensiMap[log.id_titik_absensi_clock_in!] || 'Luar Titik'}</p>
        </div>
      )
    },
    { 
      header: 'Foto In',
      accessor: 'foto_clock_in_url',
      sortable: false,
      render: (log) => log.foto_clock_in_url ? (
          <button onClick={() => setImagePreviewUrl(log.foto_clock_in_url)} className="text-sky-600 hover:text-sky-800 p-1"><CameraIcon className="w-5 h-5"/></button>
      ) : <span className="text-slate-400">-</span>
    },
     { 
      header: 'Clock Out', 
      accessor: 'waktu_clock_out', 
      sortable: true,
      render: (log) => log.waktu_clock_out ? (
        <div>
          <p>{new Date(log.waktu_clock_out).toLocaleTimeString('id-ID')}</p>
          <p className="text-xs text-slate-500">{titikAbsensiMap[log.id_titik_absensi_clock_out!] || 'Luar Titik'}</p>
        </div>
      ) : <span className="text-slate-400">-</span>
    },
    { 
      header: 'Foto Out',
      accessor: 'foto_clock_out_url',
      sortable: false,
      render: (log) => log.foto_clock_out_url ? (
          <button onClick={() => setImagePreviewUrl(log.foto_clock_out_url)} className="text-sky-600 hover:text-sky-800 p-1"><CameraIcon className="w-5 h-5"/></button>
      ) : <span className="text-slate-400">-</span>
    },
  ], [grupMap, branchMap, karyawanMap, titikAbsensiMap]);

  if (isLoading || !isAccessDataLoaded) {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex justify-center items-center">
        <SpinnerIcon className="w-8 h-8 text-sky-500"/>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
      <TabelFiturStandar
        data={displayedLogs}
        columns={columns}
        uniqueIdKey="id_absensi_log"
        title="Log Kehadiran"
        headerActions={
          <div className="flex items-center space-x-2">
            <label htmlFor="filter-date" className="text-sm font-medium text-slate-700">Tanggal:</label>
            <input 
              type="date" 
              id="filter-date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="form-input py-2 pl-3 pr-2 border-slate-300 rounded-md shadow-sm text-sm"
            />
          </div>
        }
      />
      {imagePreviewUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setImagePreviewUrl(null)}>
          <div className="bg-white rounded-lg p-4 relative" onClick={e => e.stopPropagation()}>
            <img src={imagePreviewUrl} alt="Preview Absensi" className="max-w-full max-h-[80vh] rounded-md"/>
            <button onClick={() => setImagePreviewUrl(null)} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full"><XMarkIcon className="w-6 h-6"/></button>
          </div>
        </div>
      )}
    </div>
  );
};
