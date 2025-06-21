
export interface Account {
  id: string;
  name: string;
  type: 'debit' | 'credit';
  balance: number;
  creditLimit?: number;
  userId: string;
  createdAt: Date;
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
}
