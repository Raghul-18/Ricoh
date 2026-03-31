import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';

async function hydrateAmendments(items) {
  const amendments = items || [];
  if (!amendments.length) return amendments;

  const userIds = [...new Set(amendments.flatMap((item) => [item.requested_by, item.reviewed_by]).filter(Boolean))];
  const dealIds = [...new Set(amendments.map((item) => item.deal_id).filter(Boolean))];

  let usersById = {};
  let dealsById = {};

  if (userIds.length) {
    const { data: users, error: userError } = await db.profiles()
      .select('id, full_name, company_name, email')
      .in('id', userIds);
    if (userError) throw userError;
    usersById = Object.fromEntries((users || []).map((user) => [user.id, user]));
  }

  if (dealIds.length) {
    const { data: deals, error: dealError } = await db.deals()
      .select('id, reference_number, customer_name, originator_id')
      .in('id', dealIds);
    if (dealError) throw dealError;
    dealsById = Object.fromEntries((deals || []).map((deal) => [deal.id, deal]));
  }

  return amendments.map((amendment) => ({
    ...amendment,
    requester: amendment.requested_by ? usersById[amendment.requested_by] || null : null,
    reviewer: amendment.reviewed_by ? usersById[amendment.reviewed_by] || null : null,
    deal: amendment.deal_id ? dealsById[amendment.deal_id] || null : null,
  }));
}

// Originator: fetch amendments for a specific deal
export function useDealAmendments(dealId) {
  return useQuery({
    queryKey: keys.amendments(dealId),
    queryFn: async () => {
      const { data, error } = await db.amendments()
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return hydrateAmendments(data || []);
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

      const { data: admins } = await db.profiles().select('id').eq('role', 'admin');
      if (admins?.length) {
        await db.notifications().insert(admins.map((admin) => ({
          user_id: admin.id,
          title: 'Amendment request submitted',
          body: `${amendmentType.replace(/_/g, ' ')} requested for deal ${dealId}.`,
          type: 'deal_update',
          related_id: dealId,
        })));
      }

      return data;
    },
    onSuccess: (_, { dealId }) => {
      qc.invalidateQueries({ queryKey: keys.amendments(dealId) });
    },
  });
}

// Admin: fetch all pending amendments
export function useAllAmendments(statusFilter = null) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: [...keys.adminAmendments(), statusFilter],
    queryFn: async () => {
      let q = db.amendments()
        .select('*')
        .order('created_at', { ascending: false });
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return hydrateAmendments(data || []);
    },
    enabled: !!isAdmin,
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
