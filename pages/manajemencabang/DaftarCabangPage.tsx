// FRONTEND: Komponen ini berfungsi sebagai kontainer atau "wrapper" untuk halaman manajemen Grup dan Cabang.
// Fungsinya adalah untuk menyediakan navigasi tab antara halaman GrupPage dan CabangPage,
// serta mengelola state bersama (grup yang dipilih) antara keduanya.

import React, { useState } from 'react';
import { UsersIcon, BuildingStorefrontIcon } from '../../components/icons';
import GrupPage from './GrupPage';
import CabangPage from './CabangPage';
import { Grup } from '../../types';

type ActiveTab = 'grup' | 'cabang';

const DaftarCabangPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('grup');
  const [selectedGrupForFilter, setSelectedGrupForFilter] = useState<Grup | null>(null);

  const handleGrupRowClick = (grup: Grup) => {
    // Toggle selection: if the same group is clicked again, deselect it.
    setSelectedGrupForFilter(prevSelected =>
      prevSelected && prevSelected.id_grup === grup.id_grup ? null : grup
    );
  };

  const tabButtonStyle = (isActive: boolean): string =>
    `px-6 py-3 text-sm font-medium rounded-t-lg focus:outline-none transition-colors duration-150 ease-in-out border-b-2
     ${
       isActive
         ? 'border-[var(--primary-color)] text-[var(--primary-color)] bg-white'
         : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
     }`;

  return (
    <div className="bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)]">
      <div className="mb-0 border-b border-slate-200 px-6 md:px-8 pt-6 md:pt-8">
        <nav className="flex -mb-px" aria-label="Tabs for Branch Management">
          <button
            onClick={() => setActiveTab('grup')}
            className={tabButtonStyle(activeTab === 'grup')}
            aria-current={activeTab === 'grup' ? 'page' : undefined}
          >
            <UsersIcon className="w-5 h-5 mr-2 inline-block" aria-hidden="true" />
            Grup
          </button>
          <button
            onClick={() => setActiveTab('cabang')}
            className={tabButtonStyle(activeTab === 'cabang')}
            aria-current={activeTab === 'cabang' ? 'page' : undefined}
          >
            <BuildingStorefrontIcon className="w-5 h-5 mr-2 inline-block" aria-hidden="true" />
            Cabang
          </button>
        </nav>
      </div>

      <div className="pt-0">
        {activeTab === 'grup' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg">
            <GrupPage onGrupRowClick={handleGrupRowClick} activeGrupForFilter={selectedGrupForFilter} />
          </div>
        )}
        {activeTab === 'cabang' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg">
            <CabangPage selectedGrupForFilter={selectedGrupForFilter} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DaftarCabangPage;