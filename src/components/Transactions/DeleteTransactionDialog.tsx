
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, Transaction } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

interface DeleteTransactionDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
}

const DeleteTransactionDialog: React.FC<DeleteTransactionDialogProps> = ({ 
  open, 
  onClose, 
  transaction, 
  accounts 
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const updateAccountBalance = async (accountId: string, amount: number, type: 'income' | 'expense') => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    let newBalance = account.balance;
    
    // Revertir el efecto de la transacción
    if (account.type === 'debit') {
      if (type === 'income') {
        newBalance = account.balance - amount; // Restar el ingreso
      } else {
        newBalance = account.balance + amount; // Devolver el gasto
      }
    } else if (account.type === 'credit') {
      if (type === 'expense') {
        newBalance = account.balance - amount; // Reducir el saldo usado
      }
      // Los ingresos no afectan las cuentas de crédito directamente
    }

    await updateDoc(doc(db, 'users', currentUser!.uid, 'accounts', accountId), {
      balance: newBalance
    });
  };

  const handleDelete = async () => {
    if (!currentUser || !transaction) return;

    setLoading(true);

    try {
      // Verificar si es una transacción de MSI
      if (transaction.isInstallment && transaction.installmentPlanId) {
        toast({
          title: 'No se puede eliminar',
          description: 'Las transacciones de meses sin intereses no se pueden eliminar directamente. Debes cancelar el plan de pagos desde la sección de cuentas.',
          variant: 'destructive',
        });
        onClose();
        return;
      }

      // Revertir el efecto en la cuenta
      await updateAccountBalance(transaction.accountId, transaction.amount, transaction.type);
      
      // Eliminar la transacción
      await deleteDoc(doc(db, 'users', currentUser.uid, 'transactions', transaction.id));

      toast({
        title: 'Transacción eliminada',
        description: 'La transacción se ha eliminado correctamente y el saldo de la cuenta se ha actualizado.',
      });

      onClose();
    } catch (error) {
      console.error('Error al eliminar transacción:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la transacción. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Cuenta eliminada';
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle>Eliminar Transacción</DialogTitle>
          </div>
          <DialogDescription>
            Esta acción no se puede deshacer. El saldo de la cuenta se actualizará automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Tipo:</span>
              <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                {transaction.type === 'income' ? 'Ingreso' : 'Gasto'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Monto:</span>
              <span className="font-medium">
                ${transaction.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Descripción:</span>
              <span className="font-medium">{transaction.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cuenta:</span>
              <span className="font-medium">{getAccountName(transaction.accountId)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha:</span>
              <span className="font-medium">
                {transaction.date?.toLocaleDateString('es-ES')}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTransactionDialog;
