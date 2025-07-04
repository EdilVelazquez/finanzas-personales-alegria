import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction, InstallmentPlan, Account } from '@/types';

export const useAllTransactions = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setTransactions([]);
      return;
    }

    setLoading(true);

    // Escuchar cuentas para obtener saldos iniciales
    const accountsQuery = query(
      collection(db, 'users', currentUser.uid, 'accounts')
    );

    // Escuchar transacciones regulares
    const transactionsQuery = query(
      collection(db, 'users', currentUser.uid, 'transactions'),
      orderBy('date', 'desc')
    );

    // Escuchar planes de installment activos
    const installmentPlansQuery = query(
      collection(db, 'users', currentUser.uid, 'installmentPlans'),
      where('isActive', '==', true)
    );

    const unsubscribeAccounts = onSnapshot(accountsQuery, (accountSnapshot) => {
      const accountsData = accountSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          nextPaymentDate: data.nextPaymentDate?.toDate()
        };
      }) as Account[];
      setAccounts(accountsData);

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

          // Crear transacciones virtuales para saldos iniciales
          const virtualTransactions = accountsData
            .filter(account => account.balance !== 0) // Solo mostrar cuentas con balance diferente a 0
            .map(account => {
              // Para cuentas de crédito, el saldo usado es un gasto
              if (account.type === 'credit' && account.balance > 0) {
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
            .filter(Boolean) as Transaction[];

          // Combinar todas las transacciones
          const allTransactions = [...virtualTransactions, ...transactionsData, ...installmentTransactions]
            .sort((a, b) => b.date.getTime() - a.date.getTime());

          setTransactions(allTransactions);
          setLoading(false);
        });

        // Cleanup del listener de installments cuando cambian las transacciones
        return unsubscribeInstallments;
      });

      // Cleanup del listener de transacciones cuando cambian las cuentas
      return unsubscribeTransactions;
    });

    return unsubscribeAccounts;
  }, [currentUser]);

  return { transactions, loading };
};