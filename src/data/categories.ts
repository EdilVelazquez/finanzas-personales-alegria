
import { Category } from '@/types';

export const defaultCategories: Omit<Category, 'id'>[] = [
  // Categorías de Gastos
  { name: 'Alimentación', type: 'expense', color: '#ef4444', icon: '🍽️' },
  { name: 'Transporte', type: 'expense', color: '#f97316', icon: '🚗' },
  { name: 'Vivienda', type: 'expense', color: '#8b5cf6', icon: '🏠' },
  { name: 'Salud', type: 'expense', color: '#ec4899', icon: '🏥' },
  { name: 'Entretenimiento', type: 'expense', color: '#06b6d4', icon: '🎬' },
  { name: 'Ropa', type: 'expense', color: '#84cc16', icon: '👕' },
  { name: 'Educación', type: 'expense', color: '#6366f1', icon: '📚' },
  { name: 'Servicios', type: 'expense', color: '#f59e0b', icon: '💡' },
  { name: 'Otros Gastos', type: 'expense', color: '#6b7280', icon: '💸' },
  
  // Categorías de Ingresos
  { name: 'Salario', type: 'income', color: '#10b981', icon: '💼' },
  { name: 'Freelance', type: 'income', color: '#3b82f6', icon: '💻' },
  { name: 'Inversiones', type: 'income', color: '#8b5cf6', icon: '📈' },
  { name: 'Venta', type: 'income', color: '#f59e0b', icon: '🛒' },
  { name: 'Otros Ingresos', type: 'income', color: '#6b7280', icon: '💰' }
];
