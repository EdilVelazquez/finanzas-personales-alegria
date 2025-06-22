
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, DollarSign, Edit, Trash2 } from 'lucide-react';
import { RecurringIncome, RecurringExpense } from '@/types';
import { formatCurrencyWithSymbol } from '@/lib/formatCurrency';

interface RecurringItemsManagerProps {
  recurringIncomes: RecurringIncome[];
  recurringExpenses: RecurringExpense[];
  onAddIncome: () => void;
  onAddExpense: () => void;
  onEditIncome: (income: RecurringIncome) => void;
  onEditExpense: (expense: RecurringExpense) => void;
  onDeleteIncome: (income: RecurringIncome) => void;
  onDeleteExpense: (expense: RecurringExpense) => void;
}

const RecurringItemsManager: React.FC<RecurringItemsManagerProps> = ({
  recurringIncomes,
  recurringExpenses,
  onAddIncome,
  onAddExpense,
  onEditIncome,
  onEditExpense,
  onDeleteIncome,
  onDeleteExpense
}) => {
  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      case 'monthly': return 'Mensual';
      default: return frequency;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ingresos Fijos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Ingresos Fijos
            </CardTitle>
            <Button onClick={onAddIncome} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recurringIncomes.length > 0 ? (
              recurringIncomes.map((income) => (
                <div key={income.id} className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900">{income.name}</h4>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditIncome(income)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteIncome(income)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-green-600">
                      {formatCurrencyWithSymbol(income.amount)}
                    </span>
                    <span className="text-gray-600">{getFrequencyText(income.frequency)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>Próximo: {income.nextPaymentDate.toLocaleDateString('es-ES')}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay ingresos fijos registrados</p>
                <p className="text-xs">Agrega tu nómina u otros ingresos regulares</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gastos Recurrentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-red-600" />
              Gastos Recurrentes
            </CardTitle>
            <Button onClick={onAddExpense} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recurringExpenses.length > 0 ? (
              recurringExpenses.map((expense) => (
                <div key={expense.id} className="p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900">{expense.name}</h4>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditExpense(expense)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteExpense(expense)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-red-600">
                      {formatCurrencyWithSymbol(expense.amount)}
                    </span>
                    <span className="text-gray-600">{getFrequencyText(expense.frequency)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Próximo: {expense.nextPaymentDate.toLocaleDateString('es-ES')}</span>
                    </div>
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{expense.category}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay gastos recurrentes registrados</p>
                <p className="text-xs">Agrega pagos regulares como renta, servicios, etc.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecurringItemsManager;
