// FRONTEND: Komponen ini berfungsi sebagai halaman pengaturan untuk modul HRM.
// Ini menggunakan sistem tab untuk mengelola berbagai konfigurasi, seperti Titik Absensi dan Komponen Gaji.

import React, { useState, useEffect, useCallback } from 'react';
import { TitikAbsensi, Branch, PayrollComponent, Grup } from '../../types';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { SpinnerIcon, MapPinIcon as MapPinIconSolid, CurrencyDollarIcon } from '../../components/icons'; 
import TitikAbsensiPage from './TitikAbsensiPage';
import KomponenGajiPage from './KomponenGajiPage';

type ActiveHRMSettingTab = 'titik_absensi' | 'payroll_component';

const HRMSettingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveHRMSettingTab>('titik_absensi');
  const [isLoading, setIsLoading] = useState(true);
  const [pageData, setPageData] = useState<{
      titikAbsensi: TitikAbsensi[],
      payrollComponents: PayrollComponent[],
      branches: Branch[],
      grups: Grup[],
  }>({ titikAbsensi: [], payrollComponents: [], branches: [], grups: [] });
  const { isAccessDataLoaded } = useAccess();

  const fetchData = useCallback(async () => {
      setIsLoading(true);
      try {
          const data = await api.getHrmSettingsPageData();
          setPageData(data);
      } catch (error) {
          console.error("Failed to load HRM Settings page data:", error);
          alert("Gagal memuat data pengaturan HRM.");
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    if (isAccessDataLoaded) {
      fetchData();
    }
  }, [isAccessDataLoaded, fetchData]);

  const tabButtonStyle = (isActive: boolean): string =>
    `px-4 sm:px-6 py-3 text-sm font-medium rounded-t-lg focus:outline-none transition-colors duration-150 ease-in-out border-b-2 flex items-center space-x-2
     ${ isActive ? 'border-sky-600 text-sky-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300' }`;

  if (isLoading || !isAccessDataLoaded) {
    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex justify-center items-center">
            <SpinnerIcon className="w-8 h-8 text-sky-500" />
        </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)]">
      <div className="mb-0 border-b border-slate-200 px-6 md:px-8 pt-6 md:pt-8">
        <nav className="flex -mb-px" aria-label="Tabs for HRM Settings">
          <button onClick={() => setActiveTab('titik_absensi')} className={tabButtonStyle(activeTab === 'titik_absensi')}><MapPinIconSolid className="w-5 h-5"/><span>Titik Absensi</span></button>
          <button onClick={() => setActiveTab('payroll_component')} className={tabButtonStyle(activeTab === 'payroll_component')}><CurrencyDollarIcon className="w-5 h-5"/><span>Komponen Gaji</span></button>
        </nav>
      </div>
      <div className="pt-0"> 
        {activeTab === 'titik_absensi' && (<div className="bg-white rounded-b-lg rounded-tr-lg"><TitikAbsensiPage titikAbsensiList={pageData.titikAbsensi} branches={pageData.branches} fetchData={fetchData} /></div>)}
        {activeTab === 'payroll_component' && (<div className="bg-white rounded-b-lg rounded-tr-lg"><KomponenGajiPage components={pageData.payrollComponents} fetchData={fetchData} grups={pageData.grups} branches={pageData.branches} /></div>)}
      </div>
    </div>
  );
};

export default HRMSettingPage;