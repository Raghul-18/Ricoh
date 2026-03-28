import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  calcMonthlyPayment,
  calcTotalPayable,
  createDefaultDealPayload,
  getProductFamily,
} from '../lib/dealConfig';

function makeRef() {
  const year = new Date().getFullYear();
  const number = Math.floor(Math.random() * 90000 + 10000);
  return `REF-${year}-${number}`;
}

function defaultInitiation() {
  const productType = 'Asset Finance - Hire Purchase';
  return {
    customerName: '',
    customerEmail: '',
    productType,
    productFamily: getProductFamily(productType),
    originatorReference: makeRef(),
    currencyCode: 'GBP',
    preferredStartDate: '',
    notes: '',
  };
}

function defaultDealDetails(productFamily = defaultInitiation().productFamily) {
  return createDefaultDealPayload(productFamily);
}

export const useDealStore = create(
  persist(
    (set, get) => ({
      initiation: defaultInitiation(),
      dealDetails: defaultDealDetails(),
      assetDetails: defaultDealDetails(),
      submittedDealId: null,
      submittedRefNumber: null,

      setInitiation: (data) => set((state) => ({
        initiation: { ...state.initiation, ...data, productFamily: getProductFamily(data.productType || state.initiation.productType) },
        dealDetails: data.productType && getProductFamily(data.productType) !== state.initiation.productFamily
          ? defaultDealDetails(getProductFamily(data.productType))
          : state.dealDetails,
        assetDetails: data.productType && getProductFamily(data.productType) !== state.initiation.productFamily
          ? defaultDealDetails(getProductFamily(data.productType))
          : state.dealDetails,
      })),

      setDealDetails: (data) => set((state) => ({
        dealDetails: { ...state.dealDetails, ...data },
        assetDetails: { ...state.dealDetails, ...data },
      })),

      setAssetDetails: (data) => set((state) => ({
        dealDetails: { ...state.dealDetails, ...data },
        assetDetails: { ...state.dealDetails, ...data },
      })),

      setSubmitted: (dealId, refNumber) => set({
        submittedDealId: dealId,
        submittedRefNumber: refNumber,
      }),

      getMonthlyPayment: () => {
        const { dealDetails, initiation } = get();
        return calcMonthlyPayment(dealDetails, initiation.productFamily);
      },

      getTotalPayable: () => {
        const { dealDetails, initiation } = get();
        return calcTotalPayable(dealDetails, initiation.productFamily);
      },

      reset: () => set({
        initiation: defaultInitiation(),
        dealDetails: defaultDealDetails(),
        assetDetails: defaultDealDetails(),
        submittedDealId: null,
        submittedRefNumber: null,
      }),
    }),
    {
      name: 'ricoh-deal',
      partialize: (state) => ({ initiation: state.initiation, dealDetails: state.dealDetails, assetDetails: state.dealDetails }),
    },
  ),
);
