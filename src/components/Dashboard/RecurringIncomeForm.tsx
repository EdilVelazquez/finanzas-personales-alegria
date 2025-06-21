
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RecurringIncome } from '@/types';
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecurringIncomeFormProps {
  open: boolean;
  onClose: () => void;
  income?: RecurringIncome | null;
}

interface FormData {
  name: string;
  amount: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextPaymentDate: Date;
}

const RecurringIncomeForm: React.FC<RecurringIncomeFormProps> = ({ open, onClose, income }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      name: income?.name || '',
      amount: income?.amount.toString() || '',
      frequency: income?.frequency || 'monthly',
      nextPaymentDate: income?.nextPaymentDate || new Date(),
    },
  });

  React.useEffect(() => {
    if (income) {
      form.reset({
        name: income.name,
        amount: income.amount.toString(),
        frequency: income.frequency,
        nextPaymentDate: income.nextPaymentDate,
      });
    } else {
      form.reset({
        name: '',
        amount: '',
        frequency: 'monthly',
        nextPaymentDate: new Date(),
      });
    }
  }, [income, form]);

  const validateAmount = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'El monto debe ser un número válido';
    if (num <= 0) return 'El monto debe ser mayor a cero';
    return true;
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser) return;

    const amount = parseFloat(data.amount);
    const amountValidation = validateAmount(data.amount);
    if (amountValidation !== true) {
      form.setError('amount', { message: amountValidation });
      return;
    }

    setLoading(true);

    try {
      const incomeData = {
        name: data.name.trim(),
        amount: amount,
        frequency: data.frequency,
        nextPaymentDate: Timestamp.fromDate(data.nextPaymentDate),
        userId: currentUser.uid,
      };

      if (income) {
        // Actualizar ingreso existente
        await updateDoc(doc(db, 'users', currentUser.uid, 'recurringIncomes', income.id), incomeData);
        toast({
          title: 'Ingreso actualizado',
          description: 'El ingreso fijo se ha actualizado correctamente.',
        });
      } else {
        // Crear nuevo ingreso
        await addDoc(collection(db, 'users', currentUser.uid, 'recurringIncomes'), {
          ...incomeData,
          createdAt: serverTimestamp(),
        });
        toast({
          title: 'Ingreso creado',
          description: 'El ingreso fijo se ha registrado correctamente.',
        });
      }

      onClose();
    } catch (error) {
      console.error('Error al guardar ingreso:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el ingreso. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {income ? 'Editar Ingreso Fijo' : 'Nuevo Ingreso Fijo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: 'El nombre es obligatorio' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Nómina, Freelance..." 
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
              name="amount"
              rules={{
                required: 'El monto es obligatorio',
                validate: validateAmount,
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
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
              name="frequency"
              rules={{ required: 'La frecuencia es obligatoria' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frecuencia</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la frecuencia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quincenal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextPaymentDate"
              rules={{ required: 'La fecha es obligatoria' }}
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Próximo Pago</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={loading}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Selecciona una fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : (income ? 'Guardar' : 'Crear')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringIncomeForm;
