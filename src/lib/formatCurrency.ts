
export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('es-MX', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const formatCurrencyWithSymbol = (amount: number): string => {
  return `$${formatCurrency(amount)}`;
};
