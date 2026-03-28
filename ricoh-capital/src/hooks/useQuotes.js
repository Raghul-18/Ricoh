import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';

export function useQuotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.quotes(user?.id),
    queryFn: async () => {
      const { data, error } = await db.quotes()
        .select('*, prospect:prospect_id(company_name)')
        .eq('originator_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useQuote(quoteId) {
  return useQuery({
    queryKey: keys.quote(quoteId),
    queryFn: async () => {
      const { data, error } = await db.quotes()
        .select('*')
        .eq('id', quoteId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });
}

export function useCreateQuote() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const { data, error } = await db.quotes()
        .insert({ ...formData, originator_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.quotes(user?.id) }),
  });
}

export function useSendQuote() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ quoteId, prospectId, customerName }) => {
      const { data, error } = await db.quotes()
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', quoteId)
        .select('originator_id')
        .single();
      if (error) throw error;

      const { data: admins } = await db.profiles().select('id').eq('role', 'admin');
      if (admins?.length) {
        await db.notifications().insert(admins.map((admin) => ({
          user_id: admin.id,
          title: `Quote sent to ${customerName}`,
          body: 'A customer quote has been sent and is ready for follow-up.',
          type: 'quote_update',
          related_id: quoteId,
        })));
      }

      return data;
    },
    onSuccess: (_, { quoteId }) => {
      qc.invalidateQueries({ queryKey: keys.quotes(user?.id) });
      qc.invalidateQueries({ queryKey: keys.quote(quoteId) });
    },
  });
}

// Mark a sent quote as accepted → pre-fills deal store ready for wizard
export function useAcceptQuote() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ quoteId }) => {
      const { data, error } = await db.quotes()
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', quoteId)
        .select()
        .single();
      if (error) throw error;

      await db.notifications().insert({
        user_id: user.id,
        title: `Quote ${data.reference_number} accepted`,
        body: `${data.customer_name} has accepted the quote. A deal has been initiated.`,
        type: 'quote_update',
        related_id: quoteId,
      });

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.quotes(user?.id) });
      qc.invalidateQueries({ queryKey: keys.quote(data.id) });
    },
  });
}

// Mark a sent quote as rejected by customer
export function useDeclineQuote() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ quoteId }) => {
      const { data, error } = await db.quotes()
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', quoteId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.quotes(user?.id) });
      qc.invalidateQueries({ queryKey: keys.quote(data.id) });
    },
  });
}

// Calculate monthly payment
export function calcMonthly(assetValue, deposit, termMonths, aprPct = 7.2, balloon = 0) {
  const financed = assetValue - deposit - balloon;
  if (financed <= 0 || termMonths <= 0) return 0;
  const r = aprPct / 100 / 12;
  return Math.round((financed * r) / (1 - Math.pow(1 + r, -termMonths)));
}
