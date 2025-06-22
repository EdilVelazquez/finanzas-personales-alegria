
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RecurringIncome, RecurringExpense } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface DeleteRecurringDialogProps {
  open: boolean;
  onClose: () => void;
  item: RecurringIncome | RecurringExpense | null;
  type: 'income' | 'expense';
}

const DeleteRecurringDialog: React.FC<DeleteRecurringDialogProps> = ({ 
  open, 
  onClose, 
  item, 
  type 
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!currentUser || !item) return;

    setLoading(true);

    try {
      const collection = type === 'income' ? 'recurringIncomes' : 'recurringExpenses';
      await deleteDoc(doc(db, 'users', currentUser.uid, collection, item.id));

      toast({
        title: type === 'income' ? 'Ingreso eliminado' : 'Gasto eliminado',
        description: `El ${type === 'income' ? 'ingreso fijo' : 'gasto recurrente'} se ha eliminado correctamente.`,
      });

      onClose();
    } catch (error) {
      console.error(`Error al eliminar ${type}:`, error);
      toast({
        title: 'Error',
        description: `No se pudo eliminar el ${type === 'income' ? 'ingreso' : 'gasto'}. Inténtalo de nuevo.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="mx-4 max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base sm:text-lg">
            {type === 'income' ? 'Eliminar Ingreso Fijo' : 'Eliminar Gasto Recurrente'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            ¿Estás seguro de que quieres eliminar "{item?.name}"? Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <AlertDialogCancel disabled={loading} className="mt-2 sm:mt-0">Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteRecurringDialog;
