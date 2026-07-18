// FRONTEND: Komponen ini berfungsi sebagai kontainer atau "wrapper" yang menampilkan tab untuk halaman Role dan halaman Akses Menu.

import React, { useState } from 'react';
import { CogIcon, KeyIcon } from '../../components/icons';
import RolePage from './RolePage';
// FIX: Changed import to named import as AccessPage does not have a default export.
import AccessPage from './AccessPage';
import { Role } from '../../types'; // Import Role type

type ActiveTab = 'role' | 'akses';

const RoleAccessConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('role');
  const [selectedRoleForAccessTab, setSelectedRoleForAccessTab] = useState<Role | null>(null);

  const tabButtonStyle = (isActive: boolean): string =>
    `px-6 py-3 text-sm font-medium rounded-t-lg focus:outline-none transition-colors duration-150 ease-in-out border-b-2
     ${
       isActive
         ? 'border-[var(--primary-color)] text-[var(--primary-color)] bg-white'
         : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
     }`;

  const handleRoleSelectForAccessTab = (role: Role | null) => {
    // Toggle selection: if the same role is clicked again, deselect it.
    setSelectedRoleForAccessTab(prevSelectedRole => 
      prevSelectedRole && prevSelectedRole.id_role === role?.id_role
      ? null 
      : role
    );
  };
  
  const roleIdForAccess = selectedRoleForAccessTab?.id_role || null;

  return (
    <div className="bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)]">
      <div className="mb-0 border-b border-slate-200 px-6 md:px-8 pt-6 md:pt-8">
        <nav className="flex -mb-px" aria-label="Tabs for Role Access Configuration">
          <button
            onClick={() => setActiveTab('role')}
            className={tabButtonStyle(activeTab === 'role')}
            aria-current={activeTab === 'role' ? 'page' : undefined}
          >
            <CogIcon className="w-5 h-5 mr-2 inline-block" aria-hidden="true" />
            Role
          </button>
          <button
            onClick={() => setActiveTab('akses')}
            className={tabButtonStyle(activeTab === 'akses')}
            aria-current={activeTab === 'akses' ? 'page' : undefined}
          >
            <KeyIcon className="w-5 h-5 mr-2 inline-block" aria-hidden="true" />
            Akses Menu
          </button>
        </nav>
      </div>

      <div className="pt-0"> 
        {activeTab === 'role' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg">
            <RolePage 
              onRoleSelectForAccessTab={handleRoleSelectForAccessTab}
              activeRoleForAccessTab={selectedRoleForAccessTab}
            />
          </div>
        )}
        {activeTab === 'akses' && (
          <div className="bg-white rounded-b-lg rounded-tr-lg">
            <AccessPage filterByRoleCompositeKey={roleIdForAccess} title="Akses Menu" />
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleAccessConfigPage;
