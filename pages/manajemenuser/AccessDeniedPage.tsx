// FRONTEND: Komponen ini menampilkan halaman "Akses Ditolak".
// Fungsinya adalah untuk memberitahu pengguna bahwa mereka tidak memiliki
// izin untuk mengakses halaman yang mereka coba buka.

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyIcon } from '../../components/icons'; // Using KeyIcon as a symbol of access

const AccessDeniedPage: React.FC = () => {
  const location = useLocation();
  const attemptedPath = location.state?.from?.pathname || '';

  return (
    <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center">
      <KeyIcon className="w-20 h-20 text-red-500 mb-6" />
      <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-4">
        Access Denied
      </h1>
      <p className="text-slate-600 text-lg mb-2">
        Sorry, you do not have sufficient permissions to access this page
        {attemptedPath && <code className="bg-slate-200 text-sm p-1 rounded mx-1">{attemptedPath}</code>}.
      </p>
      <p className="text-slate-500 mb-8">
        If you believe this is an error, please contact your system administrator.
      </p>
      <Link
        to="/dashboard" // Or another safe, universally accessible route
        className="px-6 py-3 bg-[var(--primary-color)] hover:bg-[var(--primary-color-dark)] text-white font-semibold rounded-md shadow-sm transition duration-150 ease-in-out transform hover:scale-105"
      >
        Go to Dashboard
      </Link>
    </div>
  );
};

export default AccessDeniedPage;