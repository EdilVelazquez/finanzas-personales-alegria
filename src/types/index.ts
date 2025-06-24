
export interface Account {
  id: string;
  name: string;
  type: 'debit' | 'credit';
  balance: number;
  creditLimit?: number;
  userId: string;
  createdAt: Date;
  // Nuevos campos para tarjetas de crédito
  cutoffDate?: number; // Día del mes (1-31)
  paymentDueDate?: number; // Día del mes (1-31)
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  accountId: string;
  userId: string;
  date: Date;
  createdAt: Date;
  isVirtual?: boolean; // Para identificar transacciones virtuales (saldos iniciales)
}

export interface Transfer {
  id: string;
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  description: string;
  userId: string;
  date: Date;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

export interface RecurringIncome {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextPaymentDate: Date;
  userId: string;
  createdAt: Date;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextPaymentDate: Date;
  userId: string;
  createdAt: Date;
  // Nuevos campos para pagos automáticos de tarjetas
  isAutomaticCreditPayment?: boolean;
  linkedAccountId?: string; // ID de la tarjeta de crédito asociada
}

// Nueva interfaz para pagos a meses sin intereses
export interface InstallmentPlan {
  id: string;
  accountId: string; // Tarjeta de crédito
  description: string;
  totalAmount: number;
  installments: number; // Número total de meses
  monthlyAmount: number; // Pago mensual
  remainingInstallments: number;
  startDate: Date;
  nextPaymentDate: Date;
  userId: string;
  createdAt: Date;
  isActive: boolean;
}
