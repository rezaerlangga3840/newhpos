// FRONTEND: Komponen ini sekarang berfungsi sebagai kontainer atau "wrapper" untuk halaman pengaturan penjualan.
// Fungsinya adalah untuk menyediakan navigasi tab antara halaman Promo, Meja, Metode Pembayaran, dan Biaya Pengantaran.

import React, { useState } from 'react';
import { CogIcon, CurrencyDollarIcon, BriefcaseIcon, MotorcycleIcon } from '../../components/icons';

// Import the newly created sub-page components
import PromoPage from './PromoPage';
import MejaPage from './MejaPage';
import MetodePembayaranPage from './MetodePembayaranPage';
import BiayaPengantaranPage from './BiayaPengantaranPage';

type ActivePenjualanSettingTab = 'promo' | 'meja' | 'metode_pembayaran' | 'biaya_pengantaran';

const PenjualanSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActivePenjualanSettingTab>('promo');

  const tabButtonStyle = (isActive: boolean): string =>
    `px-4 sm:px-6 py-3 text-sm font-medium rounded-t-lg focus:outline-none transition-colors duration-150 ease-in-out border-b-2 flex items-center space-x-2
     ${
       isActive
         ? 'border-[var(--primary-color)] text-[var(--primary-color)] bg-white'
         : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
     }`;
     
  return (
    <div className="bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)]">
      <div className="mb-0 border-b border-slate-200 px-6 md:px-8 pt-6 md:pt-8">
        <nav className="flex -mb-px" aria-label="Tabs for Sales Settings">
          <button onClick={() => setActiveTab('promo')} className={tabButtonStyle(activeTab === 'promo')}>
              <CurrencyDollarIcon className="w-5 h-5"/>
              <span>Promo</span>
          </button>
          <button onClick={() => setActiveTab('meja')} className={tabButtonStyle(activeTab === 'meja')}>
              <BriefcaseIcon className="w-5 h-5"/>
              <span>Meja</span>
          </button>
           <button onClick={() => setActiveTab('metode_pembayaran')} className={tabButtonStyle(activeTab === 'metode_pembayaran')}>
              <CogIcon className="w-5 h-5"/>
              <span>Metode Pembayaran</span>
          </button>
          <button onClick={() => setActiveTab('biaya_pengantaran')} className={tabButtonStyle(activeTab === 'biaya_pengantaran')}>
              <MotorcycleIcon className="w-5 h-5"/>
              <span>Biaya Pengantaran</span>
          </button>
        </nav>
      </div>
      
      <div className="pt-0">
        {activeTab === 'promo' && <PromoPage />}
        {activeTab === 'meja' && <MejaPage />}
        {activeTab === 'metode_pembayaran' && <MetodePembayaranPage />}
        {activeTab === 'biaya_pengantaran' && <BiayaPengantaranPage />}
      </div>
    </div>
  );
};

export default PenjualanSettingsPage;
