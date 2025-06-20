
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, updateDoc, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Wallet, CreditCard } from 'lucide-react';

interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
}

interface FormData {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  description: string;
}

const TransferDialog: React.FC<TransferDialogProps> = ({ open, onClose, accounts }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      description: '',
    },
  });

  const watchFromAccount = form.watch('fromAccountId');
  const watchToAccount = form.watch('toAccountId');

  const fromAccount = accounts.find(acc => acc.id === watchFromAccount);
  const toAccount = accounts.find(acc => acc.id === watchToAccount);

  const validateAmount = (value: string) => {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) {
      return 'El monto debe ser mayor a 0';
    }

    if (!fromAccount) return 'Selecciona una cuenta de origen';

    // Validar saldo disponible para cuenta de débito
    if (fromAccount.type === 'debit' && amount > fromAccount.balance) {
      return 'Saldo insuficiente en la cuenta de origen';
    }

    // Validar límite de crédito para cuenta de crédito
    if (fromAccount.type === 'credit') {
      const available = (fromAccount.creditLimit || 0) - fromAccount.balance;
      if (amount > available) {
        return 'Límite de crédito insuficiente en la cuenta de origen';
      }
    }

    return true;
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser || !fromAccount || !toAccount) return;

    const amount = parseFloat(data.amount);
    
    if (data.fromAccountId === data.toAccountId) {
      form.setError('toAccountId', { message: 'No puedes transferir a la misma cuenta' });
      return;
    }

    setLoading(true);

    try {
      await runTransaction(db, async (transaction) => {
        const fromAccountRef = doc(db, 'users', currentUser.uid, 'accounts', fromAccount.id);
        const toAccountRef = doc(db, 'users', currentUser.uid, 'accounts', toAccount.id);

        // Leer los documentos actuales
        const fromAccountDoc = await transaction.get(fromAccountRef);
        const toAccountDoc = await transaction.get(toAccountRef);

        if (!fromAccountDoc.exists() || !toAccountDoc.exists()) {
          throw new Error('Una de las cuentas no existe');
        }

        const fromAccountData = fromAccountDoc.data() as Account;
        const toAccountData = toAccountDoc.data() as Account;

        // Calcular nuevos saldos
        let newFromBalance: number;
        let newToBalance: number;

        // Cuenta de origen
        if (fromAccountData.type === 'debit') {
          newFromBalance = fromAccountData.balance - amount;
        } else {
          newFromBalance = fromAccountData.balance + amount; // Aumenta la deuda usada
        }

        // Cuenta de destino
        if (toAccountData.type === 'debit') {
          newToBalance = toAccountData.balance + amount;
        } else {
          newToBalance = Math.max(0, toAccountData.balance - amount); // Reduce la deuda usada
        }

        // Actualizar saldos
        transaction.update(fromAccountRef, { balance: newFromBalance });
        transaction.update(toAccountRef, { balance: newToBalance });

        // Crear registro de transferencia
        const transferRef = collection(db, 'users', currentUser.uid, 'transfers');
        transaction.set(doc(transferRef), {
          amount,
          fromAccountId: data.fromAccountId,
          toAccountId: data.toAccountId,
          description: data.description.trim() || 'Transferencia entre cuentas',
          userId: currentUser.uid,
          date: new Date(),
          createdAt: serverTimestamp(),
        });
      });

      toast({
        title: 'Transferencia realizada',
        description: `Se transfirieron $${amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} exitosamente.`,
      });

      form.reset();
      onClose();
    } catch (error) {
      console.error('Error en transferencia:', error);
      toast({
        title: 'Error en transferencia',
        description: 'No se pudo completar la transferencia. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const availableFromAccounts = accounts.filter(acc => 
    acc.type === 'debit' ? acc.balance > 0 : 
    (acc.creditLimit || 0) - acc.balance > 0
  );

  const availableToAccounts = accounts.filter(acc => acc.id !== watchFromAccount);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir entre Cuentas</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fromAccountId"
              rules={{ required: 'Selecciona una cuenta de origen' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta de origen</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona cuenta de origen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableFromAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            {account.type === 'debit' ? (
                              <Wallet className="h-4 w-4 text-green-600" />
                            ) : (
                              <CreditCard className="h-4 w-4 text-blue-600" />
                            )}
                            <span>{account.name}</span>
                            <span className="text-sm text-gray-500">
                              (${account.type === 'debit' ? 
                                account.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 }) :
                                ((account.creditLimit || 0) - account.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })
                              } disponible)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-center py-2">
              <ArrowRight className="h-6 w-6 text-gray-400" />
            </div>

            <FormField
              control={form.control}
              name="toAccountId"
              rules={{ required: 'Selecciona una cuenta de destino' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta de destino</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona cuenta de destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableToAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            {account.type === 'debit' ? (
                              <Wallet className="h-4 w-4 text-green-600" />
                            ) : (
                              <CreditCard className="h-4 w-4 text-blue-600" />
                            )}
                            <span>{account.name}</span>
                            <span className="text-sm text-gray-500">
                              ({account.type === 'debit' ? 'Débito' : 'Crédito'})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              rules={{
                required: 'El monto es obligatorio',
                validate: validateAmount,
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a transferir</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe el motivo de la transferencia..." 
                      {...field}
                      disabled={loading}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {fromAccount && toAccount && (
              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                <h4 className="text-sm font-medium text-blue-900">Resumen de transferencia</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-blue-700">De:</span>
                    <span className="font-medium">{fromAccount.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">A:</span>
                    <span className="font-medium">{toAccount.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Disponible origen:</span>
                    <span className="font-medium">
                      ${fromAccount.type === 'debit' ? 
                        fromAccount.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 }) :
                        ((fromAccount.creditLimit || 0) - fromAccount.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || availableFromAccounts.length === 0}>
                {loading ? 'Transfiriendo...' : 'Transferir'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TransferDialog;
