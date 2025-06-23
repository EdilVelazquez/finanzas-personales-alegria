
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { Account, Transaction } from '@/types';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';
import { useTransactions } from '@/hooks/useTransactions';
import { ReportFilters } from '@/hooks/useReportFilters';

interface FinancialSummaryReportProps {
  accounts: Account[];
  filters: ReportFilters;
}

const FinancialSummaryReport: React.FC<FinancialSummaryReportProps> = ({
  accounts,
  filters
}) => {
  const { transactions, loading } = useTransactions(filters);

  // Calcular totales de cuentas
  const debitAccounts = accounts.filter(acc => acc.type === 'debit');
  const creditAccounts = accounts.filter(acc => acc.type === 'credit');

  const totalDebitBalance = debitAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalCreditUsed = creditAccounts.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
  const totalCreditLimit = creditAccounts.reduce((sum, acc) => sum + (acc.creditLimit || 0), 0);
  const totalCreditAvailable = totalCreditLimit - totalCreditUsed;

  // Calcular totales de transacciones (según filtros)
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpenses;

  const summaryCards = [
    {
      title: 'Saldo Total en Débito',
      value: totalDebitBalance,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Crédito Disponible',
      value: totalCreditAvailable,
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Ingresos',
      value: totalIncome,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Gastos',
      value: totalExpenses,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrencyWithSymbol(card.value)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumen de balance neto */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Neto del Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Ingresos: {formatCurrencyWithSymbol(totalIncome)}
              </p>
              <p className="text-sm text-gray-600">
                Gastos: {formatCurrencyWithSymbol(totalExpenses)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Balance:</p>
              <p className={`text-2xl font-bold ${
                netBalance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrencyWithSymbol(netBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalles de cuentas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cuentas de débito */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cuentas de Débito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {debitAccounts.map((account) => (
                <div key={account.id} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{account.name}</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatCurrencyWithSymbol(account.balance)}
                  </span>
                </div>
              ))}
              {debitAccounts.length === 0 && (
                <p className="text-sm text-gray-500">No hay cuentas de débito</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cuentas de crédito */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cuentas de Crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {creditAccounts.map((account) => {
                const used = Math.abs(account.balance);
                const limit = account.creditLimit || 0;
                const available = limit - used;
                const usagePercentage = limit > 0 ? (used / limit) * 100 : 0;
                
                return (
                  <div key={account.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{account.name}</span>
                      <span className="text-sm">
                        {formatCurrencyWithSymbol(available)} disponible
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          usagePercentage > 80 ? 'bg-red-500' :
                          usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Usado: {formatCurrencyWithSymbol(used)}</span>
                      <span>Límite: {formatCurrencyWithSymbol(limit)}</span>
                    </div>
                  </div>
                );
              })}
              {creditAccounts.length === 0 && (
                <p className="text-sm text-gray-500">No hay cuentas de crédito</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinancialSummaryReport;
