import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Category } from '@/types';
import { defaultCategories } from '@/data/categories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface CategoryFormData {
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

const CategoriesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm<CategoryFormData>({
    defaultValues: {
      name: '',
      type: 'expense',
      color: '#ef4444',
      icon: '📝'
    }
  });

  const watchedType = watch('type');

  useEffect(() => {
    if (!currentUser) return;

    const categoriesQuery = query(
      collection(db, 'users', currentUser.uid, 'categories')
    );

    const unsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];

      // Si no hay categorías personalizadas, agregar las predeterminadas
      if (categoriesData.length === 0) {
        // Crear categorías predeterminadas
        defaultCategories.forEach(async (category) => {
          await addDoc(collection(db, 'users', currentUser.uid, 'categories'), category);
        });
      }

      setCategories(categoriesData);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  const onSubmit = async (data: CategoryFormData) => {
    if (!currentUser) return;

    try {
      const categoryData = {
        ...data,
        userId: currentUser.uid
      };

      if (editingCategory) {
        await updateDoc(doc(db, 'users', currentUser.uid, 'categories', editingCategory.id), categoryData);
        toast({
          title: 'Categoría actualizada',
          description: 'La categoría se ha actualizado correctamente.',
        });
      } else {
        await addDoc(collection(db, 'users', currentUser.uid, 'categories'), categoryData);
        toast({
          title: 'Categoría creada',
          description: 'La nueva categoría se ha creado correctamente.',
        });
      }

      handleCloseForm();
    } catch (error) {
      console.error('Error al guardar categoría:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la categoría. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setValue('name', category.name);
    setValue('type', category.type);
    setValue('color', category.color);
    setValue('icon', category.icon);
    setIsFormOpen(true);
  };

  const handleDelete = async (category: Category) => {
    if (!currentUser) return;

    if (confirm(`¿Estás seguro de que quieres eliminar la categoría "${category.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'categories', category.id));
        toast({
          title: 'Categoría eliminada',
          description: 'La categoría se ha eliminado correctamente.',
        });
      } catch (error) {
        console.error('Error al eliminar categoría:', error);
        toast({
          title: 'Error',
          description: 'No se pudo eliminar la categoría. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    reset();
  };

  const incomeCategories = categories.filter(cat => cat.type === 'income');
  const expenseCategories = categories.filter(cat => cat.type === 'expense');

  const commonColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#6b7280', '#374151', '#111827'
  ];

  const commonIcons = [
    '💼', '💰', '🏠', '🚗', '🍽️', '🎬', '💡', '📱',
    '👕', '🏥', '📚', '🎓', '✈️', '🛒', '🎁', '💸',
    '📈', '💻', '🔧', '🎵', '🏃‍♂️', '🐕', '🌱', '📝'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categorías</h2>
          <p className="text-gray-600">Gestiona las categorías de tus ingresos y gastos</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Categoría
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorías de Ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Tag className="h-5 w-5" />
              Categorías de Ingresos ({incomeCategories.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {incomeCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: category.color }}
                    >
                      <span className="text-sm">{category.icon}</span>
                    </div>
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(category)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {incomeCategories.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No hay categorías de ingresos
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Categorías de Gastos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Tag className="h-5 w-5" />
              Categorías de Gastos ({expenseCategories.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expenseCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: category.color }}
                    >
                      <span className="text-sm">{category.icon}</span>
                    </div>
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(category)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {expenseCategories.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No hay categorías de gastos
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de formulario */}
      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                {...register('name', { required: true })}
                placeholder="Nombre de la categoría"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select 
                value={watchedType} 
                onValueChange={(value) => setValue('type', value as 'income' | 'expense')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex flex-wrap gap-2">
                {commonColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400"
                    style={{ backgroundColor: color }}
                    onClick={() => setValue('color', color)}
                  />
                ))}
              </div>
              <Input
                {...register('color')}
                type="color"
                className="w-full h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icono</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {commonIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className="w-8 h-8 text-lg hover:bg-gray-100 rounded"
                    onClick={() => setValue('icon', icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <Input
                {...register('icon', { required: true })}
                placeholder="Emoji del icono"
                maxLength={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingCategory ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoriesPage;