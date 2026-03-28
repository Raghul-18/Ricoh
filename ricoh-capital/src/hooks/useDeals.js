import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db, fxClient, invokeAdminFunction, logAudit } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';
import { useDealStore } from '../store/dealStore';
import { REPORTING_CURRENCY } from '../lib/localeConfig';

function getDealReferenceLabel(deal) {
  return deal?.reference_number || deal?.originator_reference || 'Deal reference pending';
}

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
  const queryClient = useQueryClient();
  const { initiation, assetDetails, getMonthlyPayment, getTotalPayable, setSubmitted } = useDealStore();

  return useMutation({
    mutationFn: async () => {
      const monthly = getMonthlyPayment();
      const total = getTotalPayable();
      const originalCurrency = initiation.currencyCode || REPORTING_CURRENCY;

      const [assetFx, depositFx, balloonFx, monthlyFx, totalFx] = await Promise.all([
        fxClient.convert(assetDetails.assetValue || 0, originalCurrency, REPORTING_CURRENCY),
        fxClient.convert(assetDetails.deposit || 0, originalCurrency, REPORTING_CURRENCY),
        fxClient.convert(assetDetails.balloon || 0, originalCurrency, REPORTING_CURRENCY),
        fxClient.convert(monthly, originalCurrency, REPORTING_CURRENCY),
        fxClient.convert(total, originalCurrency, REPORTING_CURRENCY),
      ]);

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
        original_currency_code: originalCurrency,
        original_asset_value: assetDetails.assetValue,
        original_deposit: assetDetails.deposit,
        original_balloon: assetDetails.balloon,
        original_monthly_payment: monthly,
        original_total_payable: total,
        reporting_currency_code: REPORTING_CURRENCY,
        reporting_asset_value: assetFx.convertedAmount,
        reporting_deposit: depositFx.convertedAmount,
        reporting_balloon: balloonFx.convertedAmount,
        reporting_monthly_payment: monthlyFx.convertedAmount,
        reporting_total_payable: totalFx.convertedAmount,
        fx_rate: assetFx.rate,
        fx_base_currency: assetFx.baseCurrency,
        fx_target_currency: assetFx.targetCurrency,
        fx_source: assetFx.source,
        fx_fetched_at: assetFx.fetchedAt,
        status: 'submitted',
      };

      const { data, error } = await db.deals().insert(payload).select('*').single();
      if (error) throw error;

      await db.notifications().insert({
        user_id: user.id,
        title: `Deal submitted - ${getDealReferenceLabel(data)}`,
        body: `${initiation.customerName} - ${initiation.productType} - ${originalCurrency} ${monthly.toLocaleString()}/mo`,
        type: 'deal_update',
        related_id: data.id,
      });

      await logAudit('deal', data.id, 'submitted', { reference: getDealReferenceLabel(data) });
      setSubmitted(data.id, getDealReferenceLabel(data));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.deals(user?.id) });
    },
  });
}

export function useAllDeals(statusFilter = null) {
  return useQuery({
    queryKey: [...keys.adminDeals(), statusFilter],
    queryFn: async () => {
      let query = db.deals()
        .select('*')
        .order('created_at', { ascending: false });
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;

      const deals = data || [];
      const originatorIds = [...new Set(deals.map((deal) => deal.originator_id).filter(Boolean))];

      if (originatorIds.length === 0) {
        return deals;
      }

      const { data: profiles, error: profileError } = await db.profiles()
        .select('id, full_name, company_name, email')
        .in('id', originatorIds);

      if (profileError) throw profileError;

      const profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));

      return deals.map((deal) => ({
        ...deal,
        originator: profilesById[deal.originator_id] || null,
      }));
    },
  });
}

export function useApproveDeal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, adminNotes, startDate, customerEmail }) => {
      const { data: deal, error: dealErr } = await db.deals().select('*').eq('id', dealId).single();
      if (dealErr) throw dealErr;

      const { error: updateErr } = await db.deals().update({
        status: 'approved',
        admin_notes: adminNotes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', dealId);
      if (updateErr) throw updateErr;

      const start = startDate ? new Date(startDate) : new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + (deal.term_months || 36));
      const nextPayment = new Date(start);
      nextPayment.setMonth(nextPayment.getMonth() + 1);

      const year = new Date().getFullYear();
      const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
      const contractRef = `CON-${year}-${rand}`;

      const { data: contract, error: contractErr } = await db.contracts().insert({
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
      }).select('*').single();
      if (contractErr) throw contractErr;

      const schedule = Array.from({ length: deal.term_months || 36 }, (_, index) => {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + index + 1);
        return {
          contract_id: contract.id,
          payment_number: index + 1,
          due_date: dueDate.toISOString().slice(0, 10),
          amount: deal.monthly_payment || 0,
          status: 'upcoming',
        };
      });
      if (schedule.length) {
        const { error: scheduleErr } = await db.paymentSchedule().insert(schedule);
        if (scheduleErr) throw scheduleErr;
      }

      await db.notifications().insert({
        user_id: deal.originator_id,
        title: `Deal approved - ${getDealReferenceLabel(deal)}`,
        body: `${deal.customer_name} - ${deal.product_type} - Contract ${contract.reference_number} is now active.`,
        type: 'deal_update',
        related_id: contract.id,
      });

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
          inviteErrorMessage = inviteErr?.message || 'Failed to send customer invite email';
          console.warn('Customer invite failed:', inviteErr);
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
      queryClient.invalidateQueries({ queryKey: keys.adminDeals() });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useRejectDeal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, adminNotes }) => {
      const { data: deal, error: dealErr } = await db.deals()
        .select('originator_id, reference_number, originator_reference, customer_name, product_type')
        .eq('id', dealId)
        .single();
      if (dealErr) throw dealErr;

      const { error } = await db.deals().update({
        status: 'rejected',
        admin_notes: adminNotes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', dealId);
      if (error) throw error;

      await db.notifications().insert({
        user_id: deal.originator_id,
        title: `Deal not approved - ${getDealReferenceLabel(deal)}`,
        body: adminNotes
          ? `${deal.customer_name} - ${deal.product_type}. Reason: ${adminNotes}`
          : `${deal.customer_name} - ${deal.product_type} was not approved at this time.`,
        type: 'deal_update',
        related_id: dealId,
      });

      await logAudit('deal', dealId, 'rejected', { reviewed_by: user.id, notes: adminNotes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminDeals() }),
  });
}

export function useSetDealUnderReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId) => {
      const { error } = await db.deals().update({ status: 'under_review' }).eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminDeals() }),
  });
}

export function useRetryCustomerInvite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, customerEmail }) => {
      if (!dealId) throw new Error('dealId is required');
      if (!customerEmail) throw new Error('Customer email is required');

      const { data: deal, error: dealErr } = await db.deals().select('id, customer_name').eq('id', dealId).single();
      if (dealErr || !deal) throw dealErr || new Error('Deal not found');

      const { data: contract, error: contractErr } = await db.contracts().select('id').eq('deal_id', dealId).single();
      if (contractErr || !contract) throw contractErr || new Error('Contract not found for this deal');

      const { error: emailUpdateErr } = await db.deals().update({ customer_email: customerEmail }).eq('id', dealId);
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
      queryClient.invalidateQueries({ queryKey: keys.adminDeals() });
    },
  });
}

export function useSaveDealDraft() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { initiation, assetDetails } = useDealStore();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await db.deals().insert({
        originator_id: user.id,
        customer_name: initiation.customerName || 'Draft',
        product_type: initiation.productType,
        originator_reference: initiation.originatorReference,
        notes: initiation.notes,
        asset_value: assetDetails.assetValue,
        term_months: assetDetails.termMonths,
        original_currency_code: initiation.currencyCode || REPORTING_CURRENCY,
        status: 'draft',
      }).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.deals(user?.id) }),
  });
}
