import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db, realtimeClient, uploadDocument, logAudit } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';
import { useOnboardingStore, DOC_CONFIG } from '../store/onboardingStore';

// ── Read the user's application from DB (null until final submit) ──
// Pass { refetchInterval: 8000 } on verification page so approval is picked up without manual refresh.
export function useApplication(options = {}) {
  const { user } = useAuth();
  const { refetchInterval = false, refetchOnWindowFocus = true } = options;
  return useQuery({
    queryKey: keys.application(user?.id),
    queryFn: async () => {
      const { data, error } = await db.applications()
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data; // null if not submitted yet — that is expected
    },
    enabled: !!user,
    refetchInterval,
    refetchOnWindowFocus,
  });
}

// ── Step 1: save registration to Zustand only (NO DB insert) ──────
// DB row is created only when the user clicks "Submit application" on Step 2.
export function useSaveRegistration() {
  const { setRegistration } = useOnboardingStore();
  return useMutation({
    mutationFn: async (formData) => {
      // Pure local state — no network call
      setRegistration(formData);
      return formData;
    },
  });
}

// ── Step 2: upload file to Storage only (NO originator_documents row) ──
// Document DB rows are created in one batch inside useSubmitApplication.
export function useUploadDocument() {
  const { user } = useAuth();
  const { setDocumentStatus, setUploadProgress } = useOnboardingStore();

  return useMutation({
    mutationFn: async ({ documentType, displayName, file }) => {
      setDocumentStatus(documentType, { status: 'uploading', fileName: file.name });
      setUploadProgress(documentType, 10);

      const { path } = await uploadDocument(
        user.id,
        documentType,
        file,
        (pct) => setUploadProgress(documentType, 10 + Math.round(pct * 0.85)),
      );

      setUploadProgress(documentType, 100);
      setDocumentStatus(documentType, {
        status: 'uploaded',
        fileName: file.name,
        fileSize: file.size,
        filePath: path,
        failureReason: null,
      });

      return { path, documentType, displayName };
    },
    onError: (error, { documentType }) => {
      setDocumentStatus(documentType, {
        status: 'failed',
        failureReason: error.message || 'Upload failed',
      });
      setUploadProgress(documentType, 0);
    },
  });
}

// ── Step 2: submit application — creates ALL DB rows in one shot ──
// This is the ONLY place that writes to originator_applications and originator_documents.
export function useSubmitApplication() {
  const { user, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const { registration, documents, setApplicationId } = useOnboardingStore();

  return useMutation({
    mutationFn: async () => {
      if (!registration.companyName) {
        throw new Error('Registration details are missing. Please complete Step 1 first.');
      }

      // ① Insert the application
      const { data: app, error: appError } = await db.applications()
        .insert({
          user_id:            user.id,
          company_name:       registration.companyName,
          company_reg_number: registration.companyRegNumber,
          company_type:       registration.companyType,
          registered_address: registration.registeredAddress,
          contact_first_name: registration.contactFirstName,
          contact_last_name:  registration.contactLastName,
          contact_email:      registration.contactEmail,
          contact_job_title:  registration.contactJobTitle,
          product_lines:      registration.productLines,
          status:             'under_review',
          // no submitted_at column in schema — created_at is set automatically
        })
        .select()
        .single();
      if (appError) throw appError;
      setApplicationId(app.id);

      // ② Bulk-insert all document records (storage files already uploaded)
      const uploadedDocs = Object.entries(documents)
        .filter(([, doc]) => (doc.status === 'uploaded' || doc.status === 'verified') && doc.filePath)
        .map(([docType, doc]) => ({
          application_id: app.id,
          document_type:  docType,
          display_name:   DOC_CONFIG.find(d => d.key === docType)?.label || docType,
          file_name:      doc.fileName,
          file_path:      doc.filePath,
          file_size:      doc.fileSize,
          status:         'uploaded',
          uploaded_at:    new Date().toISOString(),
        }));

      if (uploadedDocs.length > 0) {
        const { error: docsError } = await db.documents().insert(uploadedDocs);
        if (docsError) throw docsError;
      }

      // ③ Update profile with company name
      await db.profiles()
        .update({ company_name: registration.companyName })
        .eq('id', user.id);

      // ④ Audit — verification checks are created by the admin when they open the application
      await logAudit('application', app.id, 'submitted_for_review', { user_id: user.id });
      return app;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.application(user?.id) });
      refreshProfile();
    },
  });
}

// ── Read documents from DB (only available after submit) ─────────
export function useDocuments(applicationId) {
  return useQuery({
    queryKey: keys.documents(applicationId),
    queryFn: async () => {
      const { data, error } = await db.documents()
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!applicationId,
  });
}

// ── Verification checks with realtime ────────────────────────────
export function useVerificationChecks(applicationId) {
  const qc = useQueryClient();

  useQuery({
    queryKey: ['checks-subscription', applicationId],
    queryFn: async () => {
      const channel = realtimeClient
        .channel(`checks-${applicationId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'verification_checks',
          filter: `application_id=eq.${applicationId}`,
        }, () => {
          qc.invalidateQueries({ queryKey: keys.checks(applicationId) });
        })
        .subscribe();
      return () => realtimeClient.removeChannel(channel);
    },
    enabled: !!applicationId,
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: keys.checks(applicationId),
    queryFn: async () => {
      const { data, error } = await db.checks()
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!applicationId,
    refetchInterval: 5000,
  });
}

