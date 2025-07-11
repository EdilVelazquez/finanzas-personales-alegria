import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  Target,
  PieChart
} from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { formatCurrency } from '@/lib/formatCurrency';
import { Account, Transaction } from '@/types';
import { ReportFilters } from '@/hooks/useReportFilters';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface IncomeExpensesReportProps {
  accounts: Account[];
  filters: ReportFilters;
}

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  net: number;
  date: Date;
}

interface CategoryData {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

const IncomeExpensesReport: React.FC<IncomeExpensesReportProps> = ({ accounts, filters }) => {
  const { transactions, loading, error } = useTransactions(filters, accounts);

  const analysis = useMemo(() => {
    if (!transactions.length) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        netFlow: 0,
        incomeCategories: [],
        expenseCategories: [],
        monthlyTrend: [],
        averageIncome: 0,
        averageExpenses: 0,
        savingsRate: 0
      };
    }

    // Filtrar transacciones virtuales
    const realTransactions = transactions.filter(t => !t.isVirtual);

    // Calcular totales
    const income = realTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = realTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netFlow = income - expenses;

    // Categorías de ingresos
    const incomeByCategory = realTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    const incomeCategories: CategoryData[] = Object.entries(incomeByCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        count: realTransactions.filter(t => t.type === 'income' && t.category === category).length,
        percentage: income > 0 ? (amount / income) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Categorías de gastos
    const expensesByCategory = realTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    const expenseCategories: CategoryData[] = Object.entries(expensesByCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        count: realTransactions.filter(t => t.type === 'expense' && t.category === category).length,
        percentage: expenses > 0 ? (amount / expenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Tendencia mensual (últimos 6 meses)
    const monthlyTrend: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthTransactions = realTransactions.filter(t => {
        const transactionDate = t.date instanceof Date ? t.date : new Date(t.date);
        return transactionDate >= monthStart && transactionDate <= monthEnd;
      });

      const monthIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const monthExpenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      monthlyTrend.push({
        month: format(monthDate, 'MMM yyyy', { locale: es }),
        income: monthIncome,
        expenses: monthExpenses,
        net: monthIncome - monthExpenses,
        date: monthDate
      });
    }

    // Promedios
    const monthsWithData = monthlyTrend.filter(m => m.income > 0 || m.expenses > 0).length;
    const averageIncome = monthsWithData > 0 ? income / monthsWithData : 0;
    const averageExpenses = monthsWithData > 0 ? expenses / monthsWithData : 0;

    // Tasa de ahorro
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netFlow,
      incomeCategories,
      expenseCategories,
      monthlyTrend,
      averageIncome,
      averageExpenses,
      savingsRate
    };
  }, [transactions]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-muted rounded-lg"></div>
            <div className="h-64 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Error al cargar los datos: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(analysis.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio: {formatCurrency(analysis.averageIncome)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(analysis.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio: {formatCurrency(analysis.averageExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flujo Neto</CardTitle>
            {analysis.netFlow >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analysis.netFlow >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(analysis.netFlow)}
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <Target className="h-3 w-3" />
              <p className="text-xs text-muted-foreground">
                Tasa de ahorro: {analysis.savingsRate.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tendencia mensual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Tendencia Mensual</span>
          </CardTitle>
          <CardDescription>
            Evolución de ingresos y gastos en los últimos 6 meses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysis.monthlyTrend.map((month, index) => (
              <div key={month.month} className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">{month.month}</h4>
                  <Badge variant={month.net >= 0 ? "default" : "destructive"}>
                    {formatCurrency(month.net)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-success">Ingresos</span>
                      <span className="font-medium">{formatCurrency(month.income)}</span>
                    </div>
                    <Progress 
                      value={month.income > 0 ? (month.income / Math.max(...analysis.monthlyTrend.map(m => m.income))) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-destructive">Gastos</span>
                      <span className="font-medium">{formatCurrency(month.expenses)}</span>
                    </div>
                    <Progress 
                      value={month.expenses > 0 ? (month.expenses / Math.max(...analysis.monthlyTrend.map(m => m.expenses))) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Análisis por categorías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorías de ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="h-5 w-5 text-success" />
              <span>Ingresos por Categoría</span>
            </CardTitle>
            <CardDescription>
              Distribución de fuentes de ingresos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.incomeCategories.length > 0 ? (
                analysis.incomeCategories.slice(0, 8).map((category) => (
                  <div key={category.category} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{category.category}</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatCurrency(category.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {category.percentage.toFixed(1)}% • {category.count} transacciones
                        </div>
                      </div>
                    </div>
                    <Progress value={category.percentage} className="h-2" />
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No hay ingresos en el período seleccionado
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Categorías de gastos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="h-5 w-5 text-destructive" />
              <span>Gastos por Categoría</span>
            </CardTitle>
            <CardDescription>
              Distribución de gastos por tipo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.expenseCategories.length > 0 ? (
                analysis.expenseCategories.slice(0, 8).map((category) => (
                  <div key={category.category} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{category.category}</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatCurrency(category.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {category.percentage.toFixed(1)}% • {category.count} transacciones
                        </div>
                      </div>
                    </div>
                    <Progress value={category.percentage} className="h-2" />
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No hay gastos en el período seleccionado
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights financieros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Análisis Financiero</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-success">Fortalezas</h4>
              <ul className="space-y-2 text-sm">
                {analysis.savingsRate > 20 && (
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span>Excelente tasa de ahorro ({analysis.savingsRate.toFixed(1)}%)</span>
                  </li>
                )}
                {analysis.netFlow > 0 && (
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span>Flujo de efectivo positivo</span>
                  </li>
                )}
                {analysis.incomeCategories.length > 1 && (
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span>Diversificación de ingresos</span>
                  </li>
                )}
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-amber-600">Oportunidades</h4>
              <ul className="space-y-2 text-sm">
                {analysis.savingsRate < 10 && analysis.netFlow > 0 && (
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                    <span>Mejorar tasa de ahorro (actual: {analysis.savingsRate.toFixed(1)}%)</span>
                  </li>
                )}
                {analysis.netFlow < 0 && (
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-destructive rounded-full"></div>
                    <span>Reducir gastos o aumentar ingresos</span>
                  </li>
                )}
                {analysis.expenseCategories.length > 0 && analysis.expenseCategories[0].percentage > 40 && (
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                    <span>Diversificar gastos (categoría principal: {analysis.expenseCategories[0].percentage.toFixed(1)}%)</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncomeExpensesReport;