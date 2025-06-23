
import { useState } from 'react';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  type?: 'income' | 'expense' | 'all';
  accountId?: string;
}

export const useReportFilters = () => {
  const [filters, setFilters] = useState<ReportFilters>({
    type: 'all'
  });

  const updateFilters = (newFilters: ReportFilters) => {
    setFilters(newFilters);
  };

  const resetFilters = () => {
    setFilters({ type: 'all' });
  };

  return {
    filters,
    updateFilters,
    resetFilters
  };
};
