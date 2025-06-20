
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
  type: 'debit' | 'credit';
  balance: string;
  creditLimit: string;
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
      });
    } else {
      form.reset({
        name: '',
        type: 'debit',
        balance: '0',
        creditLimit: '0',
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
      } else {
        accountData = {
          ...baseData,
          balance: parseFloat(data.balance) || 0,
          creditLimit: parseFloat(data.creditLimit),
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
