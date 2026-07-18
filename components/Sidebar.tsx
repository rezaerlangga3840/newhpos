// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan sidebar navigasi.
// Fungsinya adalah untuk me-render daftar menu, menangani logika buka/tutup submenu,
// dan memfilter item menu yang ditampilkan berdasarkan hak akses pengguna (menggunakan AccessContext).

import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MenuItem } from '../types';
import { ChevronDownIcon, ChevronRightIcon, XMarkIcon } from './icons';
import { APP_TITLE } from '../constants';
import { useAccess } from '../contexts/AccessContext'; // Import useAccess
import { useModuleActivation } from '../contexts/ModuleActivationContext';

interface SidebarProps {
  menuItems: MenuItem[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  logoUrl: string;
}

const Sidebar: React.FC<SidebarProps> = ({ menuItems, isOpen, setIsOpen, logoUrl }) => {
  const location = useLocation();
  const { canRead, isAccessDataLoaded } = useAccess(); // Use access context
  const { canShowProduksiMenu, canShowDapurMenu, isModuleDataLoaded } = useModuleActivation();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  // FRONTEND: Memfilter item menu berdasarkan hak akses 'read' (baca) dari pengguna.
  const accessibleMenuItems = useMemo(() => {
    if (!isAccessDataLoaded || !isModuleDataLoaded) return []; // Jangan render menu sampai data akses & modul siap

    return menuItems.map(item => {
      // Sembunyikan menu berdasarkan status aktivasi modul
      if (item.name === 'Produksi' && !canShowProduksiMenu) return null;
      if (item.name === 'Dapur' && !canShowDapurMenu) return null;

      // Jika item memiliki subItems, filter terlebih dahulu
      let accessibleSubItems = item.subItems
        ? item.subItems.filter(subItem => canRead(subItem.path))
        : undefined;

      // Item induk akan ditampilkan jika:
      // 1. Item itu sendiri adalah link langsung yang bisa dibaca ATAU
      // 2. Memiliki sub-item yang bisa diakses.
      if (item.subItems) {
        if (accessibleSubItems && accessibleSubItems.length > 0) {
          return { ...item, subItems: accessibleSubItems };
        }
        // Jika item induk juga merupakan link langsung (jarang terjadi tapi mungkin)
        if (!item.subItems.length && item.path && canRead(item.path)) {
             return { ...item, subItems: undefined }; // Anggap sebagai link langsung jika tidak ada sub-item yang bisa diakses
        }
        return null; // Item induk tidak ditampilkan jika tidak punya sub-item yang bisa diakses dan bukan link
      }
      // Jika ini adalah item menu langsung (tanpa subItems)
      if (canRead(item.path)) {
        return item;
      }
      return null;
    }).filter(item => item !== null) as MenuItem[];
  }, [menuItems, canRead, isAccessDataLoaded, isModuleDataLoaded, canShowProduksiMenu, canShowDapurMenu]);

  // FRONTEND: Efek untuk membuka submenu yang aktif secara otomatis berdasarkan URL saat ini.
  useEffect(() => {
    if (!isAccessDataLoaded || !isModuleDataLoaded) return;
    const activeParent = accessibleMenuItems.find(item => 
      item.subItems?.some(subItem => location.pathname.startsWith(subItem.path))
    );
    if (activeParent) {
      setOpenSubmenus(prev => ({ ...prev, [activeParent.name]: true }));
    }
  }, [location.pathname, accessibleMenuItems, isAccessDataLoaded, isModuleDataLoaded]);

  const toggleSubmenu = (itemName: string) => {
    setOpenSubmenus(prev => ({ ...prev, [itemName]: !prev[itemName] }));
  };

  const handleNavLinkClick = () => {
    // Selalu tutup sidebar setelah item diklik untuk pengalaman pengguna yang lebih baik, terutama di perangkat mobile.
    setIsOpen(false);
  };
  
  const baseLinkClasses = "flex items-center p-3 my-1 space-x-3 rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]";
  
  const getNavLinkClass = (isActive: boolean, isSubItem: boolean = false) => {
    let classes = `${baseLinkClasses} `;
    if (isSubItem) {
      classes += "pl-10 pr-3 py-2 text-sm "; 
    }
    if (isActive) {
      classes += "bg-[var(--primary-color)] text-white font-medium shadow-sm";
    } else {
      classes += `${isSubItem ? 'text-slate-300 hover:text-white hover:bg-slate-700' : 'text-slate-200 hover:text-white hover:bg-slate-700'} font-normal`;
    }
    return classes;
  };
  
  const getParentButtonClass = (item: MenuItem) => {
    const isActiveParent = item.subItems?.some(subItem => location.pathname.startsWith(subItem.path));
    let classes = `${baseLinkClasses} w-full justify-between `;
    if (isActiveParent) {
      classes += "text-white font-medium"; 
    } else {
      classes += "text-slate-200 hover:text-white hover:bg-slate-700 font-normal";
    }
    return classes;
  };

  // FRONTEND: Tampilan loading saat data hak akses sedang dimuat.
  if (!isAccessDataLoaded || !isModuleDataLoaded) {
    return (
      <div className={`fixed top-0 left-0 h-screen w-72 bg-slate-800 text-white flex flex-col items-center justify-center shadow-xl z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-400"></div>
        <p className="mt-3 text-sm text-slate-300">Loading Menu...</p>
      </div>
    );
  }

  return (
    <div 
      className={`fixed top-0 left-0 h-screen w-72 bg-slate-800 text-white flex flex-col shadow-xl z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      aria-hidden={!isOpen}
      role="navigation"
      aria-label="Main Navigation"
    >
      <div className="p-5 border-b border-slate-700 flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-4">
            <img src={logoUrl} alt="Company Logo" className="w-[4.5rem] h-12 rounded-md flex-shrink-0 object-cover" />
             <div>
              <span className="text-3xl font-black text-white tracking-tighter">
                <span className="text-white">H</span><span className="text-sky-400">POS</span>
              </span>
            </div>
        </div>
        <button 
            onClick={() => setIsOpen(false)} 
            className="text-slate-300 hover:text-white"
            aria-label="Close sidebar"
            title="Close sidebar"
        >
            <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-grow p-3 space-y-1 overflow-y-auto">
        {accessibleMenuItems.map((item) => (
          <div key={item.name}>
            {item.subItems && item.subItems.length > 0 ? ( // Hanya render sebagai menu dropdown jika ada sub-item
              <>
                <button
                  onClick={() => toggleSubmenu(item.name)}
                  className={getParentButtonClass(item)}
                  aria-expanded={openSubmenus[item.name]}
                  aria-controls={`submenu-${item.name.replace(/\s+/g, '-')}`}
                >
                  <span className="flex items-center space-x-3">
                    {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
                    <span>{item.name}</span>
                  </span>
                  {openSubmenus[item.name] ? (
                    <ChevronDownIcon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  )}
                </button>
                {openSubmenus[item.name] && (
                  <div id={`submenu-${item.name.replace(/\s+/g, '-')}`} className="ml-1 mt-1 space-y-px">
                    {item.subItems.map((subItem) => (
                      <NavLink
                        key={subItem.path}
                        to={subItem.path}
                        onClick={handleNavLinkClick}
                        className={({ isActive }) => getNavLinkClass(isActive, true)}
                      >
                        {subItem.icon ? <subItem.icon className="w-4 h-4 mr-2 flex-shrink-0" aria-hidden="true" /> : <span className="w-4 h-4 mr-2 flex-shrink-0"></span>}
                        {subItem.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </>
            ) : ( // Render sebagai link langsung jika tidak ada subItems
              <NavLink
                to={item.path}
                onClick={handleNavLinkClick}
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                {item.icon && <item.icon className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />}
                <span>{item.name}</span>
              </NavLink>
            )}
          </div>
        ))}
      </nav>
       <div className="p-4 mt-auto border-t border-slate-700 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} H-POS. All rights reserved.
      </div>
    </div>
  );
};

export default Sidebar;