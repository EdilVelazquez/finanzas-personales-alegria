
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

        // Agregar saldos iniciales de cuentas de débito como "ingresos" virtuales
        // Solo para el cálculo de reportes, no son transacciones reales
        if (accounts && accounts.length > 0) {
          const debitAccounts = accounts.filter(acc => acc.type === 'debit' && acc.balance > 0);
          
          // Si hay filtro de cuenta específica, solo incluir esa cuenta
          const accountsToInclude = filters.accountId 
            ? debitAccounts.filter(acc => acc.id === filters.accountId)
            : debitAccounts;

          const virtualIncomes = accountsToInclude.map(account => ({
            id: `virtual-${account.id}`,
            type: 'income' as const,
            amount: account.balance,
            description: `Saldo inicial - ${account.name}`,
            category: 'Saldo inicial',
            accountId: account.id,
            userId: currentUser.uid,
            date: account.createdAt || new Date(2024, 0, 1), // Fecha anterior a las transacciones
            createdAt: account.createdAt || new Date(2024, 0, 1),
            isVirtual: true // Marcador para identificar transacciones virtuales
          }));

          // Solo agregar ingresos virtuales si no hay filtro de tipo 'expense'
          if (filters.type !== 'expense') {
            transactionsData = [...virtualIncomes, ...transactionsData];
          }
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
