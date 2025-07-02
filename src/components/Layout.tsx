import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, Home, CreditCard, ArrowUpDown, BarChart3, Tag } from 'lucide-react';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  const { logout, currentUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'accounts', name: 'Cuentas', icon: CreditCard },
    { id: 'transactions', name: 'Transacciones', icon: ArrowUpDown },
    { id: 'reports', name: 'Reportes', icon: BarChart3 },
    { id: 'categories', name: 'Categorías', icon: Tag }
  ];

  const handleMenuItemClick = (itemId: string) => {
    onPageChange(itemId);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Optimizado para móvil */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center">
              {/* Menú hamburguesa para móvil */}
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden p-2"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <div className="p-6 border-b">
                    <h2 className="text-lg font-bold text-blue-600">FinanzApp</h2>
                  </div>
                  <nav className="mt-4">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleMenuItemClick(item.id)}
                          className={`
                            w-full flex items-center px-6 py-4 text-left transition-colors
                            ${currentPage === item.id 
                              ? 'bg-blue-50 border-r-2 border-blue-500 text-blue-700' 
                              : 'text-gray-600 hover:bg-gray-50'
                            }
                          `}
                        >
                          <Icon className="h-5 w-5 mr-3" />
                          {item.name}
                        </button>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
              
              <h1 className="text-lg sm:text-xl font-bold text-blue-600 ml-2">FinanzApp</h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-xs sm:text-sm text-gray-600 hidden sm:block truncate max-w-32 lg:max-w-none">
                {currentUser?.email}
              </span>
              <Button variant="outline" size="sm" onClick={logout} className="text-xs sm:text-sm px-2 sm:px-4">
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-64 bg-white shadow-lg">
          <nav className="mt-8">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={`
                    w-full flex items-center px-6 py-3 text-left transition-colors
                    ${currentPage === item.id 
                      ? 'bg-blue-50 border-r-2 border-blue-500 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content - Responsivo */}
        <main className="flex-1 w-full min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
