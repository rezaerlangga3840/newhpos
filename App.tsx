// FRONTEND: Ini adalah komponen aplikasi utama (root component).
// Fungsinya adalah untuk mengatur routing (penentuan halaman berdasarkan URL) dan
// membungkus seluruh aplikasi dengan Context Provider yang dibutuhkan.
// Komponen ini tidak berisi logika bisnis, tetapi mengorkestrasi komponen UI
// dan bergantung pada Context untuk data dan state.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import PlaceholderPage from './components/PlaceholderPage';
import CabangPage from './pages/manajemencabang/CabangPage';
import GrupPage from './pages/manajemencabang/GrupPage';
import RolePage from './pages/manajemenuser/RolePage';
// FIX: Changed import to named import as AccessPage does not have a default export.
import AccessPage from './pages/manajemenuser/AccessPage';
import SettingsMenuListPage from './pages/setting/SettingsMenuListPage';
import UserPage from './pages/manajemenuser/UserPage';
import StockPage from './pages/manajemenstok/StockPage';
import MaterialVariantPage from './pages/manajemenstok/MaterialVariantPage';
import ProductVariantPage from './pages/manajemenstok/ProductVariantPage';
import BomPage from './pages/produksi/BomPage';
import StockOverviewPage from './pages/manajemenstok/StockOverviewPage';
import DaftarCabangPage from './pages/manajemencabang/DaftarCabangPage'; 
import LoginPage from './pages/manajemenuser/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { APP_TITLE } from './constants';
import { Bars3Icon, ArrowRightOnRectangleIcon, ChevronDownIcon, UserCircleIcon, BellIcon, InformationCircleIcon, ExclamationTriangleIcon, CheckCircleIcon } from './components/icons';
import { MenuProvider, useMenu } from './contexts/MenuContext';
import { useAuth } from './contexts/AuthContext';
import { BranchProvider, useBranch } from './contexts/BranchContext';
import { AccessProvider, useAccess } from './contexts/AccessContext'; 
import { usePersonalization } from './contexts/PersonalizationContext'; 
import AccessDeniedPage from './pages/manajemenuser/AccessDeniedPage';
import RoleAccessConfigPage from './pages/manajemenuser/RoleAccessConfigPage';
import StockSettingsPage from './pages/manajemenstok/StockSettingsPage';
import TransaksiPage from './pages/penjualan/TransaksiPage';
import POSPage from './pages/penjualan/POSPage';
import PenjualanSettingsPage from './pages/penjualan/PenjualanSettingsPage';
import StokOpnamePage from './pages/manajemenstok/StokOpnamePage'; 
import BalanceStokPage from './pages/manajemenstok/BalanceStokPage';
import KaryawanPage from './pages/hrm/KaryawanPage';
import HRMSettingPage from './pages/hrm/HRMSettingPage';
// FIX: Changed default import to named import as AbsensiPage does not have a default export.
import { AbsensiPage } from './pages/hrm/AbsensiPage';
import HomePage from './pages/HomePage'; 
import PenggajianPage from './pages/hrm/PenggajianPage';
import ProfilePage from './pages/manajemenuser/ProfilePage';
import PersonalizePage from './pages/setting/PersonalizePage';
import TaskSettingsPage from './pages/setting/TaskSettingsPage';
import SalesReportPage from './pages/reports/SalesReport';
import StockReportPage from './pages/reports/StockReport';
import OpnameHistoryReportPage from './pages/reports/OpnameHistoryReport';
import AttendanceReportPage from './pages/reports/AttendanceReport';
import PayrollReportPage from './pages/reports/PayrollReport';
import DashboardPage from './pages/DashboardPage';
import InventoryValuationReport from './pages/reports/InventoryValuationReport';
import CustomerPage from './pages/penjualan/CustomerPage'; // Import CustomerPage
import KDSPage from './pages/dapur/KDSPage'; // Import KDSPage
import SelfOrderPage from './pages/penjualan/SelfOrderPage';
import { getKaryawan } from './backend/api'; // Import API
import { Karyawan } from './types';
import { ModuleActivationProvider } from './contexts/ModuleActivationContext';
import ModuleSettingsPage from './pages/setting/ModuleSettingsPage';
import { useNotification } from './contexts/NotificationContext';

// FRONTEND: Komponen ini mendefinisikan layout utama aplikasi, termasuk header dan sidebar.
const AppContent: React.FC = () => {
  const location = useLocation();
  const { menuData } = useMenu();
  const { currentUser, logout } = useAuth();
  const { logo } = usePersonalization();
  const {
    selectedBranchId,
    selectedBranch,
    selectedGroupId,
    selectedGrup,
    selectableGrups,
    selectableBranches,
    userRoleType,
    isBranchSelectionDisabled,
    isGroupSelectionDisabled,
    updateSelectedBranchId,
    updateSelectedGroupId
  } = useBranch();
  const { canRead, isAccessDataLoaded } = useAccess();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();

  const [currentPageTitle, setCurrentPageTitle] = useState<string>(APP_TITLE);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState<boolean>(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState<boolean>(false);
  const [allKaryawan, setAllKaryawan] = useState<Karyawan[]>([]);
  
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);

  // FRONTEND: Mengambil data karyawan sekali untuk tujuan tampilan (misalnya, di header).
  useEffect(() => {
      getKaryawan().then(setAllKaryawan);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target as Node)) {
        setIsNotificationPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(prev => !prev);
    setIsNotificationPanelOpen(false); // Close other panel
  };

  const toggleNotificationPanel = () => {
    setIsNotificationPanelOpen(prev => !prev);
    setIsUserDropdownOpen(false); // Close other panel
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
        case 'success': return <CheckCircleIcon className="w-6 h-6 text-emerald-500" />;
        case 'warning': return <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />;
        case 'error': return <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />;
        default: return <InformationCircleIcon className="w-6 h-6 text-sky-500" />;
    }
  };

  // FRONTEND: Logika untuk menentukan judul halaman berdasarkan path URL saat ini dan izin pengguna.
  useEffect(() => {
    if (!isAccessDataLoaded) return;

    const currentPath = location.pathname;
    let newTitle = "404 - Page Not Found";

    const findTitle = (items: typeof menuData, path: string): string | null => {
      for (const item of items) {
        if (item.path === path && !item.subItems) {
            return canRead(item.path) ? item.name : "Access Denied";
        }
        if (item.subItems) {
          for (const subItem of item.subItems) {
            if (subItem.path === path) {
                return canRead(subItem.path) ? `${item.name} - ${subItem.name}` : "Access Denied";
            }
          }
        }
      }
      return null;
    };

    if (currentPath === "/login") {
        newTitle = "Login";
    } else if (currentPath === "/access-denied") {
        newTitle = "Access Denied";
    } else if (currentPath === "/" || currentPath === "/home") {
      const homeItemDetails = menuData.find(item => item.path === "/home" && !item.subItems);
      newTitle = homeItemDetails && canRead(homeItemDetails.path) ? homeItemDetails.name : APP_TITLE;
    } else if (currentPath === "/profile") {
      newTitle = "Profil Pengguna";
    } else if (currentPath === "/settings/personalize") {
      newTitle = "Pengaturan - Personalisasi";
    } else if (currentPath === "/notifications") {
      newTitle = "Pusat Notifikasi";
    } else {
      const foundTitle = findTitle(menuData, currentPath);
      if (foundTitle) newTitle = foundTitle;
      else if (!specificPaths.includes(currentPath)) { 
          newTitle = "404 - Page Not Found";
      }
    }
    setCurrentPageTitle(newTitle);
    document.title = `${newTitle} | ${APP_TITLE}`;
  }, [location.pathname, menuData, canRead, isAccessDataLoaded]);

  useEffect(() => {
    // Atur status sidebar default saat pertama kali dimuat berdasarkan ukuran layar.
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  const handleLogout = () => {
    logout();
    setIsUserDropdownOpen(false);
  };

  // FRONTEND: Daftar semua rute halaman spesifik dalam aplikasi.
  const specificRoutes = [
    { path: "/home", element: <HomePage /> },
    { path: "/dashboard", element: <DashboardPage /> },
    { path: "/profile", element: <ProfilePage /> },
    { path: "/branch/daftar-cabang", element: <DaftarCabangPage /> }, 
    { path: "/settings/personalize", element: <PersonalizePage /> },
    { path: "/settings/task-settings", element: <TaskSettingsPage /> },
    { path: "/settings/module-settings", element: <ModuleSettingsPage /> },
    { path: "/user-management/role-access-config", element: <RoleAccessConfigPage /> }, 
    { path: "/user-management/users", element: <UserPage /> },
    { path: "/settings/menu-list", element: <SettingsMenuListPage /> },
    { path: "/stock-management/stock", element: <StockPage /> },
    { path: "/stock-management/material-variants", element: <MaterialVariantPage /> },
    { path: "/stock-management/product-variants", element: <ProductVariantPage /> },
    { path: "/production/bom", element: <BomPage /> },
    { path: "/stock-management/stock-overview", element: <StockOverviewPage /> },
    { path: "/stock-management/stock-balance", element: <BalanceStokPage /> }, 
    { path: "/stock-management/settings", element: <StockSettingsPage /> },
    { path: "/penjualan/pos", element: <POSPage /> }, 
    { path: "/penjualan/transaksi", element: <TransaksiPage /> }, 
    { path: "/penjualan/pelanggan", element: <CustomerPage /> },
    { path: "/penjualan/settings", element: <PenjualanSettingsPage /> }, 
    { path: "/dapur/kds", element: <KDSPage /> },
    { path: "/stock-opname", element: <StokOpnamePage /> }, 
    { path: "/hrm/karyawan", element: <KaryawanPage /> },
    { path: "/hrm/absensi", element: <AbsensiPage /> }, 
    { path: "/hrm/penggajian", element: <PenggajianPage /> },
    { path: "/hrm/settings", element: <HRMSettingPage /> },
    { path: "/reports/sales", element: <SalesReportPage /> },
    { path: "/reports/stock", element: <StockReportPage /> },
    { path: "/reports/inventory-valuation", element: <InventoryValuationReport /> },
    { path: "/reports/opname-history", element: <OpnameHistoryReportPage /> },
    { path: "/reports/attendance", element: <AttendanceReportPage /> },
    { path: "/reports/payroll", element: <PayrollReportPage /> },
    { path: "/notifications", element: <PlaceholderPage title="Pusat Notifikasi" /> },
  ];
  const specificPaths = specificRoutes.map(r => r.path);

  // FRONTEND: Memoized logic untuk menentukan nama tampilan di header.
  const userDisplayText = useMemo(() => {
    let text = currentUser?.username || 'User'; 
    if (currentUser?.id_karyawan) {
        const karyawan = allKaryawan.find(k => k.id_karyawan === currentUser.id_karyawan);
        if (karyawan) {
            text = karyawan.nama_lengkap;
        }
    }

    if (selectedBranch) {
        if (userRoleType === 'superuser' || userRoleType === 'administrator') {
            text += ` (${selectedBranch.id_cabang})`;
        } else if (userRoleType === 'other' && currentUser?.id_cabang === selectedBranch.id_cabang) {
            text += ` (${selectedBranch.id_cabang})`;
        }
    }
    return text;
  }, [currentUser, selectedBranch, userRoleType, allKaryawan]);

  // FRONTEND: Memoized logic untuk mendapatkan URL avatar pengguna.
  const userAvatarUrl = useMemo(() => {
    if (currentUser?.id_karyawan) {
        const karyawan = allKaryawan.find(k => k.id_karyawan === currentUser.id_karyawan);
        if (karyawan?.foto_url) {
            return karyawan.foto_url;
        }
    }
    // Fallback ke avatar unik berdasarkan username jika tidak ada foto atau tidak ada karyawan yang terhubung
    return `https://i.pravatar.cc/150?u=${currentUser?.username || 'default-user'}`;
  }, [currentUser, allKaryawan]);

  const labelStyle = "px-3 py-1.5 text-xs sm:text-sm text-slate-700 bg-white rounded-md whitespace-nowrap";
  const dropdownStyle = "form-select text-xs sm:text-sm pl-2 pr-7 py-1.5 border-slate-300 rounded-md shadow-sm focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] disabled:bg-slate-100 disabled:cursor-not-allowed";

  // FRONTEND: Layar loading yang ditampilkan saat menunggu data penting (seperti izin) diambil.
  if (!isAccessDataLoaded) { 
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-[var(--primary-color)]"></div>
        <p className="ml-4 text-xl text-slate-700">Loading Access Permissions...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar menuItems={menuData} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} logoUrl={logo} />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      <div className={`flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}`}>
        <header className="bg-white shadow-md p-4 sticky top-0 z-10 flex items-center justify-between print:hidden">
            <div className="flex items-center min-w-0">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="mr-3 text-slate-600 hover:text-[var(--primary-color)] p-1 flex-shrink-0"
                    aria-label="Toggle sidebar"
                    title="Toggle sidebar"
                >
                    <Bars3Icon className="w-6 h-6" />
                </button>
            </div>

            <div className="flex items-center space-x-3">
                {(userRoleType === 'superuser' || userRoleType === 'administrator' || (userRoleType === 'other' && currentUser?.id_cabang) ) && (
                <div className="flex items-center space-x-3">
                  {isGroupSelectionDisabled ? (
                    selectedGrup ? (
                      <span className={labelStyle} title={`${selectedGrup.nama_grup} (${selectedGrup.id_grup})`}>
                        {selectedGrup.nama_grup}
                      </span>
                    ) : (
                        (userRoleType === 'administrator' || userRoleType === 'superuser') ?
                        <span className={labelStyle}>Semua Grup</span> :
                        <span className={labelStyle}>N/A Grup</span>
                    )
                  ) : (
                    userRoleType === 'superuser' && (
                      <div className="relative">
                        <label htmlFor="groupSelect" className="sr-only">Nama Grup</label>
                        <select
                          id="groupSelect"
                          value={selectedGroupId || ''}
                          onChange={(e) => updateSelectedGroupId(e.target.value || null)}
                          className={dropdownStyle}
                          aria-label="Select Group Name"
                        >
                          <option value="">Semua Grup</option>
                          {selectableGrups.map(grup => (
                            <option key={grup.id_grup} value={grup.id_grup}>{grup.nama_grup}</option>
                          ))}
                        </select>
                      </div>
                    )
                  )}

                  {isBranchSelectionDisabled ? (
                     selectedBranch ? (
                        <span className={labelStyle} title={`${selectedBranch.Nama} (${selectedBranch.id_cabang})`}>
                            {selectedBranch.Nama} ({selectedBranch.id_cabang})
                        </span>
                     ) : ( userRoleType !== 'superuser' && userRoleType !== 'administrator' && <span className={labelStyle}>N/A Cabang</span>)
                  ) : (
                    (userRoleType === 'superuser' || userRoleType === 'administrator') && (
                       <div className="relative">
                        <label htmlFor="branchSelect" className="sr-only">Cabang</label>
                        <select
                          id="branchSelect"
                          value={selectedBranchId || ''}
                          onChange={(e) => updateSelectedBranchId(e.target.value || null)}
                          className={dropdownStyle}
                          aria-label="Select Branch"
                        >
                          {(selectableBranches.length > 1 || !selectedBranchId || userRoleType === 'administrator') ? <option value="">Semua Cabang</option> : null}

                          {selectableBranches.map(branch => (
                            <option key={branch.id_cabang} value={branch.id_cabang}>
                              {branch.Nama} ({branch.id_cabang})
                            </option>
                          ))}
                          {selectableBranches.length === 0 && (!selectedBranchId && userRoleType !== 'administrator') && <option value="" disabled>Tidak Ada Cabang</option>}
                        </select>
                      </div>
                    )
                  )}
                 </div>
                )}
                
                <div className="relative" ref={userDropdownRef}>
                     <button
                        onClick={toggleUserDropdown}
                        className="flex items-center space-x-2 p-1 rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                        aria-expanded={isUserDropdownOpen}
                        aria-haspopup="true"
                        aria-controls="user-menu"
                    >
                         <img src={userAvatarUrl} alt="User Avatar" className="w-8 h-8 rounded-full object-cover" />
                         <span className="text-sm text-slate-600 hidden md:block max-w-[150px] truncate" title={userDisplayText}>{userDisplayText}</span>
                         <ChevronDownIcon className="w-4 h-4 text-slate-500 hidden md:block"/>
                    </button>
                    {isUserDropdownOpen && (
                        <div
                            id="user-menu"
                            className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 ring-1 ring-black ring-opacity-5"
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby="user-menu-button"
                        >
                            <div className="px-4 py-2 text-xs text-slate-500 border-b">
                                Signed in as <strong className="block truncate">{currentUser?.username}</strong>
                            </div>
                             <Link
                                to="/profile"
                                onClick={() => setIsUserDropdownOpen(false)}
                                className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                role="menuitem"
                            >
                                <UserCircleIcon className="w-5 h-5 mr-2 text-slate-500"/>
                                Profil
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                role="menuitem"
                            >
                                <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2 text-slate-500"/>
                                Logout
                            </button>
                        </div>
                    )}
                </div>

                {/* NOTIFICATION BELL */}
                <div className="relative" ref={notificationPanelRef}>
                    <button
                        onClick={toggleNotificationPanel}
                        className="relative text-slate-600 hover:text-[var(--primary-color)] p-2 rounded-full hover:bg-slate-100 transition-colors"
                        aria-label={`${unreadCount} unread notifications`}
                        title="Notifikasi"
                    >
                        <BellIcon className="w-6 h-6" />
                        {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white animate-pulse">
                            {unreadCount}
                        </span>
                        )}
                    </button>
                    {isNotificationPanelOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl z-20 border border-slate-200/80 max-h-[70vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800">Notifikasi</h3>
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="text-xs font-medium text-sky-600 hover:underline">
                                    Tandai semua dibaca
                                </button>
                            )}
                        </div>
                        {notifications.length > 0 ? (
                            <ul className="flex-grow overflow-y-auto">
                                {notifications.map(notif => (
                                    <li key={notif.id} className={`border-b last:border-b-0 ${!notif.isRead ? 'bg-sky-50/50' : 'bg-white'}`}>
                                        <Link 
                                            to={notif.link || '#'}
                                            onClick={() => {
                                                markAsRead(notif.id);
                                                // Don't close panel if there is a link, to allow navigation
                                                // if(!notif.link) setIsNotificationPanelOpen(false); 
                                            }}
                                            className="block p-4 hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-start space-x-3">
                                                <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notif.type)}</div>
                                                <div className="flex-grow">
                                                    <p className="text-sm text-slate-700">{notif.message}</p>
                                                    <p className="text-xs text-slate-400 mt-1">{new Date(notif.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                </div>
                                                {!notif.isRead && (<div className="w-2.5 h-2.5 bg-sky-500 rounded-full flex-shrink-0 mt-1.5" aria-label="Unread"></div>)}
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-8 text-center text-sm text-slate-500">
                                <p>Tidak ada notifikasi.</p>
                            </div>
                        )}
                        <div className="p-2 bg-slate-50 rounded-b-xl text-center">
                            <Link to="/notifications" onClick={() => setIsNotificationPanelOpen(false)} className="text-sm font-medium text-slate-600 hover:text-sky-600">Lihat Semua</Link>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-200 p-0">
           <Routes>
            <Route path="/" element={canRead("/home") ? <Navigate to="/home" replace /> : <Navigate to="/access-denied" replace />} />
            
            {specificRoutes.map(route => (
              <Route key={route.path} path={route.path} element={<ProtectedRoute path={route.path}>{route.element}</ProtectedRoute>} />
            ))}

            {menuData.map(item => {
              if (specificPaths.includes(item.path) && !item.subItems) return null;
              
              return item.subItems ? (
                item.subItems.map(subItem => {
                  if (specificPaths.includes(subItem.path)) return null;
                  return (
                    <Route
                      key={subItem.path}
                      path={subItem.path}
                      element={
                        <ProtectedRoute path={subItem.path}>
                            <PlaceholderPage title={`${item.name} - ${subItem.name}`} />
                        </ProtectedRoute>
                       }
                    />
                  );
                })
              ) : (
                !specificPaths.includes(item.path) && (
                  <Route
                    key={item.path}
                    path={item.path}
                    element={
                        <ProtectedRoute path={item.path}>
                            <PlaceholderPage title={item.name} />
                        </ProtectedRoute>
                    }
                  />
                )
              );
            })}
            <Route path="/access-denied" element={<AccessDeniedPage />} />
            <Route path="*" element={<PlaceholderPage title="404 - Page Not Found" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// FRONTEND: Komponen root yang menangani state otentikasi dan routing.
const App: React.FC = () => {
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-[var(--primary-color)]"></div>
        <p className="ml-4 text-xl text-slate-700">Loading Application...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/self-order" element={<SelfOrderPage />} />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <AccessProvider> 
              <BranchProvider>
                <ModuleActivationProvider>
                  <MenuProvider>
                    <AppContent />
                  </MenuProvider>
                </ModuleActivationProvider>
              </BranchProvider>
            </AccessProvider>
          ) : (
            <Navigate to="/login" state={{ from: location }} replace />
          )
        }
      />
    </Routes>
  );
};

export default App;
