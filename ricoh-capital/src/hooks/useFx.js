import { useQuery } from '@tanstack/react-query';
import { fxClient } from '../lib/backendClient';

export function useFxRate(baseCurrency, targetCurrency) {
  return useQuery({
    queryKey: ['fx-rate', baseCurrency, targetCurrency],
    queryFn: () => fxClient.getRate(baseCurrency, targetCurrency),
    enabled: !!baseCurrency && !!targetCurrency,
    staleTime: 5 * 60 * 1000,
  });
}

export function convertWithRate(amount, rate) {
  if (!Number.isFinite(Number(amount))) return null;
  if (!Number.isFinite(Number(rate))) return null;
  return Math.round(Number(amount || 0) * Number(rate) * 100) / 100;
}
