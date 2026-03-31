import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db, fxClient, invokeAdminFunction, logAudit } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';
import { useDealStore } from '../store/dealStore';
import { REPORTING_CURRENCY } from '../lib/localeConfig';
import { calcMonthlyPayment, calcTotalPayable } from '../lib/dealConfig';

function getDealReferenceLabel(deal) {
  return deal?.reference_number || deal?.originator_reference || 'Deal reference pending';
}

function mapDealPayloadToLegacyFields(dealPayload, productFamily) {
  if (productFamily === 'working_capital' || productFamily === 'invoice_finance') {
    return {
      asset_type: productFamily === 'working_capital' ? 'Working capital facility' : 'Invoice finance facility',
      asset_make: null,
      asset_model: dealPayload.purpose || null,
      asset_year: null,
      asset_value: Number(dealPayload.facilityAmount || 0),
      deposit: 0,
      balloon: 0,
    };
  }

  if (productFamily === 'equipment_leasing') {
    return {
      asset_type: dealPayload.assetType,
      asset_make: dealPayload.supplierName || null,
      asset_model: dealPayload.equipmentDescription || null,
      asset_year: null,
      asset_value: Number(dealPayload.assetValue || 0),
      deposit: Number(dealPayload.deposit || 0),
      balloon: 0,
    };
  }

  return {
    asset_type: dealPayload.assetType,
    asset_make: dealPayload.make || null,
    asset_model: dealPayload.model || null,
    asset_year: Number(dealPayload.year || 0) || null,
    asset_value: Number(dealPayload.assetValue || 0),
    deposit: Number(dealPayload.deposit || 0),
    balloon: Number(dealPayload.balloon || 0),
  };
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
  const { initiation, dealDetails, setSubmitted } = useDealStore();

  return useMutation({
    mutationFn: async () => {
      const monthly = calcMonthlyPayment(dealDetails, initiation.productFamily);
      const total = calcTotalPayable(dealDetails, initiation.productFamily);
      const apr = Number(dealDetails.apr || 0);
      const originalCurrency = initiation.currencyCode || REPORTING_CURRENCY;
      const legacy = mapDealPayloadToLegacyFields(dealDetails, initiation.productFamily);

      const [assetFx, depositFx, balloonFx, monthlyFx, totalFx] = await Promise.all([
        fxClient.convert(legacy.asset_value || 0, originalCurrency, REPORTING_CURRENCY),
        fxClient.convert(legacy.deposit || 0, originalCurrency, REPORTING_CURRENCY),
        fxClient.convert(legacy.balloon || 0, originalCurrency, REPORTING_CURRENCY),
        fxClient.convert(monthly, originalCurrency, REPORTING_CURRENCY),
        fxClient.convert(total, originalCurrency, REPORTING_CURRENCY),
      ]);

      const payload = {
        originator_id: user.id,
        customer_name: initiation.customerName,
        customer_email: initiation.customerEmail || null,
        temp_customer_email: initiation.customerEmail || null,
        product_type: initiation.productType,
        product_family: initiation.productFamily,
        deal_payload: dealDetails,
        originator_reference: initiation.originatorReference,
        preferred_start_date: initiation.preferredStartDate || null,
        notes: initiation.notes,
        ...legacy,
        term_months: Number(dealDetails.termMonths || 0),
        rate_type: dealDetails.rateType,
        proposed_apr: apr,
        monthly_payment: monthly,
        apr,
        total_payable: total,
        original_currency_code: originalCurrency,
        original_asset_value: legacy.asset_value,
        original_deposit: legacy.deposit,
        original_balloon: legacy.balloon,
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
        lifecycle_status: 'PENDING_APPROVAL',
      };

      const { data, error } = await db.deals().insert(payload).select('*').single();
      if (error) throw error;

      await Promise.all([
        db.notifications().insert({
          user_id: user.id,
          title: `Deal submitted - ${getDealReferenceLabel(data)}`,
          body: `${initiation.customerName} - ${initiation.productType} - ${originalCurrency} ${monthly.toLocaleString()}/mo`,
          type: 'deal_update',
          related_id: data.id,
        }).then(({ error: notificationError }) => {
          if (notificationError) throw notificationError;
        }),
        logAudit('deal', data.id, 'submitted', { reference: getDealReferenceLabel(data), product_family: initiation.productFamily }),
      ]);
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

      if (originatorIds.length === 0) return deals;

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, adminNotes, startDate, customerEmail }) => {
      return invokeAdminFunction('approve-deal', {
        dealId,
        adminNotes,
        startDate,
        customerEmail,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.adminDeals() });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useRejectDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, adminNotes }) =>
      invokeAdminFunction('reject-deal', { dealId, adminNotes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminDeals() }),
  });
}

export function useSetDealUnderReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId) => invokeAdminFunction('set-deal-under-review', { dealId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminDeals() }),
  });
}

export function useRetryCustomerInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, customerEmail }) => {
      if (!dealId) throw new Error('dealId is required');
      if (!customerEmail) throw new Error('Customer email is required');

      return invokeAdminFunction('send-invite', {
        dealId,
        customerEmail,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.adminDeals() });
    },
  });
}

export function useSaveDealDraft() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { initiation, dealDetails } = useDealStore();

  return useMutation({
    mutationFn: async () => {
      const legacy = mapDealPayloadToLegacyFields(dealDetails, initiation.productFamily);
      const { data, error } = await db.deals().insert({
        originator_id: user.id,
        customer_name: initiation.customerName || 'Draft',
        product_type: initiation.productType,
        product_family: initiation.productFamily,
        deal_payload: dealDetails,
        originator_reference: initiation.originatorReference,
        notes: initiation.notes,
        asset_value: legacy.asset_value,
        term_months: dealDetails.termMonths,
        original_currency_code: initiation.currencyCode || REPORTING_CURRENCY,
        status: 'draft',
        lifecycle_status: 'DRAFT',
      }).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.deals(user?.id) }),
  });
}
