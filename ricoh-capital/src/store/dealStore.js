import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function makeRef() {
  const year = new Date().getFullYear();
  const number = Math.floor(Math.random() * 90000 + 10000);
  return `REF-${year}-${number}`;
}

function defaultInitiation() {
  return {
    customerName: '',
    customerEmail: '',
    productType: 'Asset Finance - Hire Purchase',
    originatorReference: makeRef(),
    currencyCode: 'GBP',
    preferredStartDate: '',
    notes: '',
  };
}

function defaultAssetDetails() {
  return {
    assetType: 'Commercial vehicle',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    assetValue: 0,
    termMonths: 36,
    deposit: 0,
    balloon: 0,
    rateType: 'Fixed',
  };
}

export const useDealStore = create(
  persist(
    (set, get) => ({
      initiation: defaultInitiation(),
      assetDetails: defaultAssetDetails(),
      submittedDealId: null,
      submittedRefNumber: null,

      setInitiation: (data) => set((state) => ({
        initiation: { ...state.initiation, ...data },
      })),

      setAssetDetails: (data) => set((state) => ({
        assetDetails: { ...state.assetDetails, ...data },
      })),

      setSubmitted: (dealId, refNumber) => set({
        submittedDealId: dealId,
        submittedRefNumber: refNumber,
      }),

      getMonthlyPayment: () => {
        const { assetValue, deposit, balloon, termMonths } = get().assetDetails;
        const financed = assetValue - deposit - balloon;
        if (financed <= 0 || termMonths <= 0) return 0;
        const monthlyRate = 0.072 / 12;
        return Math.round((financed * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths)));
      },

      getTotalPayable: () => get().getMonthlyPayment() * get().assetDetails.termMonths,

      reset: () => set({
        initiation: defaultInitiation(),
        assetDetails: defaultAssetDetails(),
        submittedDealId: null,
        submittedRefNumber: null,
      }),
    }),
    {
      name: 'ricoh-deal',
      partialize: (state) => ({ initiation: state.initiation, assetDetails: state.assetDetails }),
    },
  ),
);
