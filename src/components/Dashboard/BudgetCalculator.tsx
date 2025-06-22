import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { RecurringIncome, RecurringExpense } from '@/types';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';

interface BudgetCalculatorProps {
  totalDebitBalance: number;
  totalCreditAvailable: number;
  recurringIncomes: RecurringIncome[];
  recurringExpenses: RecurringExpense[];
}

const BudgetCalculator: React.FC<BudgetCalculatorProps> = ({
  totalDebitBalance,
  totalCreditAvailable,
  recurringIncomes,
  recurringExpenses
}) => {
  const getNextPaymentDate = (items: (RecurringIncome | RecurringExpense)[]) => {
    const dates = items.map(item => item.nextPaymentDate).filter(date => date > new Date());
    return dates.length > 0 ? new Date(Math.min(...dates.map(date => date.getTime()))) : null;
  };

  const getDaysUntilNextPayment = () => {
    const nextPayment = getNextPaymentDate(recurringIncomes);
    if (!nextPayment) return 30; // Default to 30 days if no payment scheduled
    
    const today = new Date();
    const diffTime = nextPayment.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  };

  const getMonthlyRecurringIncome = () => {
    return recurringIncomes.reduce((total, income) => {
      switch (income.frequency) {
        case 'weekly': return total + (income.amount * 4.33);
        case 'biweekly': return total + (income.amount * 2.17);
        case 'monthly': return total + income.amount;
        default: return total;
      }
    }, 0);
  };

  const getMonthlyRecurringExpenses = () => {
    return recurringExpenses.reduce((total, expense) => {
      switch (expense.frequency) {
        case 'weekly': return total + (expense.amount * 4.33);
        case 'biweekly': return total + (expense.amount * 2.17);
        case 'monthly': return total + expense.amount;
        default: return total;
      }
    }, 0);
  };

  const daysUntilPayment = getDaysUntilNextPayment();
  const monthlyIncome = getMonthlyRecurringIncome();
  const monthlyExpenses = getMonthlyRecurringExpenses();
  const netMonthlyIncome = monthlyIncome - monthlyExpenses;
  const availableMoney = totalDebitBalance + totalCreditAvailable;
  const dailyBudget = availableMoney / daysUntilPayment;

  const nextPaymentDate = getNextPaymentDate(recurringIncomes);
  const nextExpenseDate = getNextPaymentDate(recurringExpenses);

  return (
    <div className="space-y-6">
      {/* Resumen de balances separados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Dinero en Débito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrencyWithSymbol(totalDebitBalance)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Dinero real disponible</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Crédito Disponible (TCS)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrencyWithSymbol(totalCreditAvailable)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Línea de crédito disponible</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrencyWithSymbol(availableMoney)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Débito + Crédito disponible</p>
          </CardContent>
        </Card>
      </div>

      {/* Presupuesto diario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Presupuesto Diario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrencyWithSymbol(dailyBudget)}
                </div>
                <p className="text-sm text-gray-600 mt-1">Límite diario de gastos</p>
                <p className="text-xs text-gray-500">
                  Basado en {daysUntilPayment} días hasta el próximo pago
                </p>
              </div>
              
              {nextPaymentDate && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-600">Próximo Ingreso</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {nextPaymentDate.toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-3">Resumen Mensual</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Ingresos fijos:</span>
                    <span className="font-medium text-green-600">
                      +{formatCurrencyWithSymbol(monthlyIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Gastos recurrentes:</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrencyWithSymbol(monthlyExpenses)}
                    </span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Neto mensual:</span>
                    <span className={`font-bold ${netMonthlyIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrencyWithSymbol(netMonthlyIncome)}
                    </span>
                  </div>
                </div>
              </div>

              {nextExpenseDate && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-600">Próximo Pago Recurrente</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {nextExpenseDate.toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetCalculator;
