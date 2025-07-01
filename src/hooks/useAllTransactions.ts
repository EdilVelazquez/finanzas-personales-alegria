import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction, InstallmentPlan } from '@/types';

export const useAllTransactions = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setTransactions([]);
      return;
    }

    setLoading(true);

    // Escuchar transacciones regulares
    const transactionsQuery = query(
      collection(db, 'users', currentUser.uid, 'transactions'),
      orderBy('date', 'desc')
    );

    // Escuchar planes de installment activos
    const installmentPlansQuery = query(
      collection(db, 'users', currentUser.uid, 'installmentPlans'),
      where('isActive', '==', true),
      orderBy('nextPaymentDate', 'asc')
    );

    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Transaction[];

      // Escuchar planes de installment y convertirlos a "transacciones virtuales"
      const unsubscribeInstallments = onSnapshot(installmentPlansQuery, (installmentSnapshot) => {
        const installmentPlans = installmentSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || new Date(),
          nextPaymentDate: doc.data().nextPaymentDate?.toDate() || new Date(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as InstallmentPlan[];

        // Crear transacciones virtuales para los pagos de installment
        const installmentTransactions: Transaction[] = installmentPlans.map(plan => ({
          id: `installment-${plan.id}`,
          type: 'expense' as const,
          amount: plan.monthlyAmount,
          date: plan.nextPaymentDate,
          description: `${plan.description} (${plan.remainingInstallments}/${plan.installments} cuotas)`,
          category: 'Meses sin intereses',
          accountId: plan.accountId,
          userId: currentUser.uid,
          createdAt: plan.createdAt,
          isInstallment: true, // Marcador para identificar transacciones de installment
          installmentPlanId: plan.id
        }));

        // Combinar transacciones regulares con las de installment
        const allTransactions = [...transactionsData, ...installmentTransactions]
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        setTransactions(allTransactions);
        setLoading(false);
      });

      // Cleanup del listener de installments cuando cambian las transacciones
      return unsubscribeInstallments;
    });

    return unsubscribeTransactions;
  }, [currentUser]);

  return { transactions, loading };
};