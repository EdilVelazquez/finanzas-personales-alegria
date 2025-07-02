
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { InstallmentPlan } from '@/types';

export const useInstallmentPlans = () => {
  const { currentUser } = useAuth();
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setInstallmentPlans([]);
      return;
    }

    setLoading(true);

    const plansQuery = query(
      collection(db, 'users', currentUser.uid, 'installmentPlans'),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(plansQuery, (snapshot) => {
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        nextPaymentDate: doc.data().nextPaymentDate?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as InstallmentPlan[];

      // Ordenar en memoria por fecha de próximo pago
      plansData.sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime());

      setInstallmentPlans(plansData);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  return { installmentPlans, loading };
};
