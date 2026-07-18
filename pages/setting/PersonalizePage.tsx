// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk halaman Personalisasi.
// Fungsinya adalah untuk memungkinkan pengguna mengubah tampilan aplikasi, seperti
// warna tema, logo, dan gambar latar belakang login, dengan memanggil fungsi dari PersonalizationContext.

import React, { useState } from 'react';
import { usePersonalization } from '../../contexts/PersonalizationContext';
import { TrashIcon, BuildingStorefrontIcon, ComputerDesktopIcon } from '../../components/icons';
import AplikasiTab from './personalize/AplikasiTab';
import PerusahaanTab from './personalize/PerusahaanTab';


type ActiveTab = 'aplikasi' | 'perusahaan';

const PersonalizePage: React.FC = () => {
    const { 
        themeColor, 
        setThemeColor, 
        logo, 
        setLogo,
        loginBackground,
        setLoginBackground,
        loginLogo,
        setLoginLogo,
        resetPersonalization
    } = usePersonalization();

    const [activeTab, setActiveTab] = useState<ActiveTab>('aplikasi');
    
    const handleConfirmReset = () => {
        if (window.confirm("Apakah Anda yakin ingin mengatur ulang semua pengaturan personalisasi ke default? Tindakan ini tidak dapat dibatalkan.")) {
            resetPersonalization();
        }
    };
    
    const tabButtonStyle = (isActive: boolean): string =>
    `px-4 sm:px-6 py-3 text-sm font-medium rounded-t-lg focus:outline-none transition-colors duration-150 ease-in-out border-b-2 flex items-center space-x-2
     ${
       isActive
         ? 'border-[var(--primary-color)] text-[var(--primary-color)] bg-white'
         : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
     }`;

    return (
        <div className="bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)]">
             <div className="flex flex-col sm:flex-row justify-between items-center mb-0 px-6 md:px-8 pt-6 md:pt-8 border-b border-slate-200">
                <nav className="flex -mb-px" aria-label="Tabs for Personalization">
                  <button onClick={() => setActiveTab('aplikasi')} className={tabButtonStyle(activeTab === 'aplikasi')}>
                      <ComputerDesktopIcon className="w-5 h-5"/>
                      <span>Aplikasi</span>
                  </button>
                  <button onClick={() => setActiveTab('perusahaan')} className={tabButtonStyle(activeTab === 'perusahaan')}>
                     <BuildingStorefrontIcon className="w-5 h-5"/>
                     <span>Perusahaan</span>
                  </button>
                </nav>
                 <button onClick={handleConfirmReset} className="flex items-center text-sm font-medium text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors mt-4 sm:mt-0">
                    <TrashIcon className="w-5 h-5 mr-1.5"/> Atur Ulang Semua
                </button>
            </div>
            
            <div className="p-6 md:p-8">
                {activeTab === 'aplikasi' && (
                    <AplikasiTab
                        loginLogo={loginLogo}
                        setLoginLogo={setLoginLogo}
                        loginBackground={loginBackground}
                        setLoginBackground={setLoginBackground}
                    />
                )}

                {activeTab === 'perusahaan' && (
                     <PerusahaanTab
                        logo={logo}
                        setLogo={setLogo}
                        themeColor={themeColor}
                        setThemeColor={setThemeColor}
                    />
                )}
            </div>
        </div>
    );
};

export default PersonalizePage;