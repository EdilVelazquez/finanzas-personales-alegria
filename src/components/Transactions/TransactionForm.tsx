import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, Transaction, RecurringExpense } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';
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
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  accounts: Account[];
}

interface FormData {
  type: 'income' | 'expense';
  amount: string;
  date: Date;
  description: string;
  category: string;
  accountId: string;
  recurringExpenseId?: string;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ open, onClose, transaction, accounts }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);

  const form = useForm<FormData>({
    defaultValues: {
      type: 'expense',
      amount: '',
      date: new Date(),
      description: '',
      category: '',
      accountId: '',
      recurringExpenseId: '',
    },
  });

  const watchType = form.watch('type');
  const watchAccountId = form.watch('accountId');
  const watchRecurringExpenseId = form.watch('recurringExpenseId');

  // Load recurring expenses
  useEffect(() => {
    if (!currentUser) return;

    const recurringExpensesQuery = query(
      collection(db, 'users', currentUser.uid, 'recurringExpenses'),
      orderBy('nextPaymentDate', 'asc')
    );

    const unsubscribe = onSnapshot(recurringExpensesQuery, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        nextPaymentDate: doc.data().nextPaymentDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as RecurringExpense[];
      
      // Only show upcoming expenses (within next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      const upcomingExpenses = expensesData.filter(expense => 
        expense.nextPaymentDate >= now && expense.nextPaymentDate <= thirtyDaysFromNow
      );
      
      setRecurringExpenses(upcomingExpenses);
    });

    return unsubscribe;
  }, [currentUser]);

  // Auto-fill form when recurring expense is selected
  useEffect(() => {
    if (watchRecurringExpenseId && recurringExpenses.length > 0) {
      const selectedExpense = recurringExpenses.find(exp => exp.id === watchRecurringExpenseId);
      if (selectedExpense) {
        form.setValue('type', 'expense');
        form.setValue('amount', selectedExpense.amount.toString());
        form.setValue('description', `Pago adelantado: ${selectedExpense.name}`);
        form.setValue('category', selectedExpense.category);
      }
    }
  }, [watchRecurringExpenseId, recurringExpenses, form]);

  useEffect(() => {
    if (transaction) {
      form.reset({
        type: transaction.type,
        amount: transaction.amount.toString(),
        date: transaction.date,
        description: transaction.description,
        category: transaction.category,
        accountId: transaction.accountId,
        recurringExpenseId: '',
      });
    } else {
      form.reset({
        type: 'expense',
        amount: '',
        date: new Date(),
        description: '',
        category: '',
        accountId: '',
        recurringExpenseId: '',
      });
    }
  }, [transaction, form]);

  const validateAmount = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'El monto debe ser un número válido';
    if (num <= 0) return 'El monto debe ser mayor a cero';
    return true;
  };

  const validateAccountBalance = (accountId: string, amount: number, type: 'income' | 'expense') => {
    if (type === 'income') return true;
    
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return 'Cuenta no encontrada';
    
    if (account.type === 'debit') {
      if (account.balance < amount) {
        return 'Saldo insuficiente en la cuenta';
      }
    } else if (account.type === 'credit') {
      const availableCredit = (account.creditLimit || 0) - account.balance;
      if (availableCredit < amount) {
        return 'Límite de crédito insuficiente';
      }
    }
    
    return true;
  };

  const updateAccountBalance = async (accountId: string, amount: number, type: 'income' | 'expense', isReversal = false) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    let newBalance = account.balance;
    
    if (account.type === 'debit') {
      if (type === 'income') {
        newBalance = isReversal ? account.balance - amount : account.balance + amount;
      } else {
        newBalance = isReversal ? account.balance + amount : account.balance - amount;
      }
    } else if (account.type === 'credit') {
      if (type === 'expense') {
        newBalance = isReversal ? account.balance - amount : account.balance + amount;
      }
      // Los ingresos no afectan las cuentas de crédito directamente
    }

    await updateDoc(doc(db, 'users', currentUser!.uid, 'accounts', accountId), {
      balance: newBalance
    });
  };

  const updateRecurringExpenseNextPayment = async (recurringExpenseId: string) => {
    const expense = recurringExpenses.find(exp => exp.id === recurringExpenseId);
    if (!expense) return;

    // Calculate next payment date based on frequency
    const currentDate = expense.nextPaymentDate;
    let nextPaymentDate = new Date(currentDate);

    switch (expense.frequency) {
      case 'weekly':
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
        break;
      case 'biweekly':
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 14);
        break;
      case 'monthly':
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        break;
    }

    await updateDoc(doc(db, 'users', currentUser!.uid, 'recurringExpenses', recurringExpenseId), {
      nextPaymentDate: Timestamp.fromDate(nextPaymentDate)
    });
  };

  const getAvailableCategories = () => {
    return defaultCategories.filter(cat => cat.type === watchType);
  };

  const getAvailableAccounts = () => {
    if (watchType === 'income') {
      // Los ingresos solo van a cuentas de débito
      return accounts.filter(acc => acc.type === 'debit');
    } else {
      // Los gastos pueden ir a cualquier cuenta
      return accounts;
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser) return;

    const amount = parseFloat(data.amount);
    const amountValidation = validateAmount(data.amount);
    if (amountValidation !== true) {
      form.setError('amount', { message: amountValidation });
      return;
    }

    const balanceValidation = validateAccountBalance(data.accountId, amount, data.type);
    if (balanceValidation !== true) {
      form.setError('accountId', { message: balanceValidation });
      return;
    }

    setLoading(true);

    try {
      const transactionData = {
        type: data.type,
        amount: amount,
        date: Timestamp.fromDate(data.date),
        description: data.description.trim(),
        category: data.category,
        accountId: data.accountId,
        userId: currentUser.uid,
      };

      if (transaction) {
        // Actualizar transacción existente
        // Primero revertir el efecto de la transacción anterior
        await updateAccountBalance(transaction.accountId, transaction.amount, transaction.type, true);
        
        // Actualizar la transacción
        await updateDoc(doc(db, 'users', currentUser.uid, 'transactions', transaction.id), transactionData);
        
        // Aplicar el nuevo efecto
        await updateAccountBalance(data.accountId, amount, data.type);
        
        toast({
          title: 'Transacción actualizada',
          description: 'La transacción se ha actualizado correctamente.',
        });
      } else {
        // Crear nueva transacción
        await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), {
          ...transactionData,
          createdAt: serverTimestamp(),
        });
        
        // Actualizar el saldo de la cuenta
        await updateAccountBalance(data.accountId, amount, data.type);
        
        // Si se seleccionó un pago recurrente, actualizar su próxima fecha de pago
        if (data.recurringExpenseId) {
          await updateRecurringExpenseNextPayment(data.recurringExpenseId);
          toast({
            title: 'Pago adelantado registrado',
            description: 'El pago recurrente ha sido marcado como saldado y se actualizó la próxima fecha.',
          });
        } else {
          toast({
            title: 'Transacción creada',
            description: 'La transacción se ha registrado correctamente.',
          });
        }
      }

      onClose();
    } catch (error) {
      console.error('Error al guardar transacción:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la transacción. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(acc => acc.id === watchAccountId);
  const selectedRecurringExpense = recurringExpenses.find(exp => exp.id === watchRecurringExpenseId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Editar Transacción' : 'Nueva Transacción'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Selector de pago recurrente - Solo para gastos y cuando no está editando */}
            {!transaction && watchType === 'expense' && recurringExpenses.length > 0 && (
              <FormField
                control={form.control}
                name="recurringExpenseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Adelantar pago programado (opcional)
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un pago para adelantar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Ninguno - transacción nueva</SelectItem>
                        {recurringExpenses.map((expense) => (
                          <SelectItem key={expense.id} value={expense.id}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between w-full">
                                <span className="font-medium">{expense.name}</span>
                                <span className="text-sm text-green-600">
                                  {formatCurrencyWithSymbol(expense.amount)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Vence: {expense.nextPaymentDate.toLocaleDateString('es-ES')}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedRecurringExpense && (
                      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        💡 Al confirmar, este pago se marcará como saldado y la próxima fecha se actualizará automáticamente.
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de transacción</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">Ingreso</SelectItem>
                      <SelectItem value="expense">Gasto</SelectItem>
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
              name="date"
              rules={{ required: 'La fecha es obligatoria' }}
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha</FormLabel>
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
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                    <Textarea 
                      placeholder="Describe la transacción..." 
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
                      {getAvailableCategories().map((category) => (
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
              name="accountId"
              rules={{ required: 'La cuenta es obligatoria' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una cuenta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAvailableAccounts().map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{account.name}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              ({account.type === 'debit' ? 'Débito' : 'Crédito'})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAccount && (
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedAccount.type === 'debit' ? (
                        `Saldo disponible: ${formatCurrencyWithSymbol(selectedAccount.balance)}`
                      ) : (
                        `Crédito disponible: ${formatCurrencyWithSymbol((selectedAccount.creditLimit || 0) - selectedAccount.balance)}`
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : (transaction ? 'Guardar' : 'Crear')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionForm;
