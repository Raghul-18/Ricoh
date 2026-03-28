import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db, logAudit } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';

// ── Admin review queue (all applications) ─────────────────
export function useAdminQueue() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: keys.adminQueue(),
    queryFn: async () => {
      const { data: applications, error } = await db.applications()
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!applications?.length) return [];

      const userIds = [...new Set(applications.map((app) => app.user_id).filter(Boolean))];
      const applicationIds = applications.map((app) => app.id).filter(Boolean);

      const [profilesResult, documentsResult, checksResult] = await Promise.all([
        userIds.length
          ? db.profiles().select('*').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
        applicationIds.length
          ? db.documents().select('*').in('application_id', applicationIds).order('created_at')
          : Promise.resolve({ data: [], error: null }),
        applicationIds.length
          ? db.checks().select('*').in('application_id', applicationIds).order('created_at')
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesResult.error || documentsResult.error || checksResult.error) {
        throw profilesResult.error || documentsResult.error || checksResult.error;
      }

      const profilesById = Object.fromEntries((profilesResult.data || []).map((profile) => [profile.id, profile]));
      const documentsByApplicationId = groupBy(documentsResult.data || [], 'application_id');
      const checksByApplicationId = groupBy(checksResult.data || [], 'application_id');

      return applications.map((app) => ({
        ...app,
        profiles: profilesById[app.user_id] || null,
        originator_documents: documentsByApplicationId[app.id] || [],
        verification_checks: checksByApplicationId[app.id] || [],
      }));
    },
    enabled: !!isAdmin,
  });
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row?.[key];
    if (!value) return acc;
    if (!acc[value]) acc[value] = [];
    acc[value].push(row);
    return acc;
  }, {});
}

// ── Unified review decision (approve / reject / on_hold) ───
export function useReviewApplication() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const update = {
        status,
        admin_notes: notes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };

      if (status === 'approved') {
        // Derive risk score from check results rather than random
        // (will be set after checks are reviewed)
        update.risk_score = null;
      }

      const { error } = await db.applications().update(update).eq('id', id);
      if (error) throw error;

      const { data, error: fetchError } = await db.applications()
        .select('user_id')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const onboardingStatusMap = {
        approved: 'approved',
        rejected: 'rejected',
        on_hold: 'under_review',
        info_requested: 'info_requested',
      };
      const onboardingStatus = onboardingStatusMap[status];
      if (data?.user_id && onboardingStatus) {
        const { error: userUpdateError } = await db.profiles()
          .update({ onboarding_status: onboardingStatus })
          .eq('id', data.user_id);
        if (userUpdateError) throw userUpdateError;
      }

      // Notify originator
      const notifMap = {
        approved: {
          title: 'Application approved',
          body: 'Your application has been approved. You now have full access to the Ricoh Capital portal.',
        },
        rejected: {
          title: 'Application not approved',
          body: notes
            ? `Your application was not approved. Reason: ${notes}`
            : 'Your application was not approved at this time. Please contact support for details.',
        },
        info_requested: {
          title: 'More information required',
          body: notes
            ? `We need additional information to proceed: ${notes}`
            : 'We require additional information to proceed with your application. Our team will be in touch.',
        },
      };
      const notif = notifMap[status];
      if (notif && data?.user_id) {
        await db.notifications().insert({
          user_id: data.user_id,
          title: notif.title,
          body: notif.body,
          type: 'onboarding_update',
          related_id: id,
        });
      }

      await logAudit('application', id, status, { reviewed_by: user?.id, notes });
      return { ...data, applicationId: id };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: keys.adminQueue() });
      // So the originator's browser picks up approved/rejected status immediately (no 8s wait)
      if (result?.user_id) {
        qc.invalidateQueries({ queryKey: keys.application(result.user_id) });
      }
    },
  });
}

// ── Admin runs verification checks (creates rows if not exist) ─
export function useRunVerificationChecks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId) => {
      // Check if rows already exist
      const { data: existing } = await db.checks()
        .select('id')
        .eq('application_id', applicationId);

      if (existing?.length) {
        // Reset to queued so admin can re-run
        const { error } = await db.checks()
          .update({ status: 'queued', result_detail: null, checked_at: null })
          .eq('application_id', applicationId);
        if (error) throw error;
      } else {
        // Create fresh checks
        const checks = [
          { check_type: 'companies_house',    display_name: 'Companies House verification' },
          { check_type: 'aml_sanctions',      display_name: 'AML / Sanctions screening' },
          { check_type: 'document_auth',      display_name: 'Document authenticity' },
          { check_type: 'bank_analysis',      display_name: 'Bank statement analysis' },
          { check_type: 'identity_check',     display_name: 'Director identity verification' },
          { check_type: 'aml_policy_review',  display_name: 'AML policy document review' },
          { check_type: 'pi_insurance_check', display_name: 'PI insurance validation' },
        ];
        const { error } = await db.checks().insert(
          checks.map(c => ({ ...c, application_id: applicationId, status: 'queued' }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.adminQueue() }),
  });
}

// ── Admin manually sets a single check pass/fail ────────────
export function useUpdateCheckStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, applicationId, status, detail }) => {
      const { error } = await db.checks()
        .update({
          status,
          result_detail: detail || null,
          checked_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      await logAudit('verification_check', id, `check_${status}`, {
        application_id: applicationId,
        reviewed_by: user?.id,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.adminQueue() }),
  });
}
