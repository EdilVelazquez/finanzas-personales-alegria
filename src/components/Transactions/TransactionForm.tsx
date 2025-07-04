import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, query, onSnapshot, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, Transaction, RecurringExpense, InstallmentPlan } from '@/types';
import { useCategories } from '@/hooks/useCategories';
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
import { Calendar as CalendarIcon, Clock, CreditCard } from 'lucide-react';
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
  installmentMonths?: number;
  useInstallments?: boolean;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ open, onClose, transaction, accounts }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { categories } = useCategories();
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
      recurringExpenseId: 'none',
      installmentMonths: 1,
      useInstallments: false,
    },
  });

  const watchType = form.watch('type');
  const watchAccountId = form.watch('accountId');
  const watchRecurringExpenseId = form.watch('recurringExpenseId');
  const watchUseInstallments = form.watch('useInstallments');

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
      
      // Show expenses from 30 days ago (vencidos) hasta 30 días en el futuro
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
      const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
      const availableExpenses = expensesData.filter(expense => {
        const expenseDate = new Date(expense.nextPaymentDate);
        expenseDate.setHours(0, 0, 0, 0); // Start of expense date
        return expenseDate >= thirtyDaysAgo && expenseDate <= thirtyDaysFromNow;
      });
      
      setRecurringExpenses(availableExpenses);
    });

    return unsubscribe;
  }, [currentUser]);

  // Auto-fill form when recurring expense is selected
  useEffect(() => {
    if (watchRecurringExpenseId && watchRecurringExpenseId !== 'none' && recurringExpenses.length > 0) {
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
        recurringExpenseId: 'none',
        installmentMonths: 1,
        useInstallments: false,
      });
    } else {
      form.reset({
        type: 'expense',
        amount: '',
        date: new Date(),
        description: '',
        category: '',
        accountId: '',
        recurringExpenseId: 'none',
        installmentMonths: 1,
        useInstallments: false,
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
    
    // Para cuentas de débito, permitir balances negativos (no validar saldo insuficiente)
    if (account.type === 'debit') {
      // Permitir gastos sin importar el saldo actual
      return true;
    } else if (account.type === 'credit') {
      const availableCredit = (account.creditLimit || 0) - account.balance;
      if (availableCredit < amount) {
        return 'Límite de crédito insuficiente';
      }
    }
    
    return true;
  };

  const recalculateAccountBalance = async (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    // Obtener todas las transacciones de esta cuenta sin orden específico para evitar índice compuesto
    const transactionsQuery = query(
      collection(db, 'users', currentUser!.uid, 'transactions'),
      where('accountId', '==', accountId)
    );

    const snapshot = await getDocs(transactionsQuery);
    const accountTransactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(),
    })) as Transaction[];

    // Ordenar por fecha en JavaScript después de obtener los datos
    accountTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calcular el balance desde el saldo inicial (0) más las transacciones cronológicamente
    let newBalance = 0; // Siempre empezar desde 0 ya que quitamos los saldos iniciales virtuales

    for (const trans of accountTransactions) {
      if (account.type === 'debit') {
        if (trans.type === 'income') {
          newBalance += trans.amount;
        } else {
          newBalance -= trans.amount;
        }
      } else if (account.type === 'credit') {
        if (trans.type === 'expense') {
          newBalance += trans.amount;
        }
        // Los ingresos no afectan las cuentas de crédito directamente
      } else if (account.type === 'debt') {
        if (trans.type === 'expense') {
          newBalance += trans.amount;
        }
      }
    }

    await updateDoc(doc(db, 'users', currentUser!.uid, 'accounts', accountId), {
      balance: newBalance
    });
  };

  const createInstallmentPlan = async (accountId: string, amount: number, description: string, installmentMonths: number) => {
    const monthlyAmount = amount / installmentMonths;
    const startDate = new Date();
    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    await addDoc(collection(db, 'users', currentUser!.uid, 'installmentPlans'), {
      accountId: accountId,
      description: description,
      totalAmount: amount,
      installments: installmentMonths,
      monthlyAmount: monthlyAmount,
      remainingInstallments: installmentMonths,
      startDate: Timestamp.fromDate(startDate),
      nextPaymentDate: Timestamp.fromDate(nextPaymentDate),
      userId: currentUser!.uid,
      createdAt: serverTimestamp(),
      isActive: true
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
    return categories.filter(cat => cat.type === watchType);
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

  const selectedAccount = accounts.find(acc => acc.id === watchAccountId);
  const isCreditAccount = selectedAccount?.type === 'credit';
  const showInstallmentOption = watchType === 'expense' && isCreditAccount;

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
        await updateDoc(doc(db, 'users', currentUser.uid, 'transactions', transaction.id), transactionData);
        
        // Recalcular saldos de las cuentas involucradas
        const accountsToRecalculate = new Set([transaction.accountId, data.accountId]);
        for (const accountId of accountsToRecalculate) {
          await recalculateAccountBalance(accountId);
        }
        
        // Si se convirtió a meses sin intereses, crear el plan de pagos
        if (data.useInstallments && data.installmentMonths && data.installmentMonths > 1) {
          await createInstallmentPlan(
            data.accountId, 
            amount, 
            `${data.description} (${data.installmentMonths} MSI)`, 
            data.installmentMonths
          );
          
          toast({
            title: 'Transacción convertida a MSI',
            description: `Se creó un plan de ${data.installmentMonths} pagos de ${formatCurrencyWithSymbol(amount / data.installmentMonths)} cada uno.`,
          });
        } else {
          toast({
            title: 'Transacción actualizada',
            description: 'La transacción se ha actualizado correctamente.',
          });
        }
      } else {
        // Crear nueva transacción
        await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), {
          ...transactionData,
          createdAt: serverTimestamp(),
        });
        
        // Recalcular el saldo de la cuenta
        await recalculateAccountBalance(data.accountId);
        
        // Si se seleccionó meses sin intereses, crear el plan de pagos
        if (data.useInstallments && data.installmentMonths && data.installmentMonths > 1) {
          await createInstallmentPlan(
            data.accountId, 
            amount, 
            `${data.description} (${data.installmentMonths} MSI)`, 
            data.installmentMonths
          );
          
          toast({
            title: 'Compra a meses creada',
            description: `Se creó un plan de ${data.installmentMonths} pagos de ${formatCurrencyWithSymbol(amount / data.installmentMonths)} cada uno.`,
          });
        } else if (data.recurringExpenseId && data.recurringExpenseId !== 'none') {
          // Si se seleccionó un pago recurrente, actualizar su próxima fecha de pago
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

  const selectedRecurringExpense = recurringExpenses.find(exp => exp.id === watchRecurringExpenseId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                        <SelectItem value="none">Ninguno - transacción nueva</SelectItem>
                        {recurringExpenses.map((expense) => {
                          const today = new Date();
                          const isOverdue = expense.nextPaymentDate < today;
                          return (
                            <SelectItem key={expense.id} value={expense.id}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium">{expense.name}</span>
                                  <span className="text-sm text-green-600">
                                    {formatCurrencyWithSymbol(expense.amount)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {isOverdue ? 'Vencido: ' : 'Vence: '}
                                  {expense.nextPaymentDate.toLocaleDateString('es-ES')}
                                  {isOverdue && <span className="ml-1 text-red-500 font-medium">(PENDIENTE)</span>}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
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
                    <PopoverContent className="w-auto p-0 z-50 bg-background" align="start">
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

            {/* Opción de meses sin intereses para tarjetas de crédito */}
            {showInstallmentOption && (
              <>
                <FormField
                  control={form.control}
                  name="useInstallments"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Meses sin intereses
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Dividir el pago en mensualidades
                        </div>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          disabled={loading}
                          className="h-4 w-4"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {watchUseInstallments && (
                  <FormField
                    control={form.control}
                    name="installmentMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de meses</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))} 
                          value={field.value?.toString()} 
                          disabled={loading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona los meses" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[3, 6, 9, 12, 18, 24].map((months) => (
                              <SelectItem key={months} value={months.toString()}>
                                {months} meses
                                {parseFloat(form.watch('amount')) > 0 && (
                                  <span className="text-sm text-gray-500 ml-2">
                                    ({formatCurrencyWithSymbol(parseFloat(form.watch('amount')) / months)} mensual)
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

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
