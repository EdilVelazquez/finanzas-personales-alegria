import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, Transaction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ArrowUpCircle, ArrowDownCircle, Edit, Trash2, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TransactionForm from './TransactionForm';
import DeleteTransactionDialog from './DeleteTransactionDialog';
import TransactionFilters, { TransactionFilters as TTransactionFilters } from './TransactionFilters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

const TransactionsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TTransactionFilters>({});
  const [loading, setLoading] = useState(true);

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

    // Escuchar transacciones
    let transactionsQuery = query(
      collection(db, 'users', currentUser.uid, 'transactions'),
      orderBy('date', 'desc')
    );

    // Aplicar filtros si existen
    if (filters.type) {
      transactionsQuery = query(transactionsQuery, where('type', '==', filters.type));
    }
    if (filters.category) {
      transactionsQuery = query(transactionsQuery, where('category', '==', filters.category));
    }
    if (filters.accountId) {
      transactionsQuery = query(transactionsQuery, where('accountId', '==', filters.accountId));
    }

    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Transaction[];
      
      // Aplicar filtros de fecha en el cliente
      let filteredTransactions = transactionsData;
      if (filters.startDate || filters.endDate) {
        filteredTransactions = transactionsData.filter(transaction => {
          const transactionDate = transaction.date;
          if (filters.startDate && transactionDate < filters.startDate) return false;
          if (filters.endDate && transactionDate > filters.endDate) return false;
          return true;
        });
      }
      
      setTransactions(filteredTransactions);
      setLoading(false);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeTransactions();
    };
  }, [currentUser, filters]);

  // Función para calcular el saldo acumulado por cuenta
  const calculateRunningBalance = () => {
    // Ordenar transacciones por fecha ascendente para calcular saldo correcto
    const sortedTransactions = [...transactions].sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );

    // Crear un mapa para mantener el saldo por cuenta
    const accountBalances: { [accountId: string]: number } = {};
    
    // Calcular el saldo inicial para cada cuenta (saldo actual - todas las transacciones)
    accounts.forEach(account => {
      // Obtener todas las transacciones de esta cuenta
      const accountTransactions = sortedTransactions.filter(t => t.accountId === account.id);
      
      // Calcular el efecto total de todas las transacciones
      const totalEffect = accountTransactions.reduce((sum, t) => {
        return sum + (t.type === 'income' ? t.amount : -t.amount);
      }, 0);
      
      // El saldo inicial es el saldo actual menos el efecto de todas las transacciones
      accountBalances[account.id] = account.balance - totalEffect;
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

  const handleCreateTransaction = () => {
    setEditingTransaction(null);
    setIsFormOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
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
          <p className="text-sm sm:text-base text-gray-600">Gestiona tus ingresos y gastos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
              <div className="py-4">
                <TransactionFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  accounts={accounts}
                />
              </div>
            </SheetContent>
          </Sheet>
          <Button onClick={handleCreateTransaction} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="sm:inline">Nueva Transacción</span>
          </Button>
        </div>
      </div>

      {/* Resumen de transacciones - Grid responsivo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Total Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-green-600">
              ${getTotalIncome().toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Total Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-red-600">
              ${getTotalExpenses().toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg sm:text-2xl font-bold ${getBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${getBalance().toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de transacciones - Responsiva */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Lista de Transacciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {transactionsWithBalance.length > 0 ? (
            <div className="overflow-x-auto">
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
                          ${transaction.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-sm font-medium ${
                          transaction.accountBalance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          Saldo: ${transaction.accountBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
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
                          ${transaction.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className={`text-right font-medium text-xs ${
                          transaction.accountBalance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${transaction.accountBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
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
          ) : (
            <div className="text-center py-12 px-4">
              <ArrowUpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay transacciones</h3>
              <p className="text-gray-600 mb-4 text-sm">Registra tu primera transacción para comenzar</p>
              <Button onClick={handleCreateTransaction} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Transacción
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
