
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { deleteDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
  account: Account | null;
}

const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({ open, onClose, account }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [checkingTransactions, setCheckingTransactions] = useState(false);

  useEffect(() => {
    const checkTransactions = async () => {
      if (!account || !currentUser) return;

      setCheckingTransactions(true);
      try {
        // Verificar transacciones
        const transactionsQuery = query(
          collection(db, 'users', currentUser.uid, 'transactions'),
          where('accountId', '==', account.id)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);

        // Verificar transferencias
        const transfersFromQuery = query(
          collection(db, 'users', currentUser.uid, 'transfers'),
          where('fromAccountId', '==', account.id)
        );
        const transfersFromSnapshot = await getDocs(transfersFromQuery);

        const transfersToQuery = query(
          collection(db, 'users', currentUser.uid, 'transfers'),
          where('toAccountId', '==', account.id)
        );
        const transfersToSnapshot = await getDocs(transfersToQuery);

        setHasTransactions(
          !transactionsSnapshot.empty || 
          !transfersFromSnapshot.empty || 
          !transfersToSnapshot.empty
        );
      } catch (error) {
        console.error('Error checking transactions:', error);
      } finally {
        setCheckingTransactions(false);
      }
    };

    if (open && account) {
      checkTransactions();
    }
  }, [open, account, currentUser]);

  const handleDelete = async () => {
    if (!account || !currentUser) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'accounts', account.id));
      
      toast({
        title: 'Cuenta eliminada',
        description: 'La cuenta se ha eliminado correctamente.',
      });
      
      onClose();
    } catch (error) {
      console.error('Error al eliminar cuenta:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle>Eliminar Cuenta</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            ¿Estás seguro que deseas eliminar la cuenta "{account.name}"?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {checkingTransactions ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Verificando transacciones...</span>
            </div>
          ) : hasTransactions ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">
                    No se puede eliminar esta cuenta
                  </h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Esta cuenta tiene transacciones o transferencias asociadas. 
                    Para eliminarla, primero debes eliminar todas las transacciones relacionadas.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">
                    Esta acción no se puede deshacer
                  </h4>
                  <p className="text-sm text-red-700 mt-1">
                    Al eliminar esta cuenta, se perderá toda la información asociada 
                    de forma permanente.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Nombre:</span>
                <span className="font-medium">{account.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo:</span>
                <span className="font-medium">
                  {account.type === 'debit' ? 'Débito' : 'Crédito'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {account.type === 'debit' ? 'Saldo:' : 'Saldo usado:'}
                </span>
                <span className="font-medium">
                  ${account.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={loading || hasTransactions || checkingTransactions}
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountDialog;
