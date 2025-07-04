import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, DollarSign, TrendingDown, TrendingUp, AlertTriangle, CreditCard, X } from 'lucide-react';
import { RecurringIncome, RecurringExpense, InstallmentPlan, Account } from '@/types';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';

interface BudgetCalculatorProps {
  totalDebitBalance: number;
  totalCreditAvailable: number;
  recurringIncomes: RecurringIncome[];
  recurringExpenses: RecurringExpense[];
  installmentPlans: InstallmentPlan[];
  accounts?: Account[];
}

type ModalType = 'debit' | 'payments' | 'installments' | 'free' | null;

const BudgetCalculator: React.FC<BudgetCalculatorProps> = ({
  totalDebitBalance,
  totalCreditAvailable,
  recurringIncomes,
  recurringExpenses,
  installmentPlans,
  accounts = []
}) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const getNextPaymentDate = (items: (RecurringIncome | RecurringExpense)[]) => {
    const dates = items.map(item => item.nextPaymentDate).filter(date => date > new Date());
    return dates.length > 0 ? new Date(Math.min(...dates.map(date => date.getTime()))) : null;
  };

  const getDaysUntilNextPayment = () => {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const diffTime = endOfMonth.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays); // Días restantes del mes
  };

  const getUpcomingExpensesUntilNextIncome = () => {
    // Calcular pagos para el resto del mes
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    let recurringTotal = 0;
    
    recurringExpenses.forEach(expense => {
      if (expense.frequency === 'weekly') {
        // Para pagos semanales, calcular todos los pagos que caen en el mes
        const weeklyPayments = getWeeklyPaymentsInMonth(expense.nextPaymentDate, endOfMonth);
        recurringTotal += weeklyPayments.length * expense.amount;
      } else {
        // Para pagos mensuales y bisemanales, solo el próximo pago si está en el mes
        if (expense.nextPaymentDate <= endOfMonth) {
          recurringTotal += expense.amount;
        }
      }
    });

    const installmentTotal = installmentPlans
      .filter(plan => plan.isActive && plan.nextPaymentDate <= endOfMonth)
      .reduce((total, plan) => total + plan.monthlyAmount, 0);

    // Agregar pagos de cuentas de deuda
    const debtPaymentsTotal = accounts
      .filter(account => account.type === 'debt' && account.nextPaymentDate && account.nextPaymentDate <= endOfMonth)
      .reduce((total, account) => total + (account.monthlyPayment || 0), 0);

    return recurringTotal + installmentTotal + debtPaymentsTotal;
  };

  const getUpcomingIncomesUntilNextPayment = () => {
    // Calcular ingresos para el resto del mes
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    let recurringIncomeTotal = 0;
    
    recurringIncomes.forEach(income => {
      if (income.frequency === 'weekly') {
        // Para ingresos semanales, calcular todos los ingresos que caen en el mes
        const weeklyPayments = getWeeklyPaymentsInMonth(income.nextPaymentDate, endOfMonth);
        recurringIncomeTotal += weeklyPayments.length * income.amount;
      } else {
        // Para ingresos mensuales y bisemanales, solo el próximo ingreso si está en el mes
        if (income.nextPaymentDate <= endOfMonth) {
          recurringIncomeTotal += income.amount;
        }
      }
    });

    return recurringIncomeTotal;
  };

  const getWeeklyPaymentsInMonth = (nextPaymentDate: Date, endOfMonth: Date) => {
    const payments = [];
    let currentDate = new Date(nextPaymentDate);
    
    while (currentDate <= endOfMonth) {
      payments.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 7); // Agregar 7 días
    }
    
    return payments;
  };

  const getMonthlyRecurringIncome = () => {
    return recurringIncomes.reduce((total, income) => {
      switch (income.frequency) {
        case 'weekly': return total + (income.amount * 4); // 4 semanas
        case 'biweekly': return total + (income.amount * 2); // 2 quincenas
        case 'monthly': return total + income.amount; // Ya es mensual
        default: return total;
      }
    }, 0);
  };

  const getMonthlyRecurringExpenses = () => {
    return recurringExpenses.reduce((total, expense) => {
      switch (expense.frequency) {
        case 'weekly': return total + (expense.amount * 4); // 4 semanas
        case 'biweekly': return total + (expense.amount * 2); // 2 quincenas
        case 'monthly': return total + expense.amount; // Ya es mensual
        default: return total;
      }
    }, 0);
  };

  const getMonthlyInstallmentPayments = () => {
    return installmentPlans
      .filter(plan => plan.isActive)
      .reduce((total, plan) => total + plan.monthlyAmount, 0); // Pago mensual completo
  };

  const daysUntilPayment = getDaysUntilNextPayment();
  const monthlyIncome = getMonthlyRecurringIncome();
  const monthlyExpenses = getMonthlyRecurringExpenses();
  const monthlyInstallments = getMonthlyInstallmentPayments();
  
  // Calcular dinero apartado para gastos mensuales
  const moneyForExpenses = monthlyExpenses + monthlyInstallments;
  
  // Dinero libre después de gastos programados
  const netMonthlyIncome = monthlyIncome - moneyForExpenses;
  const upcomingExpenses = getUpcomingExpensesUntilNextIncome();
  const upcomingIncomes = getUpcomingIncomesUntilNextPayment();
  
  // Dinero libre = dinero actual - gastos programados + ingresos próximos
  const freeMoney = totalDebitBalance - upcomingExpenses + upcomingIncomes;
  const dailyBudget = Math.max(0, freeMoney / daysUntilPayment); // Dividir entre días restantes del mes

  const nextPaymentDate = getNextPaymentDate(recurringIncomes);
  const nextExpenseDate = getNextPaymentDate(recurringExpenses);

  const debitAccounts = accounts.filter(acc => acc.type === 'debit');

  const handleCardClick = (modalType: ModalType) => {
    setActiveModal(activeModal === modalType ? null : modalType);
  };

  const renderModal = () => {
    if (!activeModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {activeModal === 'debit' && 'Dinero en Débito'}
              {activeModal === 'payments' && 'Pagos Próximos'}
              {activeModal === 'installments' && 'Pagos a Meses'}
              {activeModal === 'free' && 'Dinero Libre'}
            </h3>
            <button 
              onClick={() => setActiveModal(null)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="p-4">
            {activeModal === 'debit' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Dinero real disponible en tus cuentas de débito
                </p>
                {debitAccounts.map(account => (
                  <div key={account.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-medium">{account.name}</span>
                    <span className="font-bold text-green-600">
                      {formatCurrencyWithSymbol(account.balance)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-green-600 text-lg">
                      {formatCurrencyWithSymbol(totalDebitBalance)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'payments' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Pagos programados para el resto del mes
                </p>
                {recurringExpenses
                  .filter(expense => {
                    const today = new Date();
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    return expense.nextPaymentDate <= endOfMonth || expense.frequency === 'weekly';
                  })
                  .flatMap(expense => {
                    const today = new Date();
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    
                    if (expense.frequency === 'weekly') {
                      // Para pagos semanales, mostrar todos los pagos del mes
                      const weeklyPayments = getWeeklyPaymentsInMonth(expense.nextPaymentDate, endOfMonth);
                      return weeklyPayments.map((paymentDate, index) => ({
                        ...expense,
                        id: `${expense.id}-${index}`,
                        nextPaymentDate: paymentDate
                      }));
                    } else {
                      // Para otros tipos, solo el próximo pago
                      return [expense];
                    }
                  })
                  .sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime())
                  .map((expense, index) => {
                    const today = new Date();
                    const isOverdue = expense.nextPaymentDate < today;
                    const bgColors = ['bg-red-50', 'bg-orange-50', 'bg-pink-50', 'bg-rose-50'];
                    const textColors = ['text-red-600', 'text-orange-600', 'text-pink-600', 'text-rose-600'];
                    const bgColor = bgColors[index % bgColors.length];
                    const textColor = textColors[index % textColors.length];
                    
                    return (
                      <div key={expense.id} className={`flex justify-between items-center p-3 ${bgColor} rounded-lg ${isOverdue ? 'border-l-4 border-red-500' : ''}`}>
                        <div>
                          <span className="font-medium block">{expense.name}</span>
                          <span className="text-sm text-gray-600">
                            {expense.nextPaymentDate.toLocaleDateString('es-ES')}
                            {isOverdue && <span className="ml-2 text-red-500 font-medium">(Vencido)</span>}
                          </span>
                        </div>
                        <span className={`font-bold ${textColor}`}>
                          {formatCurrencyWithSymbol(expense.amount)}
                        </span>
                      </div>
                    );
                  })}
                
                {installmentPlans
                  .filter(plan => {
                    const today = new Date();
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    return plan.isActive && plan.nextPaymentDate <= endOfMonth;
                  })
                  .sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime())
                  .map((plan, index) => {
                    const today = new Date();
                    const isOverdue = plan.nextPaymentDate < today;
                    const bgColors = ['bg-blue-50', 'bg-indigo-50', 'bg-purple-50', 'bg-cyan-50'];
                    const textColors = ['text-blue-600', 'text-indigo-600', 'text-purple-600', 'text-cyan-600'];
                    const bgColor = bgColors[index % bgColors.length];
                    const textColor = textColors[index % textColors.length];
                    
                    return (
                      <div key={plan.id} className={`flex justify-between items-center p-3 ${bgColor} rounded-lg ${isOverdue ? 'border-l-4 border-red-500' : ''}`}>
                        <div>
                          <span className="font-medium block">{plan.description}</span>
                          <span className="text-sm text-gray-600">
                            {plan.nextPaymentDate.toLocaleDateString('es-ES')}
                            {isOverdue && <span className="ml-2 text-red-500 font-medium">(Vencido)</span>}
                          </span>
                        </div>
                        <span className={`font-bold ${textColor}`}>
                          {formatCurrencyWithSymbol(plan.monthlyAmount)}
                        </span>
                      </div>
                     );
                   })}
                
                {/* Pagos de cuentas de deuda */}
                {accounts
                  .filter(account => {
                    const today = new Date();
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    return account.type === 'debt' && account.nextPaymentDate && account.nextPaymentDate <= endOfMonth;
                  })
                  .sort((a, b) => a.nextPaymentDate!.getTime() - b.nextPaymentDate!.getTime())
                  .map((account, index) => {
                    const today = new Date();
                    const isOverdue = account.nextPaymentDate! < today;
                    const bgColors = ['bg-yellow-50', 'bg-amber-50', 'bg-orange-50'];
                    const textColors = ['text-yellow-600', 'text-amber-600', 'text-orange-600'];
                    const bgColor = bgColors[index % bgColors.length];
                    const textColor = textColors[index % textColors.length];
                    
                    return (
                      <div key={account.id} className={`flex justify-between items-center p-3 ${bgColor} rounded-lg ${isOverdue ? 'border-l-4 border-red-500' : ''}`}>
                        <div>
                          <span className="font-medium block">Pago {account.name}</span>
                          <span className="text-sm text-gray-600">
                            {account.nextPaymentDate!.toLocaleDateString('es-ES')}
                            {isOverdue && <span className="ml-2 text-red-500 font-medium">(Vencido)</span>}
                          </span>
                        </div>
                        <span className={`font-bold ${textColor}`}>
                          {formatCurrencyWithSymbol(account.monthlyPayment || 0)}
                        </span>
                      </div>
                    );
                  })}

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-red-600 text-lg">
                      {formatCurrencyWithSymbol(upcomingExpenses)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'installments' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Planes de pagos a meses sin intereses activos
                </p>
                {installmentPlans.filter(plan => plan.isActive).map(plan => (
                  <div key={plan.id} className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{plan.description}</h4>
                        <p className="text-sm text-gray-600">
                          {plan.remainingInstallments} de {plan.installments} pagos restantes
                        </p>
                        <p className="text-xs text-gray-500">
                          Próximo pago: {plan.nextPaymentDate.toLocaleDateString('es-ES')}
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
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Total mensual:</span>
                    <span className="font-bold text-blue-600 text-lg">
                      {formatCurrencyWithSymbol(monthlyInstallments)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'free' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Dinero disponible después de pagos programados
                </p>
                
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-green-50 rounded">
                    <span className="text-sm">Dinero en débito:</span>
                    <span className="font-medium text-green-600">
                      +{formatCurrencyWithSymbol(totalDebitBalance)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between p-2 bg-red-50 rounded">
                    <span className="text-sm">Pagos próximos:</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrencyWithSymbol(upcomingExpenses)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between p-2 bg-green-50 rounded">
                    <span className="text-sm">Ingresos próximos:</span>
                    <span className="font-medium text-green-600">
                      +{formatCurrencyWithSymbol(upcomingIncomes)}
                    </span>
                  </div>
                  
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Dinero libre:</span>
                      <span className={`font-bold text-lg ${freeMoney >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrencyWithSymbol(freeMoney)}
                      </span>
                    </div>
                  </div>
                  
                  {freeMoney >= 0 && (
                    <div className="bg-blue-50 p-3 rounded-lg mt-3">
                      <p className="text-sm text-gray-600">Presupuesto diario sugerido:</p>
                      <p className="font-bold text-blue-600 text-lg">
                        {formatCurrencyWithSymbol(dailyBudget)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Para los próximos {daysUntilPayment} días del mes
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Resumen de balances separados con funcionalidad de clic */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick('debit')}
        >
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

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick('payments')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pagos Próximos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrencyWithSymbol(upcomingExpenses)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {upcomingExpenses === 0 ? 'No hay pagos próximos' : 'Resto del mes'}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick('installments')}
        >
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

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick('free')}
        >
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
                      Basado en dinero libre para {daysUntilPayment} días restantes del mes
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
                    <span className="text-sm text-gray-600">Ingresos mensuales:</span>
                    <span className="font-medium text-green-600">
                      +{formatCurrencyWithSymbol(monthlyIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Gastos mensuales:</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrencyWithSymbol(monthlyExpenses)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">MSI mensuales:</span>
                    <span className="font-medium text-blue-600">
                      -{formatCurrencyWithSymbol(monthlyInstallments)}
                    </span>
                  </div>
                  <div className="flex justify-between bg-orange-100 p-2 rounded">
                    <span className="text-sm font-medium text-orange-700">Dinero apartado para gastos:</span>
                    <span className="font-bold text-orange-700">
                      -{formatCurrencyWithSymbol(moneyForExpenses)}
                    </span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Disponible para extras:</span>
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

      {/* Modal */}
      {renderModal()}
    </div>
  );
};

export default BudgetCalculator;
