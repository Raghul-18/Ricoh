import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';

// Originator: fetch amendments for a specific deal
export function useDealAmendments(dealId) {
  return useQuery({
    queryKey: keys.amendments(dealId),
    queryFn: async () => {
      const { data, error } = await db.amendments()
        .select('*, requester:requested_by(full_name, avatar_initials), reviewer:reviewed_by(full_name)')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!dealId,
  });
}

// Originator: request a new amendment
export function useRequestAmendment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, contractId, amendmentType, description }) => {
      const { data, error } = await db.amendments()
        .insert({
          deal_id: dealId,
          contract_id: contractId || null,
          requested_by: user.id,
          amendment_type: amendmentType,
          description,
        })
        .select()
        .single();
      if (error) throw error;

      // Notify admin(s) via a system notification
      await db.notifications().insert({
        user_id: user.id,
        title: 'Amendment request submitted',
        body: `Your ${amendmentType.replace(/_/g, ' ')} request has been received and is under review.`,
        type: 'deal_update',
        related_id: dealId,
      });

      return data;
    },
    onSuccess: (_, { dealId }) => {
      qc.invalidateQueries({ queryKey: keys.amendments(dealId) });
    },
  });
}

// Admin: fetch all pending amendments
export function useAllAmendments(statusFilter = null) {
  return useQuery({
    queryKey: [...keys.adminAmendments(), statusFilter],
    queryFn: async () => {
      let q = db.amendments()
        .select(`
          *,
          deal:deal_id(reference_number, customer_name, originator_id),
          requester:requested_by(full_name, company_name, email)
        `)
        .order('created_at', { ascending: false });
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

// Admin: approve or reject an amendment
export function useReviewAmendment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ amendmentId, status, adminNotes }) => {
      const { data, error } = await db.amendments()
        .update({
          status,
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', amendmentId)
        .select('deal_id, requested_by, amendment_type')
        .single();
      if (error) throw error;

      // Notify the requester
      await db.notifications().insert({
        user_id: data.requested_by,
        title: `Amendment ${status === 'approved' ? 'approved' : 'declined'}`,
        body: adminNotes || `Your ${data.amendment_type.replace(/_/g, ' ')} request has been ${status}.`,
        type: 'deal_update',
        related_id: data.deal_id,
      });

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.amendments(data.deal_id) });
      qc.invalidateQueries({ queryKey: keys.adminAmendments() });
    },
  });
}
