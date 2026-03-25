import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';

export function useContracts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: keys.contracts(user?.id),
    queryFn: async () => {
      const { data, error } = await db.contracts()
        .select('*')
        .eq('originator_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

// Alias for the customer portal — filters by customer_id
export function useCustomerContracts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['customer-contracts', user?.id],
    queryFn: async () => {
      const { data, error } = await db.contracts()
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useContract(contractId) {
  return useQuery({
    queryKey: keys.contract(contractId),
    queryFn: async () => {
      const { data, error } = await db.contracts()
        .select('*')
        .eq('id', contractId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
}

export function useContractByRef(refNumber) {
  return useQuery({
    queryKey: ['contract-ref', refNumber],
    queryFn: async () => {
      const { data, error } = await db.contracts()
        .select('*')
        .eq('reference_number', refNumber)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!refNumber,
  });
}

export function usePaymentSchedule(contractId) {
  return useQuery({
    queryKey: keys.paymentSchedule(contractId),
    queryFn: async () => {
      const { data, error } = await db.paymentSchedule()
        .select('*')
        .eq('contract_id', contractId)
        .order('payment_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!contractId,
  });
}

// Admin: mark a single payment as paid
export function useMarkPaymentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, contractId }) => {
      const { error } = await db.paymentSchedule()
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: (_, { contractId }) => {
      qc.invalidateQueries({ queryKey: keys.paymentSchedule(contractId) });
      qc.invalidateQueries({ queryKey: keys.contract(contractId) });
    },
  });
}

// Customer: pay an instalment (with optional principal overpayment)
export function useCustomerPayNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, contractId, amountPaid, extraPrincipal }) => {
      // 1. Mark this instalment as paid
      const { error: pErr } = await db.paymentSchedule()
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          amount_paid: amountPaid,
          extra_principal: extraPrincipal || 0,
        })
        .eq('id', paymentId);
      if (pErr) throw pErr;

      // 2. If extra principal was paid, redistribute it across remaining unpaid rows
      if (extraPrincipal > 0) {
        const { data: remaining, error: rErr } = await db.paymentSchedule()
          .select('id, amount')
          .eq('contract_id', contractId)
          .neq('status', 'paid');
        if (rErr) throw rErr;

        if (remaining && remaining.length > 0) {
          const currentTotal = remaining.reduce((s, p) => s + (p.amount || 0), 0);
          const newTotal = Math.max(0, currentTotal - extraPrincipal);
          const newAmount = Math.round((newTotal / remaining.length) * 100) / 100;

          const { error: uErr } = await db.paymentSchedule()
            .update({ amount: newAmount })
            .in('id', remaining.map(p => p.id));
          if (uErr) throw uErr;
        }
      }
    },
    onSuccess: (_, { contractId }) => {
      qc.invalidateQueries({ queryKey: keys.paymentSchedule(contractId) });
      qc.invalidateQueries({ queryKey: keys.contract(contractId) });
      qc.invalidateQueries({ queryKey: ['customer-contracts'] });
    },
  });
}

// Admin: cancel a contract
export function useCancelContract() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (contractId) => {
      const { error } = await db.contracts()
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', contractId);
      if (error) throw error;
    },
    onSuccess: (_, contractId) => {
      qc.invalidateQueries({ queryKey: keys.contract(contractId) });
      qc.invalidateQueries({ queryKey: keys.contracts(user?.id) });
    },
  });
}

// Portfolio KPIs derived from contracts
export function usePortfolioStats(contracts = []) {
  const active = contracts.filter(c => c.status === 'active').length;
  const overdue = contracts.filter(c => c.status === 'overdue').length;
  const maturing = contracts.filter(c => c.status === 'maturing').length;
  const totalValue = contracts.reduce((s, c) => s + (c.asset_value || 0), 0);
  return { active, overdue, maturing, totalValue };
}

// Export contracts as CSV
export function exportContractsCSV(contracts, fields) {
  const headers = fields.join(',');
  const rows = contracts.map(c =>
    fields.map(f => {
      const val = c[f] ?? '';
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolio_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
