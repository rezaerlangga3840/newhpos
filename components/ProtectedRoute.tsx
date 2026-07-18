// FRONTEND: Komponen ini berfungsi sebagai "penjaga" untuk rute-rute aplikasi.
// Fungsinya adalah untuk memeriksa apakah pengguna sudah terotentikasi dan memiliki
// izin yang cukup (menggunakan AuthContext dan AccessContext) sebelum mengizinkan akses ke sebuah halaman.
// Jika tidak, pengguna akan diarahkan ke halaman login atau halaman "Akses Ditolak".

import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAccess } from '../contexts/AccessContext'; // Import useAccess

interface ProtectedRouteProps {
  children?: React.ReactNode; 
  path?: string; // Optional path prop to check specific permission
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, path }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { canRead, isAccessDataLoaded } = useAccess();
  const location = useLocation();

  // Tampilkan loading jika status otentikasi atau data akses belum siap.
  if (isAuthLoading || !isAccessDataLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-600"></div>
        <p className="ml-3 text-slate-600">Loading data...</p>
      </div>
    );
  }

  // Jika belum login, alihkan ke halaman login.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Jika path diberikan, periksa izin baca untuk path tersebut.
  // Jika tidak punya izin, alihkan ke halaman 'access-denied'.
  if (path && !canRead(path)) {
    return <Navigate to="/access-denied" state={{ from: location }} replace />;
  }

  // Jika semua pemeriksaan lolos, tampilkan halaman yang dituju.
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;