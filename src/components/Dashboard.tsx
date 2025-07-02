import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, Transaction, RecurringIncome, RecurringExpense, InstallmentPlan } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { useCategories } from '@/hooks/useCategories';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title
} from 'chart.js';
import BudgetCalculator from './Dashboard/BudgetCalculator';
import RecurringItemsManager from './Dashboard/RecurringItemsManager';
import RecurringIncomeForm from './Dashboard/RecurringIncomeForm';
import RecurringExpenseForm from './Dashboard/RecurringExpenseForm';
import DeleteRecurringDialog from './Dashboard/DeleteRecurringDialog';
import TransactionForm from './Transactions/TransactionForm';
import { Button } from '@/components/ui/button';
import { TrendingUp, Plus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title
);

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { categories } = useCategories();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [showRecurringItems, setShowRecurringItems] = useState(false);
  const [showQuickTransaction, setShowQuickTransaction] = useState(false);
  
  // Estados para los formularios
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState<RecurringIncome | null>(null);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [deletingItem, setDeletingItem] = useState<{
    item: RecurringIncome | RecurringExpense;
    type: 'income' | 'expense';
  } | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Escuchar cuentas
    const accountsQuery = query(
      collection(db, 'users', currentUser.uid, 'accounts')
    );
    
    const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Account[];
      setAccounts(accountsData);
    });

    // Escuchar transacciones recientes
    const recentTransactionsQuery = query(
      collection(db, 'users', currentUser.uid, 'transactions'),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribeRecentTransactions = onSnapshot(recentTransactionsQuery, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Transaction[];
      setRecentTransactions(transactionsData);
    });

    // Escuchar todas las transacciones para gráficas
    const allTransactionsQuery = query(
      collection(db, 'users', currentUser.uid, 'transactions'),
      orderBy('date', 'desc')
    );

    const unsubscribeAllTransactions = onSnapshot(allTransactionsQuery, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Transaction[];
      setAllTransactions(transactionsData);
    });

    // Escuchar ingresos recurrentes
    const recurringIncomesQuery = query(
      collection(db, 'users', currentUser.uid, 'recurringIncomes'),
      orderBy('nextPaymentDate', 'asc')
    );

    const unsubscribeRecurringIncomes = onSnapshot(recurringIncomesQuery, (snapshot) => {
      const incomesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        nextPaymentDate: doc.data().nextPaymentDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as RecurringIncome[];
      setRecurringIncomes(incomesData);
    });

    // Escuchar gastos recurrentes
    const recurringExpensesQuery = query(
      collection(db, 'users', currentUser.uid, 'recurringExpenses'),
      orderBy('nextPaymentDate', 'asc')
    );

    const unsubscribeRecurringExpenses = onSnapshot(recurringExpensesQuery, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        nextPaymentDate: doc.data().nextPaymentDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as RecurringExpense[];
      setRecurringExpenses(expensesData);
    });

    // Escuchar planes de pagos a meses
    const installmentPlansQuery = query(
      collection(db, 'users', currentUser.uid, 'installmentPlans'),
      where('isActive', '==', true),
      orderBy('nextPaymentDate', 'asc')
    );

    const unsubscribeInstallmentPlans = onSnapshot(installmentPlansQuery, (snapshot) => {
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        nextPaymentDate: doc.data().nextPaymentDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as InstallmentPlan[];
      setInstallmentPlans(plansData);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeRecentTransactions();
      unsubscribeAllTransactions();
      unsubscribeRecurringIncomes();
      unsubscribeRecurringExpenses();
      unsubscribeInstallmentPlans();
    };
  }, [currentUser]);

  const totalDebitBalance = accounts
    .filter(account => account.type === 'debit')
    .reduce((sum, account) => sum + account.balance, 0);

  const totalCreditAvailable = accounts
    .filter(account => account.type === 'credit')
    .reduce((sum, account) => sum + ((account.creditLimit || 0) - account.balance), 0);

  const totalDebt = accounts
    .filter(account => account.type === 'credit')
    .reduce((sum, account) => sum + account.balance, 0);

  const chartData = {
    labels: ['Débito', 'Crédito Disponible', 'Deuda'],
    datasets: [{
      data: [totalDebitBalance, totalCreditAvailable, totalDebt],
      backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  // Datos para gráfica de gastos por categoría (mes actual)
  const getCurrentMonthExpensesByCategory = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthExpenses = allTransactions.filter(t => 
      t.type === 'expense' && 
      t.date >= startOfMonth && 
      t.date <= endOfMonth
    );

    const categoryTotals: { [key: string]: number } = {};
    monthExpenses.forEach(expense => {
      categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Top 10 categorías

    return {
      labels: sortedCategories.map(([category]) => category),
      datasets: [{
        label: 'Gastos por Categoría',
        data: sortedCategories.map(([,amount]) => amount),
        backgroundColor: [
          '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
          '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16'
        ],
        borderWidth: 0
      }]
    };
  };

  // Datos para gráfica de tendencia mensual
  const getMonthlyTrend = () => {
    const last6Months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push(date);
    }

    const monthlyData = last6Months.map(month => {
      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      
      const monthTransactions = allTransactions.filter(t => 
        t.date >= startOfMonth && t.date <= endOfMonth
      );

      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month: month.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        income,
        expenses,
        balance: income - expenses
      };
    });

    return {
      labels: monthlyData.map(d => d.month),
      datasets: [
        {
          label: 'Ingresos',
          data: monthlyData.map(d => d.income),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: false,
          tension: 0.1
        },
        {
          label: 'Gastos',
          data: monthlyData.map(d => d.expenses),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: false,
          tension: 0.1
        }
      ]
    };
  };

  const expensesCategoryData = getCurrentMonthExpensesByCategory();
  const monthlyTrendData = getMonthlyTrend();

  // Funciones para manejar ingresos y gastos recurrentes
  const handleAddIncome = () => {
    setEditingIncome(null);
    setShowIncomeForm(true);
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    setShowExpenseForm(true);
  };

  const handleEditIncome = (income: RecurringIncome) => {
    setEditingIncome(income);
    setShowIncomeForm(true);
  };

  const handleEditExpense = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setShowExpenseForm(true);
  };

  const handleDeleteIncome = (income: RecurringIncome) => {
    setDeletingItem({ item: income, type: 'income' });
  };

  const handleDeleteExpense = (expense: RecurringExpense) => {
    setDeletingItem({ item: expense, type: 'expense' });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header responsivo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm sm:text-base text-gray-600">Resumen de tus finanzas</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => setShowQuickTransaction(true)}
            className="flex-1 sm:flex-none"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Transacción
          </Button>
          <Sheet open={showRecurringItems} onOpenChange={setShowRecurringItems}>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none" size="sm">
                <TrendingUp className="h-4 w-4 mr-2" />
                Recurrentes
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
              <div className="py-4">
                <RecurringItemsManager
                  recurringIncomes={recurringIncomes}
                  recurringExpenses={recurringExpenses}
                  onAddIncome={handleAddIncome}
                  onAddExpense={handleAddExpense}
                  onEditIncome={handleEditIncome}
                  onEditExpense={handleEditExpense}
                  onDeleteIncome={handleDeleteIncome}
                  onDeleteExpense={handleDeleteExpense}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Calculadora de presupuesto responsiva */}
      <BudgetCalculator
        totalDebitBalance={totalDebitBalance}
        totalCreditAvailable={totalCreditAvailable}
        recurringIncomes={recurringIncomes}
        recurringExpenses={recurringExpenses}
        installmentPlans={installmentPlans}
        accounts={accounts}
      />

      {/* Gráficas principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Gráfico de distribución - Responsivo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Distribución de Saldos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64 flex items-center justify-center">
              {accounts.length > 0 ? (
                <Doughnut 
                  data={chartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          font: {
                            size: window.innerWidth < 640 ? 10 : 12
                          }
                        }
                      }
                    }
                  }}
                />
              ) : (
                <p className="text-gray-500 text-sm">No hay datos para mostrar</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gastos por categoría - Mes actual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              Gastos por Categoría ({new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64 flex items-center justify-center">
              {expensesCategoryData.labels.length > 0 ? (
                <Bar 
                  data={expensesCategoryData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: function(value) {
                            return '$' + Number(value).toLocaleString('es-ES');
                          }
                        }
                      }
                    }
                  }}
                />
              ) : (
                <p className="text-gray-500 text-sm">No hay gastos este mes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficas adicionales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Tendencia mensual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Tendencia de Ingresos vs Gastos (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64 flex items-center justify-center">
              {monthlyTrendData.labels.length > 0 ? (
                <Line 
                  data={monthlyTrendData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: function(value) {
                            return '$' + Number(value).toLocaleString('es-ES');
                          }
                        }
                      }
                    },
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              ) : (
                <p className="text-gray-500 text-sm">No hay datos suficientes</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transacciones recientes - Responsivo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Transacciones Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{transaction.description}</p>
                      <p className="text-xs text-gray-500">{transaction.category}</p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className={`font-medium text-sm ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        ${transaction.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {transaction.date?.toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4 text-sm">No hay transacciones recientes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de cuentas - Grid responsivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Mis Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div key={account.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm truncate flex-1">{account.name}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ml-2 flex-shrink-0 ${
                    account.type === 'debit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {account.type === 'debit' ? 'Débito' : 'Crédito'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">Saldo:</span>
                    <span className="font-medium text-sm">
                      ${account.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {account.type === 'credit' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-sm">Límite:</span>
                        <span className="font-medium text-sm">
                          ${(account.creditLimit || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-sm">Disponible:</span>
                        <span className="font-medium text-green-600 text-sm">
                          ${((account.creditLimit || 0) - account.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">No tienes cuentas registradas</p>
                <p className="text-sm text-gray-400">Ve a la sección de Cuentas para agregar una</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Diálogos */}
      <TransactionForm
        open={showQuickTransaction}
        onClose={() => setShowQuickTransaction(false)}
        accounts={accounts}
      />

      <RecurringIncomeForm
        open={showIncomeForm}
        onClose={() => {
          setShowIncomeForm(false);
          setEditingIncome(null);
        }}
        income={editingIncome}
      />

      <RecurringExpenseForm
        open={showExpenseForm}
        onClose={() => {
          setShowExpenseForm(false);
          setEditingExpense(null);
        }}
        expense={editingExpense}
      />

      <DeleteRecurringDialog
        open={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        item={deletingItem?.item || null}
        type={deletingItem?.type || 'income'}
      />
    </div>
  );
};

export default Dashboard;
