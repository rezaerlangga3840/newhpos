// FRONTEND: Komponen ini berfungsi sebagai halaman pengganti (placeholder).
// Tujuannya adalah untuk menampilkan konten sementara pada rute-rute yang
// fungsionalitasnya belum diimplementasikan secara penuh.

import React from 'react';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]"> {/* Adjust min-h based on header height */}
      <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-6 pb-4 border-b border-slate-200">
        {title}
      </h1>
      <div className="text-slate-700 space-y-4">
        <p className="text-lg">Welcome to the <strong className="text-[var(--primary-color)]">{title}</strong> section.</p>
        <p>This area is currently under development. Detailed functionality and content for managing {title.toLowerCase()} will be available soon.</p>
        <div className="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="text-xl font-semibold text-slate-700 mb-3">What to expect:</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
                <li>Interactive forms for data entry and management.</li>
                <li>Detailed tables and data grids.</li>
                <li>Relevant actions and operations specific to {title.toLowerCase()}.</li>
                <li>Integration with other modules for a seamless experience.</li>
            </ul>
        </div>
        <img 
            src={`https://picsum.photos/seed/${title.replace(/\s+/g, '-').toLowerCase()}/1200/600`} 
            alt={`${title} placeholder graphic`} 
            className="mt-10 rounded-lg shadow-lg aspect-video object-cover" 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null; // prevent infinite loop if fallback also fails
              target.src = 'https://picsum.photos/1200/600'; // generic fallback
            }}
        />
      </div>
    </div>
  );
};

export default PlaceholderPage;