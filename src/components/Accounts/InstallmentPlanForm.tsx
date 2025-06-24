
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, InstallmentPlan } from '@/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';

interface InstallmentPlanFormProps {
  open: boolean;
  onClose: () => void;
  creditAccounts: Account[];
}

interface FormData {
  accountId: string;
  description: string;
  totalAmount: string;
  installments: string;
}

const InstallmentPlanForm: React.FC<InstallmentPlanFormProps> = ({ 
  open, 
  onClose, 
  creditAccounts 
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      accountId: '',
      description: '',
      totalAmount: '',
      installments: '3',
    },
  });

  const watchTotalAmount = form.watch('totalAmount');
  const watchInstallments = form.watch('installments');

  const monthlyAmount = watchTotalAmount && watchInstallments 
    ? parseFloat(watchTotalAmount) / parseInt(watchInstallments) 
    : 0;

  useEffect(() => {
    if (open) {
      form.reset({
        accountId: '',
        description: '',
        totalAmount: '',
        installments: '3',
      });
    }
  }, [open, form]);

  const validateAmount = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'El monto debe ser un número válido';
    if (num <= 0) return 'El monto debe ser mayor a cero';
    return true;
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser) return;

    const totalAmount = parseFloat(data.totalAmount);
    const installments = parseInt(data.installments);
    const monthlyAmount = totalAmount / installments;

    setLoading(true);

    try {
      // Calcular la próxima fecha de pago (próximo mes)
      const nextPaymentDate = new Date();
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      nextPaymentDate.setDate(1); // Primer día del próximo mes

      const installmentData = {
        accountId: data.accountId,
        description: data.description.trim(),
        totalAmount: totalAmount,
        installments: installments,
        monthlyAmount: monthlyAmount,
        remainingInstallments: installments,
        startDate: Timestamp.fromDate(new Date()),
        nextPaymentDate: Timestamp.fromDate(nextPaymentDate),
        userId: currentUser.uid,
        isActive: true,
      };

      await addDoc(collection(db, 'users', currentUser.uid, 'installmentPlans'), {
        ...installmentData,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Plan de pagos creado',
        description: `Se creó el plan de ${installments} pagos de ${formatCurrencyWithSymbol(monthlyAmount)} cada uno.`,
      });

      onClose();
    } catch (error) {
      console.error('Error al crear plan de pagos:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el plan de pagos. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const installmentOptions = [3, 6, 9, 12, 18, 24];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Plan de Pagos a Meses</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="accountId"
              rules={{ required: 'Selecciona una tarjeta de crédito' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarjeta de Crédito</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una tarjeta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {creditAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
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
              name="description"
              rules={{ required: 'La descripción es obligatoria' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Compra en tienda departamental" 
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
              name="totalAmount"
              rules={{
                required: 'El monto total es obligatorio',
                validate: validateAmount,
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto Total</FormLabel>
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
              name="installments"
              rules={{ required: 'Selecciona el número de meses' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Meses</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona los meses" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {installmentOptions.map(months => (
                        <SelectItem key={months} value={months.toString()}>
                          {months} meses
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {monthlyAmount > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Pago mensual:</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrencyWithSymbol(monthlyAmount)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creando...' : 'Crear Plan'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default InstallmentPlanForm;
