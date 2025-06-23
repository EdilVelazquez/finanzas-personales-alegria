
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, PieChart, Calendar } from 'lucide-react';

const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600 mt-1">Analiza tus finanzas con reportes detallados</p>
        </div>
      </div>

      {/* Sección de tipos de reportes disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <CardTitle className="text-sm font-medium">Resumen Financiero</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Saldo total de cuentas y disponible de crédito
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-medium">Ingresos y Gastos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Análisis por períodos de tiempo
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <PieChart className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-sm font-medium">Por Categorías</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Desglose de gastos por categoría
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm font-medium">Tendencias</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              Gráficos de evolución temporal
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Área principal de contenido */}
      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>
            Los reportes detallados estarán disponibles en las próximas actualizaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              Estamos trabajando en traerte análisis detallados de tus finanzas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
