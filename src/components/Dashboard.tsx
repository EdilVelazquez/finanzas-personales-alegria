
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Account, Transaction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title
);

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<any>({});

  useEffect(() => {
    if (!currentUser) return;

    // Escuchar cuentas
    const accountsQuery = query(
      collection(db, 'users', currentUser.uid, 'accounts')
    );
    
    const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Account[];
      setAccounts(accountsData);
    });

    // Escuchar transacciones recientes
    const transactionsQuery = query(
      collection(db, 'users', currentUser.uid, 'transactions'),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Transaction[];
      setRecentTransactions(transactionsData);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeTransactions();
    };
  }, [currentUser]);

  const totalBalance = accounts.reduce((sum, account) => {
    if (account.type === 'debit') {
      return sum + account.balance;
    } else {
      return sum + (account.creditLimit || 0) - account.balance;
    }
  }, 0);

  const totalDebt = accounts
    .filter(account => account.type === 'credit')
    .reduce((sum, account) => sum + account.balance, 0);

  const chartData = {
    labels: ['Débito', 'Crédito Disponible', 'Deuda'],
    datasets: [{
      data: [
        accounts.filter(a => a.type === 'debit').reduce((s, a) => s + a.balance, 0),
        accounts.filter(a => a.type === 'credit').reduce((s, a) => s + ((a.creditLimit || 0) - a.balance), 0),
        totalDebt
      ],
      backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600">Resumen de tus finanzas</p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Balance Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Deudas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalDebt.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cuentas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {accounts.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de distribución */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Saldos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {accounts.length > 0 ? (
                <Doughnut 
                  data={chartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              ) : (
                <p className="text-gray-500">No hay datos para mostrar</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transacciones recientes */}
        <Card>
          <CardHeader>
            <CardTitle>Transacciones Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{transaction.description}</p>
                      <p className="text-xs text-gray-500">{transaction.category}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        ${transaction.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {transaction.date?.toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No hay transacciones recientes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de cuentas */}
      <Card>
        <CardHeader>
          <CardTitle>Mis Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div key={account.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{account.name}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    account.type === 'debit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {account.type === 'debit' ? 'Débito' : 'Crédito'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Saldo:</span>
                    <span className="font-medium">
                      ${account.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {account.type === 'credit' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Límite:</span>
                        <span className="font-medium">
                          ${(account.creditLimit || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Disponible:</span>
                        <span className="font-medium text-green-600">
                          ${((account.creditLimit || 0) - account.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">No tienes cuentas registradas</p>
                <p className="text-sm text-gray-400">Ve a la sección de Cuentas para agregar una</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
