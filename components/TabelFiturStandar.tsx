// FRONTEND: Komponen tabel standar yang dapat digunakan kembali dengan fitur pencarian, pengurutan, dan paginasi.
// Dibuat generik menggunakan TypeScript untuk menerima tipe data apa pun.

import React, { useState, useMemo, useCallback } from 'react';
import { 
    MagnifyingGlassIcon, 
    ArrowUpIcon, 
    ArrowDownIcon, 
    ChevronLeftIcon, 
    ChevronRightIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    FilterIcon,
    ChevronDownIcon,
    PlusCircleIcon,
    TrashIcon
} from './icons';

// --- DEFINISI TIPE ---

// Mendefinisikan bagaimana sebuah kolom dalam tabel seharusnya berperilaku.
export interface ColumnDef<T> {
  header: string; // Teks yang muncul di header tabel.
  accessor: keyof T | ((item: T) => any); // Cara mendapatkan data untuk kolom ini dari sebuah item.
  sortable?: boolean; // Apakah kolom ini bisa diurutkan.
  render?: (item: T) => React.ReactNode; // Renderer kustom opsional untuk konten sel.
}

// Props untuk komponen tabel utama.
export interface TabelFiturStandarProps<T> {
  data: T[]; // Array data yang akan ditampilkan.
  columns: ColumnDef<T>[]; // Konfigurasi untuk kolom tabel.
  uniqueIdKey: keyof T | ((item: T) => string | number); // Kunci unik untuk setiap item.
  initialPageSize?: number; // Jumlah item awal per halaman.
  title?: string; // Judul opsional untuk bagian tabel.
  renderActions?: (item: T) => React.ReactNode; // Renderer opsional untuk kolom "Aksi".
  headerActions?: React.ReactNode; // Elemen tambahan untuk header (misal: tombol Tambah).
  onRowClick?: (item: T) => void; // Callback saat baris diklik.
  activeItem?: T | null; // Item yang sedang aktif/dipilih untuk di-highlight.
  
  // Manual Pagination Props
  manualPagination?: boolean;
  totalItems?: number;
  onManualPageChange?: (page: number) => void;
  onManualPageSizeChange?: (pageSize: number) => void;
  
  // UI Control
  hideSearch?: boolean; // Opsi untuk menyembunyikan search bar bawaan
}

// Tipe untuk filter lanjutan
type Operator = 
  | 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with' // string
  | 'gt' | 'lt' | 'gte' | 'lte' | 'between' // number & date
  | 'is_empty' | 'is_not_empty'; // common

interface FilterCondition {
  id: number;
  field: string; // Will store the column header
  operator: Operator;
  value: any;
  value2?: any;
}

// --- KOMPONEN UTAMA ---

export function TabelFiturStandar<T extends Record<string, any>>({
  data,
  columns,
  uniqueIdKey,
  initialPageSize = 10,
  title,
  renderActions,
  headerActions,
  onRowClick,
  activeItem,
  manualPagination = false,
  totalItems = 0,
  onManualPageChange,
  onManualPageSizeChange,
  hideSearch = false,
}: TabelFiturStandarProps<T>) {
  // --- MANAJEMEN STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortConfig, setSortConfig] = useState<{ key: keyof T | ((item: T) => any) | null; direction: 'ascending' | 'descending' }>({
    key: null,
    direction: 'ascending',
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);

  // --- LOGIKA RENDER & HELPER ---
  const getKeyValue = useCallback((i: T): string | number => {
    if (typeof uniqueIdKey === 'function') {
        return uniqueIdKey(i);
    }
    // Type assertion is safe here because T extends Record<string, any>
    // and the prop type ensures uniqueIdKey is a key of T.
    return i[uniqueIdKey as keyof T] as string | number;
  }, [uniqueIdKey]);

  const getCellContent = useCallback((item: T, column: ColumnDef<T>): any => {
    if (column.render) {
      return column.render(item);
    }
    if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }
    return item[column.accessor as keyof T];
  }, []);
  
  const getRawCellContent = useCallback((item: T, column: ColumnDef<T>): any => {
     if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }
    return item[column.accessor as keyof T];
  }, [])

  const getColumnByHeader = useCallback((header: string) => columns.find(c => c.header === header), [columns]);

  const getColumnDataType = useCallback((column: ColumnDef<T> | undefined, data: T[]): 'string' | 'number' | 'date' => {
    if (!column || data.length === 0) return 'string';
    const firstItem = data[0];
    let sampleValue = getRawCellContent(firstItem, column);

    if (typeof sampleValue === 'number') return 'number';
    if (typeof sampleValue === 'string') {
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(sampleValue)) {
        return 'date';
      }
    }
    return 'string';
  }, [getRawCellContent]);

  const operators: Record<'string' | 'number' | 'date', { value: Operator, label: string }[]> = {
    string: [
        { value: 'contains', label: 'Mengandung' },
        { value: 'not_contains', label: 'Tidak mengandung' },
        { value: 'equals', label: 'Sama dengan' },
        { value: 'not_equals', label: 'Tidak sama dengan' },
        { value: 'starts_with', label: 'Dimulai dengan' },
        { value: 'ends_with', label: 'Diakhiri dengan' },
    ],
    number: [
        { value: 'equals', label: '=' },
        { value: 'not_equals', label: '!=' },
        { value: 'gt', label: '>' },
        { value: 'gte', label: '>=' },
        { value: 'lt', label: '<' },
        { value: 'lte', label: '<=' },
        { value: 'between', label: 'Antara' },
    ],
    date: [
        { value: 'equals', label: 'Pada tanggal' },
        { value: 'gt', label: 'Setelah' },
        { value: 'lt', label: 'Sebelum' },
        { value: 'between', label: 'Antara' },
    ],
};

  // --- PEMROSESAN DATA (MEMOIZED) ---
  const processedData = useMemo(() => {
    let filteredItems = [...data];

    // 1. Terapkan filter lanjutan
    if (filterConditions.length > 0) {
      filteredItems = filteredItems.filter(item => {
        return filterConditions.every(condition => {
          if (!condition.field || !condition.operator) return true;
          const column = getColumnByHeader(condition.field);
          if (!column) return true;
    
          const dataType = getColumnDataType(column, data);
          const rawItemValue = getRawCellContent(item, column); // Untuk logika numerik/tanggal
          const displayItemValue = getCellContent(item, column); // Untuk logika string & tampilan
    
          const val1 = condition.value;
          const val2 = condition.value2;
    
          // Normalisasi nilai string untuk perbandingan
          const displayItemValueStr = String(displayItemValue ?? '').toLowerCase();
          const val1Str = String(val1 ?? '').toLowerCase();
    
          // Normalisasi nilai numerik untuk perbandingan
          const numericVal1 = parseFloat(val1);
          const numericVal2 = parseFloat(val2);
    
          switch (condition.operator) {
            // Operator string pada nilai yang ditampilkan
            case 'contains': return displayItemValueStr.includes(val1Str);
            case 'not_contains': return !displayItemValueStr.includes(val1Str);
            case 'starts_with': return displayItemValueStr.startsWith(val1Str);
            case 'ends_with': return displayItemValueStr.endsWith(val1Str);
    
            // Operator yang bergantung pada tipe
            case 'equals':
              if (dataType === 'number') return rawItemValue == numericVal1; // Persamaan longgar untuk "100" == 100
              if (dataType === 'date') return String(rawItemValue ?? '').startsWith(val1); // Bandingkan dengan YYYY-MM-DD asli
              return displayItemValueStr === val1Str;
            
            case 'not_equals':
              if (dataType === 'number') return rawItemValue != numericVal1;
              if (dataType === 'date') return !String(rawItemValue ?? '').startsWith(val1);
              return displayItemValueStr !== val1Str;
    
            // Operator numerik/tanggal pada nilai mentah
            case 'gt': return rawItemValue > (dataType === 'date' ? val1 : numericVal1);
            case 'gte': return rawItemValue >= (dataType === 'date' ? val1 : numericVal1);
            case 'lt': return rawItemValue < (dataType === 'date' ? val1 : numericVal1);
            case 'lte': return rawItemValue <= (dataType === 'date' ? val1 : numericVal1);
            case 'between':
              if (dataType === 'date') return rawItemValue >= val1 && rawItemValue <= val2;
              return rawItemValue >= numericVal1 && rawItemValue <= numericVal2;
    
            default: return true;
          }
        });
      });
    }

    // 2. Terapkan pencarian global (Hanya jika tidak disembunyikan dan pencarian manual tidak aktif)
    // Jika manualPagination aktif, kita asumsikan pencarian sudah ditangani server, 
    // TAPI jika hideSearch false, user mungkin masih ingin memfilter halaman saat ini.
    if (searchTerm && !hideSearch) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      filteredItems = filteredItems.filter(item => {
        return columns.some(col => {
          const value = getCellContent(item, col);
          return String(value).toLowerCase().includes(lowercasedSearchTerm);
        });
      });
    }

    // 3. Urutkan data
    if (sortConfig.key) {
      const key = sortConfig.key;
      filteredItems.sort((a, b) => {
        let aValue = typeof key === 'function' ? key(a) : a[key as keyof T];
        let bValue = typeof key === 'function' ? key(b) : b[key as keyof T];
        
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return filteredItems;
  }, [data, filterConditions, searchTerm, sortConfig, columns, getColumnByHeader, getRawCellContent, getColumnDataType, getCellContent, hideSearch]);
  
  // 4. Paginasi data
  const paginatedData = useMemo(() => {
    if (manualPagination) {
      return processedData;
    }
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize, manualPagination]);

  const totalPages = manualPagination 
    ? Math.ceil(totalItems / pageSize) 
    : Math.ceil(processedData.length / pageSize);

  // --- FUNGSI HANDLER ---
  const handleSort = (key: keyof T | ((item: T) => any) ) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      if (manualPagination && onManualPageChange) {
        onManualPageChange(newPage);
      }
    }
  };

  const handleAddFilter = () => {
    const firstColumn = columns[0];
    const firstDataType = getColumnDataType(firstColumn, data);
    setFilterConditions(prev => [...prev, {
      id: Date.now(),
      field: firstColumn.header,
      operator: operators[firstDataType][0].value,
      value: '',
    }]);
  };
  
  const handleUpdateFilter = (id: number, newValues: Partial<FilterCondition>) => {
    setFilterConditions(prev => prev.map(cond => {
      if (cond.id === id) {
        const updatedCond = { ...cond, ...newValues };
        if ('field' in newValues) {
          const column = getColumnByHeader(newValues.field!);
          const dataType = getColumnDataType(column, data);
          updatedCond.operator = operators[dataType][0].value;
          updatedCond.value = '';
          updatedCond.value2 = '';
        }
        return updatedCond;
      }
      return cond;
    }));
  };
  
  const handleRemoveFilter = (id: number) => {
    setFilterConditions(prev => prev.filter(cond => cond.id !== id));
  };
  
  const handleClearFilters = () => {
    setFilterConditions([]);
  };

  const handleExport = useCallback((format: 'csv' | 'excel') => {
    const dataToExport = processedData; // Use processed (filtered & sorted) data
    if (dataToExport.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const getTextFromNode = (node: React.ReactNode): string => {
        if (typeof node === 'string' || typeof node === 'number') return String(node);
        if (Array.isArray(node)) return node.map(getTextFromNode).join('');
        if (React.isValidElement(node) && (node.props as any).children) return getTextFromNode((node.props as any).children);
        return '';
    };

    if (format === 'csv') {
      const headers = columns.map(c => c.header);
      const csvRows = [headers.join(',')];
      dataToExport.forEach(item => {
        const row = columns.map(col => {
          let value = getCellContent(item, col);
          if (typeof value === 'object' && value !== null) value = getTextFromNode(value);
          const stringValue = String(value ?? '').replace(/"/g, '""');
          return `"${stringValue}"`;
        });
        csvRows.push(row.join(','));
      });
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${title?.toLowerCase().replace(/\s/g, '_') || 'export'}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } else if (format === 'excel') {
      const tableHeader = `<tr>${columns.map(c => `<th>${c.header}</th>`).join('')}</tr>`;
      const tableRows = dataToExport.map(item => {
          const cells = columns.map(col => {
              let value = getCellContent(item, col);
              if (typeof value === 'object' && value !== null) value = getTextFromNode(value);
              return `<td>${String(value ?? '')}</td>`;
          }).join('');
          return `<tr>${cells}</tr>`;
      }).join('');
      const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${title || 'Sheet1'}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table></body></html>`;
      const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${title?.toLowerCase().replace(/\s/g, '_') || 'export'}.xls`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  }, [processedData, columns, getCellContent, title]);

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-slate-200">
        {title && <h1 className="text-xl lg:text-2xl font-bold text-slate-800 mb-4 sm:mb-0">{title}</h1>}
        <div className="flex flex-col sm:flex-row items-center w-full sm:w-auto space-y-2 sm:space-y-0 sm:space-x-3">
            {!hideSearch && (
              <div className="relative w-full sm:w-auto">
                  <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari cepat..."
                    className="form-input w-full sm:w-auto pl-10 pr-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 transition duration-150 text-sm"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    aria-label={`Cari cepat di tabel ${title || ''}`}
                  />
              </div>
            )}
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex-shrink-0 w-full sm:w-auto flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium transition-colors ${isFilterOpen ? 'bg-sky-100 border-sky-300 text-sky-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
                <FilterIcon className="w-5 h-5 mr-2"/>
                Filter {filterConditions.length > 0 && `(${filterConditions.length})`}
            </button>
            <div className="relative w-full sm:w-auto">
                <select 
                  onChange={(e) => { const f = e.target.value; if (f === 'csv' || f === 'excel') handleExport(f); e.target.value = "default"; }}
                  className="form-select appearance-none w-full sm:w-auto pl-3 pr-8 py-2 text-sm border-slate-300 rounded-md shadow-sm bg-white text-slate-700 hover:bg-slate-50 font-medium"
                >
                  <option value="default">Export</option>
                  <option value="csv">CSV</option>
                  <option value="excel">Excel (.xls)</option>
                </select>
                <ChevronDownIcon className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"/>
            </div>
            {headerActions}
        </div>
      </div>
      
      {isFilterOpen && (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 my-4 animate-fade-in space-y-3">
          {filterConditions.map((condition, index) => {
            const column = getColumnByHeader(condition.field);
            const dataType = getColumnDataType(column, data);
            const needsTwoValues = condition.operator === 'between';
            return (
              <div key={condition.id} className="flex flex-col md:flex-row items-center gap-2 bg-white p-2 border rounded-md">
                <select value={condition.field} onChange={e => handleUpdateFilter(condition.id, { field: e.target.value })} className="form-select text-sm py-1.5 w-full md:w-1/4">
                  {columns.map(c => <option key={c.header} value={c.header}>{c.header}</option>)}
                </select>
                <select value={condition.operator} onChange={e => handleUpdateFilter(condition.id, { operator: e.target.value as Operator })} className="form-select text-sm py-1.5 w-full md:w-1/4">
                  {operators[dataType].map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                <div className={`flex gap-2 w-full ${needsTwoValues ? 'md:w-2/5' : 'md:w-2/5'}`}>
                  <input type={dataType === 'date' ? 'date' : dataType === 'number' ? 'number' : 'text'} value={condition.value} onChange={e => handleUpdateFilter(condition.id, { value: e.target.value })} className="form-input text-sm py-1.5 w-full"/>
                  {needsTwoValues && <input type={dataType === 'date' ? 'date' : dataType === 'number' ? 'number' : 'text'} value={condition.value2} onChange={e => handleUpdateFilter(condition.id, { value2: e.target.value })} className="form-input text-sm py-1.5 w-full"/>}
                </div>
                <button onClick={() => handleRemoveFilter(condition.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-md w-full md:w-auto"><TrashIcon className="w-4 h-4 mx-auto"/></button>
              </div>
            );
          })}
          <div className="flex items-center space-x-2 pt-2">
            <button onClick={handleAddFilter} className="flex items-center text-sm font-medium text-sky-600 hover:text-sky-800 p-1.5 rounded-md hover:bg-sky-100">
              <PlusCircleIcon className="w-5 h-5 mr-1"/> Tambah Filter
            </button>
            {filterConditions.length > 0 && (
                <button onClick={handleClearFilters} className="text-sm font-medium text-slate-600 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-200">
                    Hapus Semua
                </button>
            )}
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.accessor)}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.accessor)}
                      className="flex items-center space-x-1 group font-medium"
                      aria-label={`Urutkan berdasarkan ${col.header}`}
                    >
                      <span>{col.header}</span>
                      {sortConfig.key === col.accessor ? (
                        sortConfig.direction === 'ascending' ? (
                          <ArrowUpIcon className="w-4 h-4 text-sky-600" />
                        ) : (
                          <ArrowDownIcon className="w-4 h-4 text-sky-600" />
                        )
                      ) : (
                        <ArrowUpIcon className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {renderActions && (
                 <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, index) => {
                const itemKey = getKeyValue(item);
                const isActive = activeItem && getKeyValue(activeItem as T) === itemKey;
                return (
                  <tr
                    key={itemKey}
                    className={`transition-colors duration-150 ${onRowClick ? 'cursor-pointer hover:bg-sky-50' : 'hover:bg-slate-50'} ${isActive ? 'bg-sky-100 ring-2 ring-sky-300' : ''}`}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                  >
                    {columns.map((col, colIndex) => (
                      <td key={`${String(col.accessor)}-${itemKey}-${colIndex}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {getCellContent(item, col)}
                      </td>
                    ))}
                    {renderActions && (
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                          {renderActions(item)}
                       </td>
                    )}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} className="px-4 py-10 text-center text-sm text-slate-500">
                  Tidak ada data ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginasi */}
      {totalPages > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 text-sm">
            <div className="text-slate-600 mb-4 sm:mb-0">
                Total: <span className="font-medium">{manualPagination ? totalItems : processedData.length}</span>
            </div>
            <div className="flex items-center space-x-1">
                 <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-50" aria-label="Halaman pertama"><ChevronDoubleLeftIcon className="w-5 h-5 text-slate-600"/></button>
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-50" aria-label="Halaman sebelumnya"><ChevronLeftIcon className="w-5 h-5 text-slate-600"/></button>
                <div className="flex items-center space-x-2 px-2">
                    <select 
                        value={pageSize} 
                        onChange={(e) => { 
                            const newSize = Number(e.target.value);
                            setPageSize(newSize); 
                            setCurrentPage(1); 
                            if (manualPagination && onManualPageSizeChange) {
                                onManualPageSizeChange(newSize);
                                if (onManualPageChange) onManualPageChange(1);
                            }
                        }} 
                        className="form-select py-1 pl-2 pr-7 border-slate-300 rounded-md shadow-sm" 
                        aria-label="Item per halaman"
                    >
                        {[10, 25, 50, 100].map(size => (<option key={size} value={size}>{size}</option>))}
                    </select>
                    <span className="text-slate-600">{currentPage} of {totalPages || 1}</span>
                </div>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-50" aria-label="Halaman berikutnya"><ChevronRightIcon className="w-5 h-5 text-slate-600"/></button>
                <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-50" aria-label="Halaman terakhir"><ChevronDoubleRightIcon className="w-5 h-5 text-slate-600"/></button>
            </div>
        </div>
      )}
    </>
  );
}

export default TabelFiturStandar;