import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, Transaction } from '@/types';
import { useAllTransactions } from '@/hooks/useAllTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, ArrowUpCircle, ArrowDownCircle, Edit, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TransactionForm from './TransactionForm';
import DeleteTransactionDialog from './DeleteTransactionDialog';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';
import { useCategories } from '@/hooks/useCategories';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const TransactionsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { transactions: allTransactions, loading: transactionsLoading } = useAllTransactions();
  const { categories } = useCategories();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  
  // Estados para filtros simplificados
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'debit' | 'credit' | 'debt'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'current_month' | 'previous_month' | 'custom'>('current_month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  
  const [loading, setLoading] = useState(true);
  const [groupByMonth, setGroupByMonth] = useState(false);

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

    return unsubscribeAccounts;
  }, [currentUser]);

  // Función para obtener el rango de fechas según el filtro seleccionado
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date, endDate: Date;

    switch (dateFilter) {
      case 'all':
        startDate = new Date(2020, 0, 1); // Fecha muy anterior
        endDate = new Date(2030, 11, 31); // Fecha muy posterior
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'previous_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'custom':
        startDate = customStartDate || new Date(now.getFullYear(), 0, 1);
        endDate = customEndDate || now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return { startDate, endDate };
  };

  // Aplicar filtros a las transacciones
  useEffect(() => {
    let filteredTransactions = allTransactions;
    
    // Filtro por cuenta
    if (selectedAccountId !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.accountId === selectedAccountId);
    }
    
    // Filtro por tipo de cuenta
    if (accountTypeFilter !== 'all') {
      const accountsOfType = accounts.filter(acc => acc.type === accountTypeFilter);
      const accountIdsOfType = accountsOfType.map(acc => acc.id);
      filteredTransactions = filteredTransactions.filter(t => accountIdsOfType.includes(t.accountId));
    }
    
    // Filtro por tipo
    if (typeFilter !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.type === typeFilter);
    }
    
    // Filtro por categoría
    if (categoryFilter !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.category === categoryFilter);
    }
    
    // Filtro por fecha
    const { startDate, endDate } = getDateRange();
    filteredTransactions = filteredTransactions.filter(t => 
      t.date >= startDate && t.date <= endDate
    );
    
    setTransactions(filteredTransactions);
    setLoading(transactionsLoading);
  }, [allTransactions, selectedAccountId, typeFilter, categoryFilter, accountTypeFilter, dateFilter, customStartDate, customEndDate, transactionsLoading, accounts]);

  // Función para calcular el saldo acumulado por cuenta
  const calculateRunningBalance = () => {
    const { startDate } = getDateRange();
    
    // 1. Calcular el saldo inicial de cada cuenta al inicio del período filtrado
    const initialBalances: { [accountId: string]: number } = {};
    
    accounts.forEach(account => {
      // Empezar con 0 (las transacciones virtuales de saldo inicial ya están incluidas)
      let initialBalance = 0;
      
      // Sumar todas las transacciones anteriores al período filtrado
      allTransactions
        .filter(t => t.date < startDate && t.accountId === account.id)
        .forEach(t => {
          if (t.type === 'income') {
            initialBalance += t.amount;
          } else {
            initialBalance -= t.amount;
          }
        });
      
      initialBalances[account.id] = initialBalance;
    });

    // 2. Ordenar transacciones filtradas por fecha ascendente para calcular saldo correcto
    const sortedTransactions = [...transactions].sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );

    // 3. Calcular el saldo después de cada transacción del período
    const accountBalances: { [accountId: string]: number } = { ...initialBalances };
    
    const transactionsWithBalance = sortedTransactions.map(transaction => {
      // Aplicar la transacción al saldo de la cuenta
      if (transaction.type === 'income') {
        accountBalances[transaction.accountId] += transaction.amount;
      } else {
        accountBalances[transaction.accountId] -= transaction.amount;
      }

      return {
        ...transaction,
        accountBalance: accountBalances[transaction.accountId]
      };
    });

    // 4. Revertir para mostrar las más recientes primero
    return transactionsWithBalance.reverse();
  };

  const transactionsWithBalance = calculateRunningBalance();

  // Función para agrupar transacciones por mes
  const groupTransactionsByMonth = (transactions: (Transaction & { accountBalance: number })[]) => {
    if (!groupByMonth) return { ungrouped: transactions };
    
    const grouped = transactions.reduce((groups, transaction) => {
      const monthYear = transaction.date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(transaction);
      return groups;
    }, {} as { [key: string]: (Transaction & { accountBalance: number })[] });
    
    return grouped;
  };

  const groupedTransactions = groupTransactionsByMonth(transactionsWithBalance);

  const handleCreateTransaction = () => {
    setEditingTransaction(null);
    setIsFormOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    // Verificar si es una transacción de MSI
    if (transaction.isInstallment) {
      toast({
        title: 'No se puede editar',
        description: 'Las transacciones de meses sin intereses no se pueden editar directamente. Debes modificar el plan de pagos desde la sección de cuentas.',
        variant: 'destructive',
      });
      return;
    }
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingTransaction(null);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Cuenta eliminada';
  };

  const getAccountById = (accountId: string) => {
    return accounts.find(acc => acc.id === accountId);
  };

  // Totales basados en transacciones filtradas
  const getTotalIncome = () => {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getTotalExpenses = () => {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getBalance = () => {
    return getTotalIncome() - getTotalExpenses();
  };

  const getDateFilterLabel = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'current_month':
        return now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      case 'previous_month':
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return prevMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      case 'custom':
        const { startDate, endDate } = getDateRange();
        return `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`;
      default:
        return 'Mes actual';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header responsivo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Transacciones</h2>
          <p className="text-sm sm:text-base text-gray-600">
            {getDateFilterLabel()} • {transactions.length} transacciones
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleCreateTransaction} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" />
            Nueva
          </Button>
        </div>
      </div>

      {/* Filtros mejorados con tabs */}
      <div className="space-y-4">
        {/* Tabs para tipo de transacción */}
        <Tabs value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="income">Ingresos</TabsTrigger>
            <TabsTrigger value="expense">Gastos</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filtros adicionales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtro de período */}
          <Card className="p-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Período</Label>
              <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">Todo</SelectItem>
                  <SelectItem value="current_month">Mes actual</SelectItem>
                  <SelectItem value="previous_month">Mes anterior</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Filtro de cuenta */}
          <Card className="p-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cuenta</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Filtro de categoría */}
          <Card className="p-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Categoría</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories
                    .filter(cat => typeFilter === 'all' || cat.type === typeFilter)
                    .map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      <div className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Filtro de tipo de cuenta */}
          <Card className="p-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de cuenta</Label>
              <Select value={accountTypeFilter} onValueChange={(value: any) => setAccountTypeFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debt">Deuda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        </div>

        {/* Fechas personalizadas sin calendario */}
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Desde (YYYY-MM-DD)</Label>
                <input
                  type="date"
                  value={customStartDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setCustomStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full p-2 border border-input rounded-md bg-background text-foreground"
                />
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hasta (YYYY-MM-DD)</Label>
                <input
                  type="date"
                  value={customEndDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setCustomEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                  className="w-full p-2 border border-input rounded-md bg-background text-foreground"
                />
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Resumen de transacciones filtradas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              Ingresos ({getDateFilterLabel()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-green-600">
              {formatCurrencyWithSymbol(getTotalIncome())}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {transactions.filter(t => t.type === 'income').length} transacciones
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              Gastos ({getDateFilterLabel()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-red-600">
              {formatCurrencyWithSymbol(getTotalExpenses())}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {transactions.filter(t => t.type === 'expense').length} transacciones
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              Balance ({getDateFilterLabel()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg sm:text-2xl font-bold ${getBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrencyWithSymbol(getBalance())}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Diferencia del período
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de transacciones mejorada */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-base sm:text-lg">Transacciones</CardTitle>
            <Button 
              variant={groupByMonth ? "default" : "outline"} 
              size="sm"
              onClick={() => setGroupByMonth(!groupByMonth)}
            >
              {groupByMonth ? 'Lista' : 'Agrupar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {transactionsWithBalance.length > 0 ? (
            <div className="overflow-x-auto">
              {groupByMonth ? (
                // Vista agrupada por mes
                <div className="space-y-6 p-4">
                  {Object.entries(groupedTransactions).map(([monthYear, monthTransactions]) => {
                    const transactions = monthTransactions as (Transaction & { accountBalance: number })[];
                    const monthTotal = transactions.reduce((sum, t) => 
                      sum + (t.type === 'income' ? t.amount : -t.amount), 0
                    );
                    
                    return (
                      <div key={monthYear} className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg">
                          <h3 className="font-semibold text-lg capitalize">{monthYear}</h3>
                          <span className={`font-bold ${monthTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {monthTotal >= 0 ? '+' : ''}{formatCurrencyWithSymbol(monthTotal)}
                          </span>
                        </div>
                        
                        {/* Vista móvil para el grupo */}
                        <div className="sm:hidden space-y-2">
                          {transactions.map((transaction) => (
                            <Card key={transaction.id} className="p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  {transaction.type === 'income' ? (
                                    <ArrowUpCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <ArrowDownCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className={`text-sm font-medium ${
                                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditTransaction(transaction)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteTransaction(transaction)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="font-medium">{transaction.description}</div>
                                <div className="text-gray-500">{transaction.category}</div>
                                <div className="text-gray-500">{getAccountName(transaction.accountId)}</div>
                                <div className="text-gray-500">
                                  {transaction.date?.toLocaleDateString('es-ES')}
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t">
                                  <span className={`font-medium ${
                                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {transaction.type === 'income' ? '+' : '-'}
                                    {formatCurrencyWithSymbol(transaction.amount)}
                                  </span>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                        
                        {/* Vista desktop para el grupo */}
                        <div className="hidden sm:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Fecha</TableHead>
                                <TableHead className="text-xs">Tipo</TableHead>
                                <TableHead className="text-xs">Descripción</TableHead>
                                <TableHead className="text-xs">Categoría</TableHead>
                                <TableHead className="text-xs">Cuenta</TableHead>
                                <TableHead className="text-right text-xs">Monto</TableHead>
                                <TableHead className="text-right text-xs">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {transactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                  <TableCell className="text-xs">
                                    {transaction.date?.toLocaleDateString('es-ES')}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {transaction.type === 'income' ? (
                                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <ArrowDownCircle className="h-4 w-4 text-red-600" />
                                      )}
                                      <span className={`text-xs ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs max-w-32 truncate">{transaction.description}</TableCell>
                                  <TableCell className="text-xs">{transaction.category}</TableCell>
                                  <TableCell className="text-xs max-w-24 truncate">{getAccountName(transaction.accountId)}</TableCell>
                                  <TableCell className={`text-right font-medium text-xs ${
                                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {transaction.type === 'income' ? '+' : '-'}
                                    {formatCurrencyWithSymbol(transaction.amount)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditTransaction(transaction)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteTransaction(transaction)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* Vista móvil - Cards */}
                  <div className="sm:hidden space-y-3 p-4">
                    {transactionsWithBalance.map((transaction) => (
                  <Card key={transaction.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {transaction.type === 'income' ? (
                          <ArrowUpCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTransaction(transaction)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTransaction(transaction)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">{transaction.description}</div>
                      <div className="text-gray-500">{transaction.category}</div>
                      <div className="text-gray-500">{getAccountName(transaction.accountId)}</div>
                      <div className="text-gray-500">
                        {transaction.date?.toLocaleDateString('es-ES')}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className={`font-medium ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrencyWithSymbol(transaction.amount)}
                        </span>
                        <span className={`text-sm font-medium ${
                          transaction.accountBalance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          Saldo: {formatCurrencyWithSymbol(transaction.accountBalance)}
                        </span>
                      </div>
                    </div>
                    </Card>
                  ))}
                  </div>

                  {/* Vista desktop - Tabla */}
                  <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Descripción</TableHead>
                      <TableHead className="text-xs">Categoría</TableHead>
                      <TableHead className="text-xs">Cuenta</TableHead>
                      <TableHead className="text-right text-xs">Monto</TableHead>
                      <TableHead className="text-right text-xs">Saldo de Cuenta</TableHead>
                      <TableHead className="text-right text-xs">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsWithBalance.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="text-xs">
                          {transaction.date?.toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transaction.type === 'income' ? (
                              <ArrowUpCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowDownCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className={`text-xs ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-32 truncate">{transaction.description}</TableCell>
                        <TableCell className="text-xs">{transaction.category}</TableCell>
                        <TableCell className="text-xs max-w-24 truncate">{getAccountName(transaction.accountId)}</TableCell>
                        <TableCell className={`text-right font-medium text-xs ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrencyWithSymbol(transaction.amount)}
                        </TableCell>
                        <TableCell className={`text-right font-medium text-xs ${
                          transaction.accountBalance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrencyWithSymbol(transaction.accountBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTransaction(transaction)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTransaction(transaction)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No hay transacciones para el período seleccionado</p>
              <Button onClick={handleCreateTransaction}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera transacción
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total general */}
      {transactions.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Total del período seleccionado</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold text-green-600">+{formatCurrencyWithSymbol(getTotalIncome())}</p>
                  <p className="text-xs text-gray-500">Ingresos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">-{formatCurrencyWithSymbol(getTotalExpenses())}</p>
                  <p className="text-xs text-gray-500">Gastos</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {getBalance() >= 0 ? '+' : ''}{formatCurrencyWithSymbol(getBalance())}
                  </p>
                  <p className="text-xs text-gray-500">Balance neto</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogos */}
      <TransactionForm
        open={isFormOpen}
        onClose={handleFormClose}
        transaction={editingTransaction}
        accounts={accounts}
      />

      <DeleteTransactionDialog
        open={!!deletingTransaction}
        onClose={() => setDeletingTransaction(null)}
        transaction={deletingTransaction}
        accounts={accounts}
      />
    </div>
  );
};

export default TransactionsPage;
