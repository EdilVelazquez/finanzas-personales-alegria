
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
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
import { useInstallmentPlans } from '@/hooks/useInstallmentPlans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Trash2, Calendar, Plus } from 'lucide-react';
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
  const { installmentPlans, loading: plansLoading } = useInstallmentPlans();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingPlan, setEditingPlan] = useState<InstallmentPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<InstallmentPlan | null>(null);

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
      setView('list');
      setEditingPlan(null);
      form.reset({
        accountId: '',
        description: '',
        totalAmount: '',
        installments: '3',
      });
    }
  }, [open, form]);

  useEffect(() => {
    if (editingPlan) {
      form.reset({
        accountId: editingPlan.accountId,
        description: editingPlan.description,
        totalAmount: editingPlan.totalAmount.toString(),
        installments: editingPlan.installments.toString(),
      });
    }
  }, [editingPlan, form]);

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
      if (editingPlan) {
        // Actualizar plan existente
        const installmentData = {
          accountId: data.accountId,
          description: data.description.trim(),
          totalAmount: totalAmount,
          installments: installments,
          monthlyAmount: monthlyAmount,
          remainingInstallments: editingPlan.remainingInstallments, // Mantener las cuotas restantes
        };

        await updateDoc(doc(db, 'users', currentUser.uid, 'installmentPlans', editingPlan.id), installmentData);

        toast({
          title: 'Plan de pagos actualizado',
          description: 'Los cambios se guardaron correctamente.',
        });
      } else {
        // Crear nuevo plan
        const nextPaymentDate = new Date();
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        nextPaymentDate.setDate(1);

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
      }

      setView('list');
      setEditingPlan(null);
    } catch (error) {
      console.error('Error al guardar plan de pagos:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el plan de pagos. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: InstallmentPlan) => {
    setEditingPlan(plan);
    setView('form');
  };

  const handleDelete = async (plan: InstallmentPlan) => {
    if (!currentUser) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid, 'installmentPlans', plan.id), {
        isActive: false
      });

      toast({
        title: 'Plan de pagos eliminado',
        description: 'El plan se eliminó correctamente.',
      });

      setDeletingPlan(null);
    } catch (error) {
      console.error('Error al eliminar plan:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el plan de pagos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getAccountName = (accountId: string) => {
    const account = creditAccounts.find(acc => acc.id === accountId);
    return account?.name || 'Cuenta eliminada';
  };

  const installmentOptions = [3, 6, 9, 12, 18, 24];

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {view === 'list' ? 'Pagos a Meses' : (editingPlan ? 'Editar Plan de Pagos' : 'Nuevo Plan de Pagos')}
            </DialogTitle>
          </DialogHeader>

          {view === 'list' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  {installmentPlans.length} plan(es) activo(s)
                </p>
                <Button 
                  onClick={() => setView('form')} 
                  size="sm"
                  disabled={loading || plansLoading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Plan
                </Button>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-3">
                {plansLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Cargando...</p>
                  </div>
                ) : installmentPlans.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes planes activos</h3>
                    <p className="text-gray-600 mb-4">Crea tu primer plan de pagos a meses</p>
                    <Button onClick={() => setView('form')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Plan
                    </Button>
                  </div>
                ) : (
                  installmentPlans.map((plan) => (
                    <Card key={plan.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{plan.description}</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(plan)}
                              disabled={loading}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingPlan(plan)}
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{getAccountName(plan.accountId)}</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Total:</span>
                            <div className="font-bold">{formatCurrencyWithSymbol(plan.totalAmount)}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Pago mensual:</span>
                            <div className="font-bold text-blue-600">{formatCurrencyWithSymbol(plan.monthlyAmount)}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Restantes:</span>
                            <div className="font-medium">{plan.remainingInstallments} de {plan.installments}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Próximo pago:</span>
                            <div className="font-medium">{plan.nextPaymentDate.toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ 
                              width: `${((plan.installments - plan.remainingInstallments) / plan.installments) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
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
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setView('list');
                      setEditingPlan(null);
                    }} 
                    disabled={loading}
                  >
                    Volver
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (editingPlan ? 'Actualizando...' : 'Creando...') : (editingPlan ? 'Actualizar Plan' : 'Crear Plan')}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPlan} onOpenChange={() => setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plan de pagos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el plan "{deletingPlan?.description}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingPlan && handleDelete(deletingPlan)}
              disabled={loading}
            >
              {loading ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InstallmentPlanForm;
