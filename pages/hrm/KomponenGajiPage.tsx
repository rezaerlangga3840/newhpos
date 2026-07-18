// FRONTEND: Komponen ini mengelola UI khusus untuk pengaturan Komponen Gaji.

import React, { useState, useMemo, useCallback } from 'react';
import { PayrollComponent, Grup, Branch } from '../../types';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, XMarkIcon, ChevronDownIcon, SpinnerIcon } from '../../components/icons';
import { useBranch } from '../../contexts/BranchContext';

const PAGE_PATH = '/hrm/settings';

interface KomponenGajiPageProps {
  components: PayrollComponent[];
  fetchData: () => Promise<void>;
  grups: Grup[];
  branches: Branch[];
}

const KomponenGajiPage: React.FC<KomponenGajiPageProps> = ({ components, fetchData, grups, branches }) => {
  const { canInsert, canUpdate, canDelete } = useAccess();
  const { selectedGroupId, selectedBranchId, selectableGrups } = useBranch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentComponent, setCurrentComponent] = useState<PayrollComponent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultFormData: Omit<PayrollComponent, 'id_payroll_component'> = {
    id_grup: '',
    id_cabang: null,
    nama_component: '', type: 'pendapatan', calculation_type: 'manual', amount: null,
  };
  const [formData, setFormData] = useState(deepClone(defaultFormData));

  const NON_DELETABLE_COMPONENT_IDS = useMemo(() => new Set(['PC1']), []);
  
  const grupMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);
  const branchMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.Nama])), [branches]);

  const displayedComponents = useMemo(() => {
    if (!selectedGroupId) return components;
    return components.filter(c => c.id_grup === selectedGroupId);
  }, [components, selectedGroupId]);

  const handleOpenModal = (mode: 'add' | 'edit', component?: PayrollComponent) => {
    if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
    setModalMode(mode);
    if (mode === 'edit' && component) {
      setCurrentComponent(component);
      setFormData({ ...component, id_cabang: component.id_cabang || '__SEMUA__' });
    } else {
      setCurrentComponent(null);
      const initialGrupId = selectedGroupId || (selectableGrups.length > 0 ? selectableGrups[0].id_grup : '');
      if (!initialGrupId) {
          alert("Pilih grup di header untuk menambahkan komponen gaji.");
          return;
      }
      const initialBranchId = selectedBranchId || '__SEMUA__';
      setFormData({ ...defaultFormData, id_grup: initialGrupId, id_cabang: initialBranchId });
    }
    setIsModalOpen(true);
  };
  const handleCloseModal = () => setIsModalOpen(false);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
        let newState = { ...prev, [name]: value };
        if (name === 'calculation_type' && value === 'manual') newState.amount = null;
        if (name === 'id_grup') newState.id_cabang = '__SEMUA__';
        if (name === 'id_cabang' && value === '__SEMUA__') newState.id_cabang = null;
        return newState;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_component.trim() || !formData.id_grup) { alert("Nama komponen dan Grup wajib diisi."); return; }
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        amount: formData.calculation_type === 'manual' ? null : (Number(formData.amount) || 0),
        id_cabang: formData.id_cabang === '__SEMUA__' ? null : formData.id_cabang,
      };
      let response;
      if (modalMode === 'add') {
        response = await api.createPayrollComponent(dataToSave);
      } else if (currentComponent) {
        response = await api.updatePayrollComponent(currentComponent.id_payroll_component, dataToSave as PayrollComponent);
      }
      if (response && response.success) {
        await fetchData();
        handleCloseModal();
      } else {
        alert(response?.message || 'Gagal menyimpan komponen.');
      }
    } catch (error) {
      alert(`Terjadi kesalahan: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (component: PayrollComponent) => {
    if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
    if (NON_DELETABLE_COMPONENT_IDS.has(component.id_payroll_component)) { alert("Komponen default tidak dapat dihapus."); return; }
    if (window.confirm(`Yakin ingin menghapus komponen "${component.nama_component}"?`)) {
      setIsSubmitting(true);
      try {
        const response = await api.deletePayrollComponent(component.id_payroll_component);
        if (response.success) {
          await fetchData();
        } else {
          alert(response.message || 'Gagal menghapus.');
        }
      } catch (error) {
        alert(`Terjadi kesalahan: ${error}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  
  const columns = useMemo<ColumnDef<PayrollComponent>[]>(() => [
    { header: 'Grup', accessor: item => grupMap.get(item.id_grup) || item.id_grup, sortable: true },
    { header: 'Cabang', accessor: item => item.id_cabang ? (branchMap.get(item.id_cabang) || item.id_cabang) : <span className="italic text-slate-500">Semua Cabang</span>, sortable: true },
    { header: 'Nama Komponen', accessor: 'nama_component', sortable: true },
    { header: 'Tipe', accessor: 'type', sortable: true, render: (item) => <span className={`capitalize px-2 py-0.5 text-xs rounded-full ${item.type === 'pendapatan' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.type}</span> },
    { header: 'Tipe Kalkulasi', accessor: 'calculation_type', sortable: true, render: (item) => item.calculation_type === 'fixed' ? 'Jumlah Tetap' : item.calculation_type === 'hourly' ? 'Per Jam' : 'Manual' },
    { header: 'Jumlah (Rp)', accessor: 'amount', sortable: true, render: (item) => <div className="text-right">{item.calculation_type !== 'manual' && item.amount !== null ? `Rp ${item.amount.toLocaleString()}` : '-'}</div> },
  ], [grupMap, branchMap]);

  const renderActions = useCallback((component: PayrollComponent) => {
    const isDefault = NON_DELETABLE_COMPONENT_IDS.has(component.id_payroll_component);
    return (<div className="space-x-2">
      {canUpdate(PAGE_PATH) && <button onClick={() => handleOpenModal('edit', component)} className="p-1 text-sky-600 hover:text-sky-800"><PencilSquareIcon className="w-5 h-5"/></button>}
      {canDelete(PAGE_PATH) && (<button onClick={() => handleDelete(component)} disabled={isDefault} className={`p-1 text-red-600 hover:text-red-800 ${isDefault ? 'opacity-50 cursor-not-allowed' : ''}`} title={isDefault ? "Komponen default tidak dapat dihapus" : "Hapus komponen"}><TrashIcon className="w-5 h-5"/></button>)}
    </div>);
  }, [canUpdate, canDelete, NON_DELETABLE_COMPONENT_IDS, handleOpenModal, handleDelete]);

  const headerActions = useMemo(() => (canInsert(PAGE_PATH) && <button onClick={() => handleOpenModal('add')} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md text-sm shadow-sm flex items-center whitespace-nowrap"><PlusCircleIcon className="w-5 h-5 mr-1.5"/>Tambah Komponen</button>), [canInsert, handleOpenModal]);

  const modalBranches = useMemo(() => branches.filter(b => b.id_grup === formData.id_grup), [branches, formData.id_grup]);


  return (
    <div className="p-6 md:p-8">
      <TabelFiturStandar data={displayedComponents} columns={columns} uniqueIdKey="id_payroll_component" renderActions={renderActions} headerActions={headerActions} title="Manajemen Komponen Gaji" />
      {isModalOpen && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">{modalMode === 'add' ? 'Tambah' : 'Edit'} Komponen Gaji</h3><button onClick={handleCloseModal}><XMarkIcon className="w-5 h-5"/></button></div><form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Grup*</legend><select name="id_grup" value={formData.id_grup} onChange={handleInputChange} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100">{selectableGrups.map(g => (<option key={g.id_grup} value={g.id_grup}>{g.nama_grup}</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4" /></div></fieldset></div>
                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Cabang</legend><select name="id_cabang" value={formData.id_cabang || '__SEMUA__'} onChange={handleInputChange} disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100"><option value="__SEMUA__">Semua Cabang (Grup ini)</option>{modalBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4" /></div></fieldset></div>
            </div>
            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Nama Komponen*</legend><input type="text" name="nama_component" value={formData.nama_component} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Tipe*</legend><select name="type" value={formData.type} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="pendapatan">Pendapatan</option><option value="potongan">Potongan</option></select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div><div className="grid grid-cols-2 gap-4"><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Tipe Perhitungan*</legend><select name="calculation_type" value={formData.calculation_type} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="fixed">Jumlah Tetap</option><option value="hourly">Per Jam</option><option value="manual">Manual</option></select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Jumlah (Rp)</legend><input type="number" name="amount" value={formData.amount || ''} onChange={handleInputChange} disabled={formData.calculation_type === 'manual'} className="block w-full py-2.5 outline-none bg-transparent disabled:bg-slate-100"/></fieldset></div></div><div className="flex justify-end space-x-2 pt-4 border-t"><button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-md text-sm" disabled={isSubmitting}>Batal</button><button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm" disabled={isSubmitting}>Simpan</button></div></form></div></div>)}
    </div>
  );
};

export default KomponenGajiPage;