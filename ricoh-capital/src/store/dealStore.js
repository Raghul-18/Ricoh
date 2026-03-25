import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function makeRef() {
  const y = new Date().getFullYear();
  const n = Math.floor(Math.random() * 90000 + 10000);
  return `REF-${y}-${n}`;
}

export const useDealStore = create(
  persist(
  (set, get) => ({
  // Step 1 data
  initiation: {
    customerName: '',
    customerEmail: '',
    productType: 'Asset Finance — Hire Purchase',
    originatorReference: makeRef(),
    preferredStartDate: '',
    notes: '',
  },
  // Step 2 data
  assetDetails: {
    assetType: 'Commercial vehicle',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    assetValue: 0,
    termMonths: 36,
    deposit: 0,
    balloon: 0,
    rateType: 'Fixed',
  },
  // Submitted deal ID (for confirmation page)
  submittedDealId: null,
  submittedRefNumber: null,

  setInitiation: (data) => set((s) => ({
    initiation: { ...s.initiation, ...data },
  })),

  setAssetDetails: (data) => set((s) => ({
    assetDetails: { ...s.assetDetails, ...data },
  })),

  setSubmitted: (dealId, refNumber) => set({
    submittedDealId: dealId,
    submittedRefNumber: refNumber,
  }),

  getMonthlyPayment: () => {
    const { assetValue, deposit, balloon, termMonths } = get().assetDetails;
    const financed = assetValue - deposit - balloon;
    if (financed <= 0 || termMonths <= 0) return 0;
    const r = 0.072 / 12;
    return Math.round((financed * r) / (1 - Math.pow(1 + r, -termMonths)));
  },

  getTotalPayable: () => {
    const monthly = get().getMonthlyPayment();
    return monthly * get().assetDetails.termMonths;
  },

  reset: () => set({
    initiation: { customerName: '', customerEmail: '', productType: 'Asset Finance — Hire Purchase', originatorReference: makeRef(), preferredStartDate: '', notes: '' },
    assetDetails: { assetType: 'Commercial vehicle', make: '', model: '', year: new Date().getFullYear(), assetValue: 0, termMonths: 36, deposit: 0, balloon: 0, rateType: 'Fixed' },
    submittedDealId: null,
    submittedRefNumber: null,
  }),
  }),
  {
    name: 'zoro-deal',
    partialize: (s) => ({ initiation: s.initiation, assetDetails: s.assetDetails }),
  }
));
