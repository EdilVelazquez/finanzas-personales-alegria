
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, DollarSign, TrendingDown, TrendingUp, AlertTriangle, CreditCard } from 'lucide-react';
import { RecurringIncome, RecurringExpense, InstallmentPlan } from '@/types';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';

interface BudgetCalculatorProps {
  totalDebitBalance: number;
  totalCreditAvailable: number;
  recurringIncomes: RecurringIncome[];
  recurringExpenses: RecurringExpense[];
  installmentPlans: InstallmentPlan[];
}

const BudgetCalculator: React.FC<BudgetCalculatorProps> = ({
  totalDebitBalance,
  totalCreditAvailable,
  recurringIncomes,
  recurringExpenses,
  installmentPlans
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

  const getUpcomingExpensesUntilNextIncome = () => {
    const nextIncomeDate = getNextPaymentDate(recurringIncomes);
    if (!nextIncomeDate) return 0;

    // Gastos recurrentes
    const recurringTotal = recurringExpenses
      .filter(expense => expense.nextPaymentDate <= nextIncomeDate)
      .reduce((total, expense) => total + expense.amount, 0);

    // Pagos a meses que vencen antes del próximo ingreso
    const installmentTotal = installmentPlans
      .filter(plan => plan.isActive && plan.nextPaymentDate <= nextIncomeDate)
      .reduce((total, plan) => total + plan.monthlyAmount, 0);

    return recurringTotal + installmentTotal;
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

  const getMonthlyInstallmentPayments = () => {
    return installmentPlans
      .filter(plan => plan.isActive)
      .reduce((total, plan) => total + plan.monthlyAmount, 0);
  };

  const daysUntilPayment = getDaysUntilNextPayment();
  const monthlyIncome = getMonthlyRecurringIncome();
  const monthlyExpenses = getMonthlyRecurringExpenses();
  const monthlyInstallments = getMonthlyInstallmentPayments();
  const netMonthlyIncome = monthlyIncome - monthlyExpenses - monthlyInstallments;
  const upcomingExpenses = getUpcomingExpensesUntilNextIncome();
  
  // Dinero libre = Solo cuentas de débito - pagos próximos programados
  const freeMoney = totalDebitBalance - upcomingExpenses;
  const dailyBudget = Math.max(0, freeMoney / daysUntilPayment);

  const nextPaymentDate = getNextPaymentDate(recurringIncomes);
  const nextExpenseDate = getNextPaymentDate(recurringExpenses);

  return (
    <div className="space-y-6">
      {/* Resumen de balances separados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-gray-600">Pagos Próximos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrencyWithSymbol(upcomingExpenses)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Hasta el próximo ingreso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pagos a Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrencyWithSymbol(monthlyInstallments)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Mensual total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Dinero Libre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${freeMoney >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrencyWithSymbol(freeMoney)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Después de pagos programados</p>
          </CardContent>
        </Card>
      </div>

      {/* Crédito disponible como información adicional */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Crédito Disponible (TCS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-blue-600">
            {formatCurrencyWithSymbol(totalCreditAvailable)}
          </div>
          <p className="text-xs text-blue-600 mt-1">Línea de crédito disponible (no incluida en presupuesto diario)</p>
        </CardContent>
      </Card>

      {/* Desglose de pagos a meses activos */}
      {installmentPlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pagos a Meses Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {installmentPlans.map((plan) => (
                <div key={plan.id} className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{plan.description}</h4>
                      <p className="text-sm text-gray-600">
                        {plan.remainingInstallments} de {plan.installments} pagos restantes
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">
                        {formatCurrencyWithSymbol(plan.monthlyAmount)}
                      </p>
                      <p className="text-xs text-gray-500">mensual</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ 
                        width: `${((plan.installments - plan.remainingInstallments) / plan.installments) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {freeMoney >= 0 ? (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrencyWithSymbol(dailyBudget)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Límite diario de gastos</p>
                  <p className="text-xs text-gray-500">
                    Basado en dinero libre para {daysUntilPayment} días
                  </p>
                </div>
              ) : (
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                  <div className="text-xl font-bold text-red-600">
                    Sin presupuesto disponible
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Los pagos programados exceden el saldo de débito</p>
                  <p className="text-xs text-red-500">
                    Déficit: {formatCurrencyWithSymbol(Math.abs(freeMoney))}
                  </p>
                </div>
              )}
              
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
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Pagos a meses:</span>
                    <span className="font-medium text-blue-600">
                      -{formatCurrencyWithSymbol(monthlyInstallments)}
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
