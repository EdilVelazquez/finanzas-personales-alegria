
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RecurringExpense } from '@/types';
import { defaultCategories } from '@/data/categories';
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

interface RecurringExpenseFormProps {
  open: boolean;
  onClose: () => void;
  expense?: RecurringExpense | null;
}

interface FormData {
  name: string;
  amount: string;
  category: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextPaymentDate: Date;
}

const RecurringExpenseForm: React.FC<RecurringExpenseFormProps> = ({ open, onClose, expense }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      name: expense?.name || '',
      amount: expense?.amount.toString() || '',
      category: expense?.category || '',
      frequency: expense?.frequency || 'monthly',
      nextPaymentDate: expense?.nextPaymentDate || new Date(),
    },
  });

  React.useEffect(() => {
    if (expense) {
      form.reset({
        name: expense.name,
        amount: expense.amount.toString(),
        category: expense.category,
        frequency: expense.frequency,
        nextPaymentDate: expense.nextPaymentDate,
      });
    } else {
      form.reset({
        name: '',
        amount: '',
        category: '',
        frequency: 'monthly',
        nextPaymentDate: new Date(),
      });
    }
  }, [expense, form]);

  const validateAmount = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'El monto debe ser un número válido';
    if (num <= 0) return 'El monto debe ser mayor a cero';
    return true;
  };

  const getExpenseCategories = () => {
    return defaultCategories.filter(cat => cat.type === 'expense');
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
      const expenseData = {
        name: data.name.trim(),
        amount: amount,
        category: data.category,
        frequency: data.frequency,
        nextPaymentDate: Timestamp.fromDate(data.nextPaymentDate),
        userId: currentUser.uid,
      };

      if (expense) {
        // Actualizar gasto existente
        await updateDoc(doc(db, 'users', currentUser.uid, 'recurringExpenses', expense.id), expenseData);
        toast({
          title: 'Gasto actualizado',
          description: 'El gasto recurrente se ha actualizado correctamente.',
        });
      } else {
        // Crear nuevo gasto
        await addDoc(collection(db, 'users', currentUser.uid, 'recurringExpenses'), {
          ...expenseData,
          createdAt: serverTimestamp(),
        });
        toast({
          title: 'Gasto creado',
          description: 'El gasto recurrente se ha registrado correctamente.',
        });
      }

      onClose();
    } catch (error) {
      console.error('Error al guardar gasto:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el gasto. Inténtalo de nuevo.',
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
            {expense ? 'Editar Gasto Recurrente' : 'Nuevo Gasto Recurrente'}
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
                      placeholder="Ej: Renta, Internet, Netflix..." 
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
              name="category"
              rules={{ required: 'La categoría es obligatoria' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getExpenseCategories().map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          <div className="flex items-center gap-2">
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
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
                {loading ? 'Guardando...' : (expense ? 'Guardar' : 'Crear')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringExpenseForm;
