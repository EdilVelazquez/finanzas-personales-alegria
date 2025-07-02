import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, Transaction } from '@/types';
import { useAllTransactions } from '@/hooks/useAllTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, ArrowUpCircle, ArrowDownCircle, Edit, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TransactionForm from './TransactionForm';
import DeleteTransactionDialog from './DeleteTransactionDialog';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  
  // Estados para filtros simplificados
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'current_month' | 'previous_month' | 'custom'>('current_month');
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
    
    // Filtro por fecha
    const { startDate, endDate } = getDateRange();
    filteredTransactions = filteredTransactions.filter(t => 
      t.date >= startDate && t.date <= endDate
    );
    
    setTransactions(filteredTransactions);
    setLoading(transactionsLoading);
  }, [allTransactions, selectedAccountId, dateFilter, customStartDate, customEndDate, transactionsLoading]);

  // Función para calcular el saldo acumulado por cuenta
  const calculateRunningBalance = () => {
    // Ordenar transacciones por fecha ascendente para calcular saldo correcto
    const sortedTransactions = [...transactions].sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );

    // Crear un mapa para mantener el saldo por cuenta
    const accountBalances: { [accountId: string]: number } = {};
    
    // Inicializar con el saldo inicial de cada cuenta (como si fuera una transacción inicial)
    accounts.forEach(account => {
      accountBalances[account.id] = account.balance;
    });

    // Calcular el saldo después de cada transacción
    const transactionsWithBalance = sortedTransactions.map(transaction => {
      const account = accounts.find(acc => acc.id === transaction.accountId);
      if (!account) {
        return {
          ...transaction,
          accountBalance: 0
        };
      }

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

    // Revertir para mostrar las más recientes primero
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

      {/* Filtros mejorados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Filtro de período */}
        <Card className="p-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período</Label>
            <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
              <SelectContent>
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

        {/* Fechas personalizadas */}
        {dateFilter === 'custom' && (
          <>
            <Card className="p-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Desde</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? (
                        format(customStartDate, "dd/MM/yyyy", { locale: es })
                      ) : (
                        "Seleccionar"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hasta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? (
                        format(customEndDate, "dd/MM/yyyy", { locale: es })
                      ) : (
                        "Seleccionar"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => 
                        date > new Date() || 
                        (customStartDate && date < customStartDate)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </Card>
          </>
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
              <Calendar className="h-4 w-4 mr-2" />
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
