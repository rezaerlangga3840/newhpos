// FRONTEND: Komponen ini mengelola UI untuk mengatur struktur menu navigasi aplikasi.
// Fungsinya adalah memungkinkan pengguna (dengan hak akses) untuk menambah, mengedit, menghapus,
// dan mengubah urutan item menu. Perubahan disimpan ke dalam MenuContext.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MenuItem as MenuItemType, SubMenuItem, IconComponent } from '../../types';
import { useMenu } from '../../contexts/MenuContext';
import { deepClone, generateSlug } from '../../utils';
import { 
  PencilSquareIcon, 
  TrashIcon, 
  ArrowUpIcon, 
  ArrowDownIcon, 
  ChevronDownIcon, 
  ChevronRightIcon,
  ArrowDownTrayIcon, 
  ArrowPathIcon, 
  PlusCircleIcon, 
  XMarkIcon,
  ListBulletIcon
} from '../../components/icons';
import { INITIAL_MENU_DATA } from '../../constants'; // For icon mapping

// Helper to map icon components by name (string) - Static calculation outside component
const iconMap: Record<string, IconComponent | undefined> = {};
INITIAL_MENU_DATA.forEach(item => {
  if (item.icon && typeof item.icon === 'function') {
    iconMap[item.icon.name] = item.icon as IconComponent;
  }
  if (item.subItems) {
    item.subItems.forEach(sub => {
      if (sub.icon && typeof sub.icon === 'function') {
        iconMap[sub.icon.name] = sub.icon as IconComponent;
      }
    });
  }
});
// Create static options array once
const iconOptions = Object.keys(iconMap).sort();

const assignIconsToStrings = (items: (MenuItemType | SubMenuItem)[]): (MenuItemType | SubMenuItem)[] => {
    return items.map(item => {
        const newItem = { ...item };
        if (typeof newItem.icon === 'function' && (newItem.icon as IconComponent).name) {
            newItem.icon = (newItem.icon as IconComponent).name;
        }
        if ('subItems' in newItem && newItem.subItems) {
            newItem.subItems = assignIconsToStrings(newItem.subItems);
        }
        return newItem;
    });
};

const SettingsMenuListPage: React.FC = () => {
    const { menuData, updateMenuData } = useMenu();
    const [editableMenu, setEditableMenu] = useState<MenuItemType[]>([]);
    const [editingItem, setEditingItem] = useState<(MenuItemType | SubMenuItem) & { parentPath?: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setEditableMenu(deepClone(menuData));
    }, [menuData]);

    const handleExpandToggle = useCallback((path: string) => {
        setExpandedItems(prev => ({ ...prev, [path]: !prev[path] }));
    }, []);

    const handleMoveItem = useCallback((path: string, direction: 'up' | 'down', parentPath?: string) => {
        setEditableMenu(prevMenu => {
            const newMenu = deepClone(prevMenu);
            let itemsArray: (MenuItemType | SubMenuItem)[] = newMenu;

            if (parentPath) {
                const parent = newMenu.find(item => item.path === parentPath);
                if (parent && parent.subItems) {
                    itemsArray = parent.subItems;
                }
            }
            
            const index = itemsArray.findIndex(item => item.path === path);
            if (index === -1) return prevMenu;

            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= itemsArray.length) return prevMenu;

            [itemsArray[index], itemsArray[targetIndex]] = [itemsArray[targetIndex], itemsArray[index]];
            return newMenu;
        });
    }, []);

    const handleDeleteItem = useCallback((path: string, parentPath?: string) => {
        if (window.confirm('Apakah Anda yakin ingin menghapus item menu ini?')) {
            setEditableMenu(prevMenu => {
                let newMenu = deepClone(prevMenu);
                if (parentPath) {
                    const parent = newMenu.find(item => item.path === parentPath);
                    if (parent && parent.subItems) {
                        parent.subItems = parent.subItems.filter(sub => sub.path !== path);
                    }
                } else {
                    newMenu = newMenu.filter(item => item.path !== path);
                }
                return newMenu;
            });
        }
    }, []);

    const handleEditItem = useCallback((item: MenuItemType | SubMenuItem, parentPath?: string) => {
        setEditingItem({ ...item, parentPath });
        setIsModalOpen(true);
    }, []);

    const handleAddNewItem = useCallback((parentPath?: string) => {
        const newItem: Omit<MenuItemType, 'subItems'> & { parentPath?: string } = {
            name: '',
            path: parentPath ? `${parentPath}/new-item` : '/new-item',
            icon: '',
            parentPath: parentPath
        };
        if (parentPath) {
             (newItem as SubMenuItem).icon = '';
        } else {
            (newItem as MenuItemType).subItems = [];
        }
        setEditingItem(newItem as (MenuItemType | SubMenuItem) & { parentPath?: string });
        setIsModalOpen(true);
    }, []);

    const handleSaveItem = () => {
        if (!editingItem || !editingItem.name) {
            alert('Nama item menu wajib diisi.');
            return;
        }

        setEditableMenu(prevMenu => {
            let newMenu = deepClone(prevMenu);
            const { parentPath, ...itemData } = editingItem;

            if (parentPath) {
                const parent = newMenu.find(item => item.path === parentPath);
                if (parent && parent.subItems) {
                    const existingIndex = parent.subItems.findIndex(sub => sub.path === itemData.path);
                    if (existingIndex > -1) {
                        parent.subItems[existingIndex] = itemData as SubMenuItem;
                    } else {
                        parent.subItems.push({ ...itemData, path: `${parentPath}/${generateSlug(itemData.name)}` } as SubMenuItem);
                    }
                }
            } else {
                const existingIndex = newMenu.findIndex(item => item.path === itemData.path);
                if (existingIndex > -1) {
                    newMenu[existingIndex] = itemData as MenuItemType;
                } else {
                     const newPath = `/${generateSlug(itemData.name)}`;
                     if (newMenu.some(item => item.path === newPath)) {
                        alert(`Path "${newPath}" sudah ada. Silakan gunakan nama lain.`);
                        return prevMenu; // Return original if error
                     }
                    newMenu.push({ ...itemData, path: newPath, subItems: (itemData as MenuItemType).subItems || [] } as MenuItemType);
                }
            }
            return newMenu;
        });
        
        setIsModalOpen(false);
        setEditingItem(null);
    };
    
    const handleSaveToContext = () => {
        // Optimasi: Memproses data di luar main thread render jika datanya sangat besar (walaupun menu biasanya kecil)
        setTimeout(() => {
            const menuWithIconStrings = assignIconsToStrings(editableMenu);
            localStorage.setItem('hpos_menuConfig', JSON.stringify(menuWithIconStrings));
            
            const convertIcons = (items: any[]): any[] => {
              return items.map(item => {
                const newItem = { ...item };
                if (typeof newItem.icon === 'string' && iconMap[newItem.icon]) {
                  newItem.icon = iconMap[newItem.icon];
                } else if (typeof newItem.icon === 'string') {
                  delete newItem.icon;
                }
                if (newItem.subItems) {
                  newItem.subItems = convertIcons(newItem.subItems);
                }
                return newItem;
              });
            };
            
            const menuWithIconComponents = convertIcons(editableMenu);
            updateMenuData(menuWithIconComponents);
            alert('Konfigurasi menu berhasil disimpan!');
        }, 0);
    };

    const handleReset = () => {
        if (window.confirm('Anda yakin ingin mengembalikan menu ke pengaturan default pabrik? Perubahan yang belum disimpan akan hilang.')) {
            localStorage.removeItem('hpos_menuConfig');
            const defaultMenu = deepClone(INITIAL_MENU_DATA);
            setEditableMenu(defaultMenu);
            updateMenuData(defaultMenu);
        }
    };

    // Memoize the recursive render function to prevent unnecessary re-creations
    const renderMenuItem = useCallback((item: MenuItemType, index: number, total: number, parentPath?: string) => {
        const isParent = !!item.subItems;
        const isExpanded = isParent && expandedItems[item.path];
        
        return (
            <div key={item.path} className={`rounded-lg ${parentPath ? 'bg-slate-50 border border-slate-200' : 'bg-white shadow-sm border'}`}>
                <div className="flex items-center p-3">
                    <div className="flex-grow flex items-center">
                         {isParent && (
                            <button onClick={() => handleExpandToggle(item.path)} className="mr-2 p-1 text-slate-500 hover:bg-slate-100 rounded-full">
                                {isExpanded ? <ChevronDownIcon className="w-5 h-5"/> : <ChevronRightIcon className="w-5 h-5"/>}
                            </button>
                        )}
                        <span className={`font-medium ${parentPath ? 'text-slate-700' : 'text-slate-800'}`}>{item.name}</span>
                        <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono hidden sm:inline-block">{item.path}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <div className="flex flex-col space-y-1 mr-2">
                           <button onClick={() => handleMoveItem(item.path, 'up', parentPath)} disabled={index === 0} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowUpIcon className="w-4 h-4"/></button>
                           <button onClick={() => handleMoveItem(item.path, 'down', parentPath)} disabled={index === total - 1} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowDownIcon className="w-4 h-4"/></button>
                        </div>
                        <button onClick={() => handleEditItem(item, parentPath)} className="p-2 text-slate-500 hover:text-sky-600 transition-colors" title="Edit"><PencilSquareIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleDeleteItem(item.path, parentPath)} className="p-2 text-slate-500 hover:text-red-600 transition-colors" title="Hapus"><TrashIcon className="w-5 h-5"/></button>
                        {isParent && <button onClick={() => handleAddNewItem(item.path)} className="p-2 text-slate-500 hover:text-green-600 transition-colors" title="Tambah Sub-item"><PlusCircleIcon className="w-5 h-5"/></button>}
                    </div>
                </div>
                {isExpanded && item.subItems && (
                    <div className="pl-6 pr-3 pb-3 space-y-2 animate-fade-in">
                        {item.subItems.map((sub, subIndex) => renderMenuItem(sub as any, subIndex, item.subItems!.length, item.path))}
                    </div>
                )}
            </div>
        );
    }, [expandedItems, handleExpandToggle, handleMoveItem, handleEditItem, handleDeleteItem, handleAddNewItem]);

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 flex items-center">
                        <ListBulletIcon className="w-8 h-8 mr-3 text-sky-600"/> Menu List
                    </h1>
                     <button
                        onClick={() => handleAddNewItem()}
                        className="bg-sky-100 hover:bg-sky-200 text-sky-700 font-semibold py-2 px-3 rounded-md text-sm flex items-center transition duration-150 ease-in-out"
                        title="Add New Top-Level Menu Item"
                    >
                        <PlusCircleIcon className="w-5 h-5 mr-2" />
                        Add Top-Level Item
                    </button>
                </div>
                <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                    <button onClick={handleReset} className="flex items-center text-sm font-medium text-amber-600 hover:text-amber-800 p-2 rounded-lg hover:bg-amber-50 transition-colors">
                        <ArrowPathIcon className="w-5 h-5 mr-1.5"/> Reset to Default
                    </button>
                    <button onClick={handleSaveToContext} className="flex items-center text-sm font-medium text-white bg-green-600 hover:bg-green-700 p-2 rounded-lg shadow-sm transition-colors">
                        <ArrowDownTrayIcon className="w-5 h-5 mr-1.5"/> Simpan Konfigurasi
                    </button>
                </div>
            </div>
            
            <div className="space-y-3">
                {editableMenu.map((item, index) => renderMenuItem(item, index, editableMenu.length))}
            </div>

            {isModalOpen && editingItem && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg animate-fade-in">
                        <h2 className="text-xl font-semibold mb-4">{editingItem.path.includes('new-item') ? 'Tambah Item Baru' : 'Edit Item Menu'}</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="itemName" className="block text-sm font-medium text-slate-700">Nama Menu</label>
                                <input id="itemName" type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 text-sm focus:ring-sky-500 focus:border-sky-500" autoFocus />
                            </div>
                             <div>
                                <label htmlFor="itemIcon" className="block text-sm font-medium text-slate-700">Ikon Menu</label>
                                <select id="itemIcon" value={typeof editingItem.icon === 'string' ? editingItem.icon : (editingItem.icon as IconComponent)?.name || ''} onChange={e => setEditingItem({...editingItem, icon: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 text-sm focus:ring-sky-500 focus:border-sky-500">
                                    <option value="">-- Tanpa Ikon --</option>
                                    {iconOptions.map(iconName => (
                                        <option key={iconName} value={iconName}>{iconName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Batal</button>
                            <button onClick={handleSaveItem} className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm font-medium hover:bg-sky-700 transition-colors">Simpan</button>
                        </div>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default SettingsMenuListPage;