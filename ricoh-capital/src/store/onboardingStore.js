import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useOnboardingStore = create(
  persist(
    (set, get) => ({
      registration: {
        companyName: '', companyRegNumber: '', companyType: 'Limited company (Ltd)',
        registeredAddress: '', contactFirstName: '', contactLastName: '',
        contactEmail: '', contactJobTitle: '', productLines: [],
      },
      documents: {
        certificate_of_incorporation: { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
        proof_of_address:             { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
        bank_statements:              { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
        director_photo_id:            { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
        aml_kyc_policy:               { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
        pi_insurance:                 { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
      },
      applicationId: null,
      uploadProgress: {},

      setRegistration: (data) => set((s) => ({ registration: { ...s.registration, ...data } })),
      setApplicationId: (id) => set({ applicationId: id }),
      setDocumentStatus: (docType, updates) => set((s) => ({
        documents: { ...s.documents, [docType]: { ...s.documents[docType], ...updates } },
      })),
      setUploadProgress: (docType, pct) => set((s) => ({
        uploadProgress: { ...s.uploadProgress, [docType]: pct },
      })),
      getUploadedCount: () => {
        const docs = get().documents;
        return Object.values(docs).filter(d => d.status === 'uploaded' || d.status === 'verified').length;
      },
      reset: () => set({
        registration: {
          companyName: '', companyRegNumber: '', companyType: 'Limited company (Ltd)',
          registeredAddress: '', contactFirstName: '', contactLastName: '',
          contactEmail: '', contactJobTitle: '', productLines: [],
        },
        documents: {
          certificate_of_incorporation: { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
          proof_of_address:             { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
          bank_statements:              { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
          director_photo_id:            { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
          aml_kyc_policy:               { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
          pi_insurance:                 { status: 'pending', fileName: null, fileSize: null, filePath: null, failureReason: null },
        },
        applicationId: null,
        uploadProgress: {},
      }),
    }),
    {
      name: 'zoro-onboarding',
      partialize: (s) => ({ registration: s.registration, applicationId: s.applicationId, documents: s.documents }),
    }
  )
);

// No emojis — icon components are used directly in pages
export const DOC_CONFIG = [
  { key: 'certificate_of_incorporation', label: 'Certificate of Incorporation',  required: true },
  { key: 'proof_of_address',             label: 'Proof of Business Address',     required: true },
  { key: 'bank_statements',              label: 'Business Bank Statements',      required: true },
  { key: 'director_photo_id',            label: 'Director Photo ID',             required: true },
  { key: 'aml_kyc_policy',              label: 'AML / KYC Policy',              required: false },
  { key: 'pi_insurance',                 label: 'PI Insurance Certificate',      required: false },
];
