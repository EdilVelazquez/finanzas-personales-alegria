
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';

interface AccountFormProps {
  open: boolean;
  onClose: () => void;
  account?: Account | null;
  accounts: Account[];
}

interface FormData {
  name: string;
  type: 'debit' | 'credit' | 'debt';
  balance: string;
  creditLimit: string;
  cutoffDate: string;
  paymentDueDate: string;
  totalDebt: string;
  paidAmount: string;
  totalMonths: string;
  monthlyPaymentDay: string;
}

const AccountForm: React.FC<AccountFormProps> = ({ open, onClose, account, accounts }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      name: '',
      type: 'debit',
      balance: '0',
      creditLimit: '0',
      cutoffDate: '1',
      paymentDueDate: '20',
      totalDebt: '0',
      paidAmount: '0',
      totalMonths: '12',
      monthlyPaymentDay: '1',
    },
  });

  const watchType = form.watch('type');

  useEffect(() => {
    if (account) {
      form.reset({
        name: account.name,
        type: account.type,
        balance: account.balance.toString(),
        creditLimit: (account.creditLimit || 0).toString(),
        cutoffDate: (account.cutoffDate || 1).toString(),
        paymentDueDate: (account.paymentDueDate || 20).toString(),
        totalDebt: (account.totalDebt || 0).toString(),
        paidAmount: account.totalDebt ? ((account.totalDebt - account.balance) || 0).toString() : '0',
        totalMonths: (account.totalMonths || 12).toString(),
        monthlyPaymentDay: account.nextPaymentDate ? account.nextPaymentDate.getDate().toString() : '1',
      });
    } else {
      form.reset({
        name: '',
        type: 'debit',
        balance: '0',
        creditLimit: '0',
        cutoffDate: '1',
        paymentDueDate: '20',
        totalDebt: '0',
        paidAmount: '0',
        totalMonths: '12',
        monthlyPaymentDay: '1',
      });
    }
  }, [account, form]);

  const validateName = (name: string) => {
    if (!name.trim()) return 'El nombre es obligatorio';
    
    const existingAccount = accounts.find(
      acc => acc.name.toLowerCase() === name.toLowerCase() && acc.id !== account?.id
    );
    if (existingAccount) return 'Ya existe una cuenta con este nombre';
    
    return true;
  };

  const validateAmount = (value: string, fieldName: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return `${fieldName} debe ser un número válido`;
    if (num < 0) return `${fieldName} no puede ser negativo`;
    return true;
  };

  const validateDay = (value: string, fieldName: string) => {
    const day = parseInt(value);
    if (isNaN(day)) return `${fieldName} debe ser un número válido`;
    if (day < 1 || day > 31) return `${fieldName} debe estar entre 1 y 31`;
    return true;
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser) return;

    const nameValidation = validateName(data.name);
    if (nameValidation !== true) {
      form.setError('name', { message: nameValidation });
      return;
    }

    setLoading(true);

    try {
      // Preparar los datos base
      const baseData = {
        name: data.name.trim(),
        type: data.type,
        userId: currentUser.uid,
      };

      // Agregar campos específicos según el tipo de cuenta
      let accountData;
      if (data.type === 'debit') {
        accountData = {
          ...baseData,
          balance: parseFloat(data.balance),
        };
      } else if (data.type === 'credit') {
        accountData = {
          ...baseData,
          balance: parseFloat(data.balance) || 0,
          creditLimit: parseFloat(data.creditLimit),
          cutoffDate: parseInt(data.cutoffDate),
          paymentDueDate: parseInt(data.paymentDueDate),
        };
      } else if (data.type === 'debt') {
        const totalDebt = parseFloat(data.totalDebt);
        const paidAmount = parseFloat(data.paidAmount) || 0;
        const totalMonths = parseInt(data.totalMonths);
        const remainingDebt = totalDebt - paidAmount;
        const monthlyPayment = remainingDebt / (totalMonths - (paidAmount > 0 ? Math.floor(paidAmount / (totalDebt / totalMonths)) : 0));
        const remainingMonths = Math.ceil(remainingDebt / monthlyPayment);
        
        // Calcular próxima fecha de pago
        const today = new Date();
        const nextPaymentDate = new Date(today.getFullYear(), today.getMonth(), parseInt(data.monthlyPaymentDay));
        if (nextPaymentDate <= today) {
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        }

        accountData = {
          ...baseData,
          balance: remainingDebt, // balance representa la deuda restante
          totalDebt,
          monthlyPayment: isFinite(monthlyPayment) ? monthlyPayment : 0,
          totalMonths,
          remainingMonths: remainingMonths > 0 ? remainingMonths : 0,
          nextPaymentDate,
        };
      }

      if (account) {
        // Actualizar cuenta existente
        await updateDoc(doc(db, 'users', currentUser.uid, 'accounts', account.id), accountData);
        toast({
          title: 'Cuenta actualizada',
          description: 'La cuenta se ha actualizado correctamente.',
        });
      } else {
        // Crear nueva cuenta
        await addDoc(collection(db, 'users', currentUser.uid, 'accounts'), {
          ...accountData,
          createdAt: serverTimestamp(),
        });
        toast({
          title: 'Cuenta creada',
          description: 'La cuenta se ha creado correctamente.',
        });
      }

      onClose();
    } catch (error) {
      console.error('Error al guardar cuenta:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la cuenta. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Generar opciones de días del mes
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {account ? 'Editar Cuenta' : 'Nueva Cuenta'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{
                required: 'El nombre es obligatorio',
                validate: validateName,
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la cuenta</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Cuenta de Ahorro, Tarjeta Visa" 
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cuenta</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="credit">Crédito</SelectItem>
                      <SelectItem value="debt">Deuda</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchType === 'debit' && (
              <FormField
                control={form.control}
                name="balance"
                rules={{
                  required: 'El saldo inicial es obligatorio',
                  validate: (value) => validateAmount(value, 'El saldo inicial'),
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo inicial</FormLabel>
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
            )}

            {watchType === 'credit' && (
              <>
                <FormField
                  control={form.control}
                  name="creditLimit"
                  rules={{
                    required: 'El límite de crédito es obligatorio',
                    validate: (value) => validateAmount(value, 'El límite de crédito'),
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Límite de crédito</FormLabel>
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
                  name="balance"
                  rules={{
                    validate: (value) => validateAmount(value, 'El saldo usado'),
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saldo usado (opcional)</FormLabel>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cutoffDate"
                    rules={{
                      required: 'La fecha de corte es obligatoria',
                      validate: (value) => validateDay(value, 'La fecha de corte'),
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Corte</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Día" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dayOptions.map(day => (
                              <SelectItem key={day} value={day.toString()}>
                                {day}
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
                    name="paymentDueDate"
                    rules={{
                      required: 'La fecha límite de pago es obligatoria',
                      validate: (value) => validateDay(value, 'La fecha límite de pago'),
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Límite de Pago</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Día" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dayOptions.map(day => (
                              <SelectItem key={day} value={day.toString()}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {watchType === 'debt' && (
              <>
                <FormField
                  control={form.control}
                  name="totalDebt"
                  rules={{
                    required: 'El total de la deuda es obligatorio',
                    validate: (value) => validateAmount(value, 'El total de la deuda'),
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total de la deuda</FormLabel>
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
                  name="paidAmount"
                  rules={{
                    validate: (value) => validateAmount(value, 'El monto pagado'),
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>¿Cuánto has pagado? (opcional)</FormLabel>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalMonths"
                    rules={{
                      required: 'Los meses son obligatorios',
                      validate: (value) => {
                        const months = parseInt(value);
                        if (isNaN(months)) return 'Debe ser un número válido';
                        if (months < 1) return 'Debe ser al menos 1 mes';
                        if (months > 360) return 'No puede ser más de 360 meses';
                        return true;
                      },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>¿A cuántos meses?</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="12" 
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
                    name="monthlyPaymentDay"
                    rules={{
                      required: 'El día de pago es obligatorio',
                      validate: (value) => validateDay(value, 'El día de pago'),
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Día de pago mensual</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={loading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Día" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dayOptions.map(day => (
                              <SelectItem key={day} value={day.toString()}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : (account ? 'Guardar' : 'Crear')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AccountForm;
