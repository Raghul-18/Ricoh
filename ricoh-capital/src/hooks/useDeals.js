import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db, invokeAdminFunction, logAudit } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';
import { useDealStore } from '../store/dealStore';

export function useDeals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.deals(user?.id),
    queryFn: async () => {
      const { data, error } = await db.deals()
        .select('*')
        .eq('originator_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useDeal(dealId) {
  return useQuery({
    queryKey: keys.deal(dealId),
    queryFn: async () => {
      const { data, error } = await db.deals()
        .select('*')
        .eq('id', dealId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
}

export function useSubmitDeal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { initiation, assetDetails, getMonthlyPayment, getTotalPayable, setSubmitted, reset } = useDealStore();

  return useMutation({
    mutationFn: async () => {
      const monthly = getMonthlyPayment();
      const total = getTotalPayable();

      const payload = {
        originator_id: user.id,
        customer_name: initiation.customerName,
        customer_email: initiation.customerEmail || null,
        product_type: initiation.productType,
        originator_reference: initiation.originatorReference,
        preferred_start_date: initiation.preferredStartDate || null,
        notes: initiation.notes,
        asset_type: assetDetails.assetType,
        asset_make: assetDetails.make,
        asset_model: assetDetails.model,
        asset_year: assetDetails.year,
        asset_value: assetDetails.assetValue,
        term_months: assetDetails.termMonths,
        deposit: assetDetails.deposit,
        balloon: assetDetails.balloon,
        rate_type: assetDetails.rateType,
        monthly_payment: monthly,
        apr: 7.2,
        total_payable: total,
        status: 'submitted',
      };

      const { data, error } = await db.deals()
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Notify the originator
      await db.notifications().insert({
        user_id: user.id,
        title: `Deal submitted — ${data.reference_number}`,
        body: `${initiation.customerName} · ${initiation.productType} · £${monthly.toLocaleString()}/mo`,
        type: 'deal_update',
        related_id: data.id,
      });

      await logAudit('deal', data.id, 'submitted', { reference: data.reference_number });
      setSubmitted(data.id, data.reference_number);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.deals(user?.id) });
    },
  });
}

// ── Admin: view all submitted deals ──────────────────────────
export function useAllDeals(statusFilter = null) {
  return useQuery({
    queryKey: [...keys.adminDeals(), statusFilter],
    queryFn: async () => {
      let q = db.deals()
        .select('*, originator:originator_id(id, full_name, company_name, email)')
        .order('created_at', { ascending: false });
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Admin: approve a deal → creates a contract ───────────────
export function useApproveDeal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, adminNotes, startDate, customerEmail }) => {
      // 1. Fetch the deal
      const { data: deal, error: dealErr } = await db.deals()
        .select('*')
        .eq('id', dealId)
        .single();
      if (dealErr) throw dealErr;

      // 2. Mark deal approved
      const { error: updateErr } = await db.deals()
        .update({
          status: 'approved',
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', dealId);
      if (updateErr) throw updateErr;

      // 3. Calculate dates
      const start = startDate ? new Date(startDate) : new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + (deal.term_months || 36));
      const nextPayment = new Date(start);
      nextPayment.setMonth(nextPayment.getMonth() + 1);

      // 4. Create the contract
      const year = new Date().getFullYear();
      const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
      const contractRef = `CON-${year}-${rand}`;

      const { data: contract, error: contractErr } = await db.contracts()
        .insert({
          deal_id: deal.id,
          originator_id: deal.originator_id,
          customer_name: deal.customer_name,
          asset_description: `${deal.asset_year || ''} ${deal.asset_make || ''} ${deal.asset_model || ''}`.trim() || deal.asset_type,
          asset_value: deal.asset_value,
          monthly_payment: deal.monthly_payment,
          term_months: deal.term_months,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          next_payment_date: nextPayment.toISOString().slice(0, 10),
          status: 'active',
          reference_number: contractRef,
        })
        .select()
        .single();
      if (contractErr) throw contractErr;

      // 5. Generate payment schedule
      const schedule = Array.from({ length: deal.term_months || 36 }, (_, i) => {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        return {
          contract_id: contract.id,
          payment_number: i + 1,
          due_date: dueDate.toISOString().slice(0, 10),
          amount: deal.monthly_payment || 0,
          status: 'upcoming',
        };
      });
      if (schedule.length) {
        const { error: schedErr } = await db.paymentSchedule().insert(schedule);
        if (schedErr) throw schedErr;
      }

      // 6. Notify originator
      await db.notifications().insert({
        user_id: deal.originator_id,
        title: `Deal approved — ${deal.reference_number}`,
        body: `${deal.customer_name} · ${deal.product_type} · Contract ${contract.reference_number} is now active.`,
        type: 'deal_update',
        related_id: contract.id,
      });

      // 7. Invite customer to portal if an email was provided
      const emailToInvite = customerEmail || deal.customer_email;
      let inviteErrorMessage = null;
      let customerInviteSent = false;
      if (emailToInvite) {
        try {
          await invokeAdminFunction('invite-customer', {
            email: emailToInvite,
            customerName: deal.customer_name,
            contractId: contract.id,
            dealId,
          });
          customerInviteSent = true;
        } catch (inviteErr) {
          // Non-fatal: log but don't fail the approval
          inviteErrorMessage = inviteErr?.message || 'Failed to send customer invite email';
          console.warn('Customer invite failed (check Edge Function deployment/secrets):', inviteErr);
        }
      }

      await logAudit('deal', dealId, 'approved', {
        contract_id: contract.id,
        reviewed_by: user.id,
        customer_invited: !!emailToInvite,
        customer_invite_sent: customerInviteSent,
        customer_invite_error: inviteErrorMessage,
      });
      return {
        deal,
        contract,
        customerEmail: emailToInvite || null,
        customerInviteSent,
        customerInviteError: inviteErrorMessage,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.adminDeals() });
      qc.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

// ── Admin: reject a deal ──────────────────────────────────────
export function useRejectDeal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, adminNotes }) => {
      const { data: deal, error: dealErr } = await db.deals()
        .select('originator_id, reference_number, customer_name, product_type')
        .eq('id', dealId)
        .single();
      if (dealErr) throw dealErr;

      const { error } = await db.deals()
        .update({
          status: 'rejected',
          admin_notes: adminNotes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', dealId);
      if (error) throw error;

      await db.notifications().insert({
        user_id: deal.originator_id,
        title: `Deal not approved — ${deal.reference_number}`,
        body: adminNotes
          ? `${deal.customer_name} · ${deal.product_type}. Reason: ${adminNotes}`
          : `${deal.customer_name} · ${deal.product_type} was not approved at this time.`,
        type: 'deal_update',
        related_id: dealId,
      });

      await logAudit('deal', dealId, 'rejected', { reviewed_by: user.id, notes: adminNotes });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.adminDeals() }),
  });
}

// ── Admin: move deal back to under_review ────────────────────
export function useSetDealUnderReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dealId) => {
      const { error } = await db.deals().update({ status: 'under_review' }).eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.adminDeals() }),
  });
}

// ── Admin: retry customer portal invite for approved deal ──────
export function useRetryCustomerInvite() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, customerEmail }) => {
      if (!dealId) throw new Error('dealId is required');
      if (!customerEmail) throw new Error('Customer email is required');

      const { data: deal, error: dealErr } = await db.deals()
        .select('id, customer_name')
        .eq('id', dealId)
        .single();
      if (dealErr || !deal) throw dealErr || new Error('Deal not found');

      const { data: contract, error: contractErr } = await db.contracts()
        .select('id')
        .eq('deal_id', dealId)
        .single();
      if (contractErr || !contract) throw contractErr || new Error('Contract not found for this deal');

      const { error: emailUpdateErr } = await db.deals()
        .update({ customer_email: customerEmail })
        .eq('id', dealId);
      if (emailUpdateErr) throw emailUpdateErr;

      await invokeAdminFunction('invite-customer', {
        email: customerEmail,
        customerName: deal.customer_name,
        contractId: contract.id,
        dealId,
      });

      await logAudit('deal', dealId, 'customer_invite_retried', {
        reviewed_by: user?.id,
        customer_email: customerEmail,
      });

      return { customerEmail };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.adminDeals() });
    },
  });
}

export function useSaveDealDraft() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { initiation, assetDetails } = useDealStore();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await db.deals()
        .insert({
          originator_id: user.id,
          customer_name: initiation.customerName || 'Draft',
          product_type: initiation.productType,
          originator_reference: initiation.originatorReference,
          notes: initiation.notes,
          asset_value: assetDetails.assetValue,
          term_months: assetDetails.termMonths,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.deals(user?.id) }),
  });
}
