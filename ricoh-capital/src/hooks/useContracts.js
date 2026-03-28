import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db, invokeApi } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';

async function attachDealMetadata(contracts) {
  const items = Array.isArray(contracts) ? contracts : contracts ? [contracts] : [];
  const dealIds = [...new Set(items.map((contract) => contract?.deal_id).filter(Boolean))];
  if (!dealIds.length) return contracts;

  const { data: deals, error } = await db.deals()
    .select('*')
    .in('id', dealIds);
  if (error) throw error;

  const dealsById = Object.fromEntries((deals || []).map((deal) => [deal.id, deal]));
  const hydrated = items.map((contract) => ({
    ...contract,
    deal: dealsById[contract.deal_id] || null,
  }));

  return Array.isArray(contracts) ? hydrated : hydrated[0] || null;
}

function normalizeSignature(signature) {
  return {
    ...signature,
    signer_role: signature.signer_role || signature.role,
    signer_user_id: signature.signer_user_id || signature.user_id,
  };
}

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
      return attachDealMetadata(data || []);
    },
    enabled: !!user,
  });
}

export function useCustomerContracts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: keys.customerContracts(user?.id),
    queryFn: async () => {
      const { data, error } = await db.contracts()
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return attachDealMetadata(data || []);
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
      return attachDealMetadata(data);
    },
    enabled: !!contractId,
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

export function useContractSignatures(contractId) {
  return useQuery({
    queryKey: ['contract-signatures', contractId],
    queryFn: async () => {
      const { data, error } = await db.contractSignatures()
        .select('*')
        .eq('contract_id', contractId);
      if (error) throw error;
      return (data || []).map(normalizeSignature);
    },
    enabled: !!contractId,
  });
}

export function useContractClosureRequests(contractId) {
  return useQuery({
    queryKey: ['contract-closure-requests', contractId],
    queryFn: async () => {
      const { data, error } = await db.contractClosureRequests()
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!contractId,
  });
}

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

export function useCustomerPayNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, contractId, amountPaid, extraPrincipal }) => {
      const { error: pErr } = await db.paymentSchedule()
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          amount_paid: amountPaid,
          extra_principal: extraPrincipal || 0,
        })
        .eq('id', paymentId);
      if (pErr) throw pErr;

      if (extraPrincipal > 0) {
        const { data: remaining, error: rErr } = await db.paymentSchedule()
          .select('id, amount')
          .eq('contract_id', contractId)
          .neq('status', 'paid');
        if (rErr) throw rErr;

        if (remaining && remaining.length > 0) {
          const currentTotalCents = remaining.reduce((sum, payment) => sum + Math.round(Number(payment.amount || 0) * 100), 0);
          const newTotalCents = Math.max(0, currentTotalCents - Math.round(Number(extraPrincipal) * 100));
          const baseAmount = Math.floor(newTotalCents / remaining.length);
          const remainder = newTotalCents % remaining.length;

          await Promise.all(remaining.map((payment, index) =>
            db.paymentSchedule()
              .update({ amount: (baseAmount + (index < remainder ? 1 : 0)) / 100 })
              .eq('id', payment.id),
          ));
        }
      }
    },
    onSuccess: (_, { contractId }) => {
      qc.invalidateQueries({ queryKey: keys.paymentSchedule(contractId) });
      qc.invalidateQueries({ queryKey: keys.contract(contractId) });
      qc.invalidateQueries({ queryKey: ['customer', 'contracts'] });
    },
  });
}

export function useSignContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, signerName, signaturePayload }) =>
      invokeApi(`/contracts/${contractId}/sign`, { signerName, signaturePayload }),
    onSuccess: (_, { contractId }) => {
      qc.invalidateQueries({ queryKey: keys.contract(contractId) });
      qc.invalidateQueries({ queryKey: ['contract-signatures', contractId] });
      qc.invalidateQueries({ queryKey: ['customer', 'contracts'] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useCreateClosureRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, requestedDate, effectiveEndDate, reason, settlementAmount, notes }) =>
      invokeApi(`/contracts/${contractId}/closure-requests`, { requestedDate, effectiveEndDate, reason, settlementAmount, notes }),
    onSuccess: (_, { contractId }) => {
      qc.invalidateQueries({ queryKey: ['contract-closure-requests', contractId] });
      qc.invalidateQueries({ queryKey: keys.contract(contractId) });
    },
  });
}

export function useReviewClosureRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, contractId, status, reviewNotes, settlementAmount, effectiveEndDate }) =>
      invokeApi(`/closure-requests/${requestId}/review`, { status, reviewNotes, settlementAmount, effectiveEndDate }),
    onSuccess: (_, { contractId }) => {
      qc.invalidateQueries({ queryKey: ['contract-closure-requests', contractId] });
      qc.invalidateQueries({ queryKey: keys.contract(contractId) });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['customer', 'contracts'] });
    },
  });
}

export function useCancelContract() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ contractId, effectiveEndDate, reason, settlementAmount, notes }) =>
      invokeApi(`/contracts/${contractId}/terminate`, { effectiveEndDate, reason, settlementAmount, notes }),
    onSuccess: (_, { contractId }) => {
      qc.invalidateQueries({ queryKey: keys.contract(contractId) });
      qc.invalidateQueries({ queryKey: keys.contracts(user?.id) });
    },
  });
}

export function usePortfolioStats(contracts = []) {
  const active = contracts.filter((c) => c.status === 'active').length;
  const overdue = contracts.filter((c) => c.status === 'overdue').length;
  const maturing = contracts.filter((c) => c.status === 'maturing').length;
  const totalValue = contracts.reduce((s, c) => s + (c.asset_value || 0), 0);
  return { active, overdue, maturing, totalValue };
}

function sanitizeCsvCell(value) {
  const raw = String(value ?? '');
  const prefixed = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return prefixed.includes(',') ? `"${prefixed.replace(/"/g, '""')}"` : prefixed;
}

export function exportContractsCSV(contracts, fields) {
  const headers = fields.join(',');
  const rows = contracts.map((contract) =>
    fields.map((field) => sanitizeCsvCell(contract[field] ?? '')).join(','),
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
