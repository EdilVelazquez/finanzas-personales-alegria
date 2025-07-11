
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, PieChart, Calendar, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ReportFilters from './ReportFilters';
import FinancialSummaryReport from './FinancialSummaryReport';
import IncomeExpensesReport from './IncomeExpensesReport';
import { useReportFilters } from '@/hooks/useReportFilters';
import { Account } from '@/types';

const ReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { filters, updateFilters } = useReportFilters();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null);

  // Cargar cuentas del usuario
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!currentUser) return;
      
      try {
        const accountsRef = collection(db, 'users', currentUser.uid, 'accounts');
        const snapshot = await getDocs(accountsRef);
        const accountsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Account[];
        setAccounts(accountsData);
      } catch (error) {
        console.error('Error fetching accounts:', error);
      }
    };

    fetchAccounts();
  }, [currentUser]);

  const reportTypes = [
    {
      id: 'financial-summary',
      title: 'Resumen Financiero',
      description: 'Saldo total de cuentas y disponible de crédito',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      id: 'income-expenses',
      title: 'Ingresos y Gastos',
      description: 'Análisis por períodos de tiempo',
      icon: TrendingUp,
      color: 'text-blue-600'
    },
    {
      id: 'categories',
      title: 'Por Categorías',
      description: 'Desglose de gastos por categoría',
      icon: PieChart,
      color: 'text-purple-600'
    },
    {
      id: 'trends',
      title: 'Tendencias',
      description: 'Gráficos de evolución temporal',
      icon: Calendar,
      color: 'text-orange-600'
    }
  ];

  const handleReportTypeSelect = (reportId: string) => {
    setSelectedReportType(reportId);
    setShowFilters(true);
  };

  const renderReportContent = () => {
    if (!selectedReportType) {
      return (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Selecciona un tipo de reporte para comenzar el análisis
          </p>
        </div>
      );
    }

    switch (selectedReportType) {
      case 'financial-summary':
        return <FinancialSummaryReport accounts={accounts} filters={filters} />;
      case 'income-expenses':
        return <IncomeExpensesReport accounts={accounts} filters={filters} />;
      default:
        return (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              Este tipo de reporte estará disponible próximamente
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600 mt-1">Analiza tus finanzas con reportes detallados</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="sm:w-auto"
        >
          <Filter className="h-4 w-4 mr-2" />
          {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
        </Button>
      </div>

      {/* Filtros */}
      {showFilters && (
        <ReportFilters
          filters={filters}
          onFiltersChange={updateFilters}
          accounts={accounts}
        />
      )}

      {/* Sección de tipos de reportes disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <Card 
              key={report.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                selectedReportType === report.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleReportTypeSelect(report.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <Icon className={`h-5 w-5 ${report.color}`} />
                  <CardTitle className="text-sm font-medium">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  {report.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Área principal de contenido */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedReportType 
              ? `Reporte: ${reportTypes.find(r => r.id === selectedReportType)?.title}`
              : 'Selecciona un tipo de reporte'
            }
          </CardTitle>
          <CardDescription>
            {selectedReportType 
              ? 'Datos basados en los filtros aplicados'
              : 'Elige un tipo de reporte de las opciones anteriores para comenzar'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderReportContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
