import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ScheduledTask, Branch, DayOfWeek } from '../../types';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { 
  BellIcon, 
  PlusCircleIcon, 
  PencilSquareIcon, 
  TrashIcon, 
  XMarkIcon,
  ChevronDownIcon,
  SpinnerIcon,
  MagnifyingGlassIcon
} from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

const PAGE_PATH = '/settings/task-settings';

const TaskSettingsPage: React.FC = () => {
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
  const { selectedBranchId, selectedGroupId, selectableBranches } = useBranch();
  
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentTask, setCurrentTask] = useState<ScheduledTask | null>(null);

  const defaultFormData: Omit<ScheduledTask, 'id_task'> = {
    id_cabang: null,
    nama_task: '',
    tipe_ulangi: 'harian',
    tanggal_sekali: new Date().toISOString().split('T')[0],
    hari_mingguan: [],
    aktif: true,
  };
  const [formData, setFormData] = useState<Omit<ScheduledTask, 'id_task'>>(deepClone(defaultFormData));
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<ScheduledTask | null>(null);

  const daysOfWeek: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  
  // 1. Fetch References (Branches) - Only when Group Context changes
  useEffect(() => {
    if (!isAccessDataLoaded) return;
    const fetchReferences = async () => {
        try {
            const branchesData = await api.getBranches({ groupId: selectedGroupId });
            setBranches(branchesData);
        } catch (error) {
            console.error("Failed to load branches ref:", error);
        }
    };
    fetchReferences();
  }, [isAccessDataLoaded, selectedGroupId]);

  // 2. Fetch Tasks (Main Data) - When Filter/Page changes
  const fetchTasks = useCallback(async () => {
      setIsLoading(true);
      try {
          const tasksResult = await api.getScheduledTasks({
              branchId: selectedBranchId,
              groupId: selectedGroupId,
              search: searchTerm,
              page,
              pageSize
          });
          setTasks(tasksResult.data);
          setTotalTasks(tasksResult.total);
      } catch (error) {
          console.error("Failed to load task settings data", error);
          alert("Gagal memuat data tugas.");
      } finally {
          setIsLoading(false);
      }
  }, [selectedBranchId, selectedGroupId, searchTerm, page, pageSize]);

  // Debounce search/filter
  useEffect(() => {
    if (isAccessDataLoaded) {
        const timer = setTimeout(() => {
            fetchTasks();
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [isAccessDataLoaded, fetchTasks]);

  const branchMap = useMemo(() => branches.reduce((map, b) => { map[b.id_cabang] = b.Nama; return map; }, {} as Record<string, string>), [branches]);
  
  const handleOpenModal = (mode: 'add' | 'edit', task?: ScheduledTask) => {
    if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
    setModalMode(mode);
    if (mode === 'edit' && task) {
      setCurrentTask(task);
      setFormData({
        ...task,
        tanggal_sekali: task.tanggal_sekali ? task.tanggal_sekali.split('T')[0] : defaultFormData.tanggal_sekali,
      });
    } else {
      setCurrentTask(null);
      setFormData({ ...deepClone(defaultFormData), id_cabang: selectedBranchId || null });
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentTask(null);
    setFormData(deepClone(defaultFormData));
  }, [defaultFormData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => {
        let newState = { ...prev };
        if (type === 'checkbox') (newState as any)[name] = checked;
        else (newState as any)[name] = value === '__SEMUA__' ? null : value;
        if (name === 'tipe_ulangi') {
            if (value !== 'sekali') newState.tanggal_sekali = null;
            if (value !== 'mingguan') newState.hari_mingguan = [];
        }
        return newState;
    });
  };

  const handleDayToggle = (day: DayOfWeek) => {
    setFormData(prev => ({ ...prev, hari_mingguan: prev.hari_mingguan.includes(day) ? prev.hari_mingguan.filter(d => d !== day) : [...prev.hari_mingguan, day] }));
  };

  const handleActiveToggle = async (task: ScheduledTask) => {
    if (!canUpdate(PAGE_PATH)) { alert("Akses ditolak."); return; }
    const updatedTask = { ...task, aktif: !task.aktif };
    await api.updateScheduledTask(task.id_task, updatedTask);
    fetchTasks(); // Refresh data
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_task.trim()) { alert("Nama Tugas wajib diisi."); return; }

    if (modalMode === 'add') {
      await api.createScheduledTask(formData);
    } else if(currentTask) {
      await api.updateScheduledTask(currentTask.id_task, { ...formData, id_task: currentTask.id_task });
    }
    await fetchTasks(); // Refresh data
    handleCloseModal();
  };

  const handleDeleteClick = (task: ScheduledTask) => {
    if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
    setTaskToDelete(task);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (taskToDelete) {
      await api.deleteScheduledTask(taskToDelete.id_task);
      await fetchTasks(); // Refresh data
    }
    setIsDeleteConfirmOpen(false);
    setTaskToDelete(null);
  };
  const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setTaskToDelete(null); }, []);
  
  const formatRepeatText = (task: ScheduledTask): string => {
    switch (task.tipe_ulangi) {
        case 'sekali': return `Sekali: ${new Date(task.tanggal_sekali!).toLocaleDateString('id-ID', {day: 'numeric', month: 'long'})}`;
        case 'harian': return 'Setiap Hari';
        case 'mingguan': return task.hari_mingguan.length > 0 ? `Setiap ${task.hari_mingguan.join(', ')}` : 'Mingguan';
        default: return '-';
    }
  };

  const columns = useMemo<ColumnDef<ScheduledTask>[]>(() => [
      { header: 'Nama Tugas', accessor: 'nama_task', sortable: true },
      { header: 'Cabang', accessor: (task) => task.id_cabang ? branchMap[task.id_cabang] || task.id_cabang : 'Semua Cabang', sortable: true },
      { header: 'Frekuensi', accessor: 'tipe_ulangi', sortable: true, render: (task) => formatRepeatText(task) },
      { 
          header: 'Status', 
          accessor: 'aktif', 
          sortable: true,
          render: (task) => (
             <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={task.aktif} onChange={() => handleActiveToggle(task)} disabled={!canUpdate(PAGE_PATH)} />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          )
      }
  ], [branchMap, canUpdate]);

  const renderActions = useCallback((task: ScheduledTask) => (
    <div className="space-x-2">
        <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', task); }} className={`p-1 text-sky-600 hover:text-sky-800 disabled:opacity-50`} disabled={!canUpdate(PAGE_PATH)} title="Edit"><PencilSquareIcon className="w-5 h-5"/></button>
        <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(task); }} className={`p-1 text-red-600 hover:text-red-800 disabled:opacity-50`} disabled={!canDelete(PAGE_PATH)} title="Hapus"><TrashIcon className="w-5 h-5"/></button>
    </div>
  ), [canUpdate, canDelete]);

  const headerActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari tugas..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        {canInsert(PAGE_PATH) && (
            <button onClick={() => handleOpenModal('add')} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm text-sm flex items-center">
                <PlusCircleIcon className="w-5 h-5 mr-2"/>Tambah Tugas
            </button>
        )}
    </div>
  ), [searchTerm, canInsert]);

  if (isLoading && page === 1 && tasks.length === 0) {
    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex justify-center items-center">
            <SpinnerIcon className="w-8 h-8 text-sky-500" />
        </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
        <TabelFiturStandar
            data={tasks}
            columns={columns}
            uniqueIdKey="id_task"
            title="Pengaturan Tugas"
            headerActions={headerActions}
            renderActions={renderActions}
            manualPagination={true}
            totalItems={totalTasks}
            onManualPageChange={setPage}
            onManualPageSizeChange={setPageSize}
            hideSearch={true}
        />

        {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b"><h3 className="text-xl font-semibold">{modalMode === 'add' ? 'Tambah Tugas' : 'Edit Tugas'}</h3><button onClick={handleCloseModal}><XMarkIcon className="w-6 h-6"/></button></div>
                    <form onSubmit={handleSubmit} className="space-y-4 flex-grow overflow-y-auto pr-2 text-sm">
                        <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Nama Tugas*</legend><input type="text" name="nama_task" value={formData.nama_task} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent placeholder-slate-400"/></fieldset></div>
                        <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Cabang Target</legend><select name="id_cabang" value={formData.id_cabang || '__SEMUA__'} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="__SEMUA__">Semua Cabang</option>{selectableBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                        <fieldset className="border p-3 rounded-md space-y-2"><legend className="text-xs px-1">Pengulangan</legend>
                            <div className="flex justify-around">
                                <label className="flex items-center space-x-2"><input type="radio" name="tipe_ulangi" value="sekali" checked={formData.tipe_ulangi === 'sekali'} onChange={handleInputChange} className="form-radio"/><span>Sekali</span></label>
                                <label className="flex items-center space-x-2"><input type="radio" name="tipe_ulangi" value="harian" checked={formData.tipe_ulangi === 'harian'} onChange={handleInputChange} className="form-radio"/><span>Setiap Hari</span></label>
                                <label className="flex items-center space-x-2"><input type="radio" name="tipe_ulangi" value="mingguan" checked={formData.tipe_ulangi === 'mingguan'} onChange={handleInputChange} className="form-radio"/><span>Mingguan</span></label>
                            </div>
                            {formData.tipe_ulangi === 'sekali' && (<div className="relative pt-2"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Tanggal</legend><input type="date" name="tanggal_sekali" value={formData.tanggal_sekali || ''} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>)}
                            {formData.tipe_ulangi === 'mingguan' && (<div className="flex justify-center space-x-1 pt-2">{daysOfWeek.map(day => (<button type="button" key={day} onClick={() => handleDayToggle(day)} className={`w-9 h-9 font-semibold rounded-full text-xs transition-colors ${formData.hari_mingguan.includes(day) ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>{day.slice(0, 1)}</button>))}</div>)}
                        </fieldset>
                        <div className="pt-4 mt-auto border-t flex justify-end space-x-3"><button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-md text-sm">Batal</button><button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm">Simpan Tugas</button></div>
                    </form>
                </div>
            </div>
        )}
        {isDeleteConfirmOpen && taskToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h3>
                    <p className="mb-6 text-sm">Yakin ingin menghapus tugas "{taskToDelete.nama_task}"?</p>
                    <div className="flex justify-end space-x-2">
                        <button onClick={cancelDelete} className="px-3 py-2 border rounded-md text-xs">Batal</button>
                        <button onClick={confirmDelete} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs">Ya, Hapus</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TaskSettingsPage;