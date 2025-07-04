
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction, Account } from '@/types';
import { ReportFilters } from './useReportFilters';

export const useTransactions = (filters: ReportFilters, accounts?: Account[]) => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      setError(null);
      
      try {
        let transactionsQuery = query(
          collection(db, 'users', currentUser.uid, 'transactions'),
          orderBy('date', 'desc')
        );

        // Aplicar filtros
        if (filters.type && filters.type !== 'all') {
          transactionsQuery = query(transactionsQuery, where('type', '==', filters.type));
        }

        if (filters.accountId) {
          transactionsQuery = query(transactionsQuery, where('accountId', '==', filters.accountId));
        }

        const snapshot = await getDocs(transactionsQuery);
        let transactionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() || new Date(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as Transaction[];

        // Filtrar por fechas si están definidas
        if (filters.startDate) {
          transactionsData = transactionsData.filter(t => t.date >= filters.startDate!);
        }
        
        if (filters.endDate) {
          transactionsData = transactionsData.filter(t => t.date <= filters.endDate!);
        }

        // Agregar saldos iniciales de todas las cuentas como transacciones virtuales
        // Solo para el cálculo de reportes, no son transacciones reales
        if (accounts && accounts.length > 0) {
          // Si hay filtro de cuenta específica, solo incluir esa cuenta
          const accountsToInclude = filters.accountId 
            ? accounts.filter(acc => acc.id === filters.accountId)
            : accounts;

          const virtualTransactions = accountsToInclude
            .filter(account => account.balance !== 0) // Solo mostrar cuentas con balance diferente a 0
            .map(account => {
              // Para cuentas de débito, el saldo inicial es un ingreso
              if (account.type === 'debit' && account.balance > 0) {
                return {
                  id: `virtual-${account.id}`,
                  type: 'income' as const,
                  amount: account.balance,
                  description: `Saldo inicial - ${account.name}`,
                  category: 'Saldo inicial',
                  accountId: account.id,
                  userId: currentUser.uid,
                  date: account.createdAt || new Date(2024, 0, 1),
                  createdAt: account.createdAt || new Date(2024, 0, 1),
                  isVirtual: true
                };
              }
              // Para cuentas de crédito, el saldo usado es un gasto
              else if (account.type === 'credit' && account.balance > 0) {
                return {
                  id: `virtual-${account.id}`,
                  type: 'expense' as const,
                  amount: account.balance,
                  description: `Saldo usado inicial - ${account.name}`,
                  category: 'Saldo inicial',
                  accountId: account.id,
                  userId: currentUser.uid,
                  date: account.createdAt || new Date(2024, 0, 1),
                  createdAt: account.createdAt || new Date(2024, 0, 1),
                  isVirtual: true
                };
              }
              // Para cuentas de deuda, el saldo es un gasto (lo que se debe)
              else if (account.type === 'debt' && account.balance > 0) {
                return {
                  id: `virtual-${account.id}`,
                  type: 'expense' as const,
                  amount: account.balance,
                  description: `Deuda inicial - ${account.name}`,
                  category: 'Saldo inicial',
                  accountId: account.id,
                  userId: currentUser.uid,
                  date: account.createdAt || new Date(2024, 0, 1),
                  createdAt: account.createdAt || new Date(2024, 0, 1),
                  isVirtual: true
                };
              }
              return null;
            })
            .filter(Boolean); // Filtrar valores null

          // Filtrar por tipo si aplica
          const filteredVirtualTransactions = virtualTransactions.filter(vt => {
            if (filters.type === 'all') return true;
            return vt!.type === filters.type;
          });

          transactionsData = [...filteredVirtualTransactions, ...transactionsData];
        }

        setTransactions(transactionsData);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError('Error al cargar las transacciones');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [currentUser, filters, accounts]);

  return { transactions, loading, error };
};
