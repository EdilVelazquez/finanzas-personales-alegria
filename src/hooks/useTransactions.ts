
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction } from '@/types';
import { ReportFilters } from './useReportFilters';

export const useTransactions = (filters: ReportFilters) => {
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

        setTransactions(transactionsData);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError('Error al cargar las transacciones');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [currentUser, filters]);

  return { transactions, loading, error };
};
