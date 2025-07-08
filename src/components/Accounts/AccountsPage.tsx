
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard, Wallet, Edit, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import AccountForm from './AccountForm';
import DeleteAccountDialog from './DeleteAccountDialog';
import TransferDialog from './TransferDialog';
import InstallmentPlanForm from './InstallmentPlanForm';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';

const AccountsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [installmentFormOpen, setInstallmentFormOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const accountsQuery = query(
      collection(db, 'users', currentUser.uid, 'accounts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(accountsQuery, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          nextPaymentDate: data.nextPaymentDate?.toDate()
        };
      }) as Account[];
      setAccounts(accountsData);
    });

    return unsubscribe;
  }, [currentUser]);

  const handleCreateAccount = () => {
    setEditingAccount(null);
    setIsFormOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  };

  const handleDeleteAccount = (account: Account) => {
    setDeletingAccount(account);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingAccount(null);
  };

  const getAvailableBalance = (account: Account) => {
    if (account.type === 'debit') {
      return account.balance;
    } else if (account.type === 'credit') {
      return (account.creditLimit || 0) - account.balance;
    } else if (account.type === 'debt') {
      return account.balance; // para deudas, balance representa lo que queda por pagar
    }
    return 0;
  };

  const getBalanceColor = (account: Account) => {
    if (account.type === 'debit') {
      return account.balance >= 0 ? 'text-green-600' : 'text-red-600';
    } else if (account.type === 'credit') {
      const available = (account.creditLimit || 0) - account.balance;
      const percentage = available / (account.creditLimit || 1);
      if (percentage > 0.5) return 'text-green-600';
      if (percentage > 0.2) return 'text-yellow-600';
      return 'text-red-600';
    } else if (account.type === 'debt') {
      // Para deudas, siempre mostrar en rojo ya que representa dinero que se debe
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const creditAccounts = accounts.filter(account => account.type === 'credit');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mis Cuentas</h2>
          <p className="text-gray-600">Gestiona tus cuentas de débito y crédito</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => setInstallmentFormOpen(true)} 
            variant="outline"
            disabled={creditAccounts.length === 0}
            className="w-full sm:w-auto"
          >
            <Calendar className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Pagos a Meses</span>
            <span className="sm:hidden">Meses</span>
          </Button>
          <Button onClick={() => setTransferDialogOpen(true)} variant="outline" className="w-full sm:w-auto">
            <CreditCard className="h-4 w-4 mr-2" />
            Transferir
          </Button>
          <Button onClick={handleCreateAccount} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Nueva Cuenta</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      {/* Resumen de cuentas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Débito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrencyWithSymbol(accounts
                .filter(a => a.type === 'debit')
                .reduce((sum, a) => sum + a.balance, 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Crédito Disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrencyWithSymbol(accounts
                .filter(a => a.type === 'credit')
                .reduce((sum, a) => sum + ((a.creditLimit || 0) - a.balance), 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Deudas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrencyWithSymbol(
                accounts.filter(a => a.type === 'credit').reduce((sum, a) => sum + a.balance, 0) +
                accounts.filter(a => a.type === 'debt').reduce((sum, a) => sum + a.balance, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de cuentas */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <Card key={account.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {account.type === 'debit' ? (
                    <Wallet className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : account.type === 'credit' ? (
                    <CreditCard className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  )}
                  <CardTitle className="text-lg truncate">{account.name}</CardTitle>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditAccount(account)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAccount(account)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                account.type === 'debit' 
                  ? 'bg-green-100 text-green-700' 
                  : account.type === 'credit'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {account.type === 'debit' ? 'Débito' : account.type === 'credit' ? 'Crédito' : 'Deuda'}
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              {account.type === 'debit' ? (
                <div className="flex justify-between">
                  <span className="text-gray-600">Saldo:</span>
                  <span className={`font-bold ${getBalanceColor(account)}`}>
                    {formatCurrencyWithSymbol(account.balance)}
                  </span>
                </div>
              ) : account.type === 'credit' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Límite:</span>
                    <span className="font-medium">
                      {formatCurrencyWithSymbol(account.creditLimit || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usado:</span>
                    <span className="font-medium text-red-600">
                      {formatCurrencyWithSymbol(account.balance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Disponible:</span>
                    <span className={`font-bold ${getBalanceColor(account)}`}>
                      {formatCurrencyWithSymbol(getAvailableBalance(account))}
                    </span>
                  </div>
                  
                  {/* Información de fechas para tarjetas de crédito */}
                  {account.cutoffDate && account.paymentDueDate && (
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Corte: día {account.cutoffDate}</span>
                        <span>Pago: día {account.paymentDueDate}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full" 
                      style={{ 
                        width: `${Math.min((account.balance / (account.creditLimit || 1)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </>
              ) : account.type === 'debt' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total deuda:</span>
                    <span className="font-medium">
                      {formatCurrencyWithSymbol(account.totalDebt || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Restante:</span>
                    <span className={`font-bold ${getBalanceColor(account)}`}>
                      {formatCurrencyWithSymbol(account.balance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pago mensual:</span>
                    <span className="font-medium">
                      {formatCurrencyWithSymbol(account.monthlyPayment || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Meses restantes:</span>
                    <span className="font-medium text-blue-600">
                      {account.remainingMonths || 0}
                    </span>
                  </div>
                  
                  {/* Información de próximo pago para deudas */}
                  {account.nextPaymentDate && (
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Próximo pago:</span>
                        <span>{account.nextPaymentDate.toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ 
                        width: `${Math.max(100 - (account.balance / (account.totalDebt || 1)) * 100, 0)}%` 
                      }}
                    ></div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ))}

        {accounts.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes cuentas registradas</h3>
            <p className="text-gray-600 mb-4">Crea tu primera cuenta para comenzar a gestionar tus finanzas</p>
            <Button onClick={handleCreateAccount}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Cuenta
            </Button>
          </div>
        )}
      </div>

      {/* Diálogos */}
      <AccountForm
        open={isFormOpen}
        onClose={handleFormClose}
        account={editingAccount}
        accounts={accounts}
      />

      <DeleteAccountDialog
        open={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        account={deletingAccount}
      />

      <TransferDialog
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
        accounts={accounts}
      />

      <InstallmentPlanForm
        open={installmentFormOpen}
        onClose={() => setInstallmentFormOpen(false)}
        creditAccounts={creditAccounts}
      />
    </div>
  );
};

export default AccountsPage;
