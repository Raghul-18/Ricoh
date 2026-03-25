import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,      // 2 minutes
      gcTime: 1000 * 60 * 10,         // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ── Query key factory ─────────────────────────────────────
export const keys = {
  profile: (id) => ['profile', id],
  application: (userId) => ['application', userId],
  documents: (appId) => ['documents', appId],
  checks: (appId) => ['checks', appId],
  adminQueue: () => ['admin', 'queue'],
  adminApplication: (id) => ['admin', 'application', id],
  deals: (originatorId) => ['deals', originatorId],
  deal: (id) => ['deal', id],
  contracts: (originatorId) => ['contracts', originatorId],
  contract: (id) => ['contract', id],
  paymentSchedule: (contractId) => ['payments', contractId],
  prospects: (originatorId) => ['prospects', originatorId],
  prospect: (id) => ['prospect', id],
  prospectActivities: (prospectId) => ['activities', prospectId],
  quotes: (originatorId) => ['quotes', originatorId],
  quote: (id) => ['quote', id],
  notifications: (userId) => ['notifications', userId],
  customerContracts: (customerId) => ['customer', 'contracts', customerId],
  adminDeals: () => ['admin', 'deals'],
  adminStats: () => ['admin', 'stats'],
  auditLogs: () => ['admin', 'auditLogs'],
  amendments: (dealId) => ['amendments', dealId],
  adminAmendments: () => ['admin', 'amendments'],
};
