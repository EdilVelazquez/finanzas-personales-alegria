import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Category } from '@/types';
import { defaultCategories } from '@/data/categories';

export const useCategories = () => {
  const { currentUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const categoriesQuery = query(
      collection(db, 'users', currentUser.uid, 'categories')
    );

    const unsubscribe = onSnapshot(categoriesQuery, async (snapshot) => {
      let categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];

      // Si no hay categorías personalizadas, agregar las predeterminadas
      if (categoriesData.length === 0) {
        try {
          // Crear categorías predeterminadas
          for (const category of defaultCategories) {
            await addDoc(collection(db, 'users', currentUser.uid, 'categories'), {
              ...category,
              userId: currentUser.uid
            });
          }
        } catch (error) {
          console.error('Error creating default categories:', error);
          // Si hay error, usar las categorías por defecto temporalmente
          categoriesData = defaultCategories.map((cat, index) => ({
            ...cat,
            id: `default-${index}`,
            userId: currentUser.uid
          })) as Category[];
        }
      }

      setCategories(categoriesData);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  const getIncomeCategories = () => categories.filter(cat => cat.type === 'income');
  const getExpenseCategories = () => categories.filter(cat => cat.type === 'expense');

  return { 
    categories, 
    loading, 
    incomeCategories: getIncomeCategories(),
    expenseCategories: getExpenseCategories()
  };
};