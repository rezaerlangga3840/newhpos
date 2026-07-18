// FRONTEND: Komponen ini berfungsi sebagai kontainer atau "wrapper" yang menampilkan tab untuk semua halaman terkait manajemen stok.

import React, { useState } from 'react';
import { Stok } from '../../types';
import {
  PackageIcon,
  BeakerIcon, 
  DocumentDuplicateIcon,
} from '../../components/icons';

// Import sub-pages/components
import StockPage from './StockPage';
import MaterialVariantPage from './MaterialVariantPage';
import ProductVariantPage from './ProductVariantPage';

type ActiveTab = 'stock' | 'material-variants' | 'product-variants';

const StockOverviewPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('stock');
  const [selectedStockForFilter, setSelectedStockForFilter] = useState<Stok | null>(null);

  const handleStockRowClick = (stockItem: Stok) => {
    // Toggle functionality: if the same item is clicked again, clear the filter.
    setSelectedStockForFilter(prev => 
      prev && prev.id_stok === stockItem.id_stok && prev.id_cabang === stockItem.id_cabang 
      ? null 
      : stockItem
    );
  };

  const tabButtonStyle = (isActive: boolean): string =>
    `px-4 sm:px-6 py-3 text-sm font-medium rounded-t-lg focus:outline-none transition-colors duration-150 ease-in-out border-b-2 flex items-center space-x-2
     ${
       isActive
         ? 'border-[var(--primary-color)] text-[var(--primary-color)] bg-white'
         : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
     }`;
     
  const tabComponents: Record<ActiveTab, React.ReactNode> = {
    'stock': <StockPage onRowClick={handleStockRowClick} activeItem={selectedStockForFilter} />,
    'material-variants': <MaterialVariantPage selectedStockForFilter={selectedStockForFilter} />,
    'product-variants': <ProductVariantPage selectedStockForFilter={selectedStockForFilter} />,
  };

  return (
    <div className="bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)]">
      <div className="mb-0 border-b border-slate-200 px-4 sm:px-6 pt-4 sm:pt-6 md:px-8 md:pt-8">
        <nav className="flex -mb-px" aria-label="Tabs for Stock Management">
          <button
            onClick={() => setActiveTab('stock')}
            className={tabButtonStyle(activeTab === 'stock')}
            aria-current={activeTab === 'stock' ? 'page' : undefined}
          >
            <PackageIcon className="w-5 h-5" aria-hidden="true" />
            <span>Stok Induk</span>
          </button>
          <button
            onClick={() => setActiveTab('material-variants')}
            className={tabButtonStyle(activeTab === 'material-variants')}
            aria-current={activeTab === 'material-variants' ? 'page' : undefined}
          >
            <BeakerIcon className="w-5 h-5" aria-hidden="true" />
            <span>Varian Material</span>
          </button>
          <button
            onClick={() => setActiveTab('product-variants')}
            className={tabButtonStyle(activeTab === 'product-variants')}
            aria-current={activeTab === 'product-variants' ? 'page' : undefined}
          >
            <DocumentDuplicateIcon className="w-5 h-5" aria-hidden="true" />
            <span>Varian Produk</span>
          </button>
        </nav>
      </div>

      <div className="pt-0">
        {tabComponents[activeTab]}
      </div>
    </div>
  );
};

export default StockOverviewPage;
