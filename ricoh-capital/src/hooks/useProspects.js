import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/backendClient';
import { keys } from '../lib/queryClient';
import { useAuth } from '../auth/AuthContext';

export function useProspects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.prospects(user?.id),
    queryFn: async () => {
      const { data, error } = await db.prospects()
        .select('*')
        .eq('originator_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useProspect(prospectId) {
  return useQuery({
    queryKey: keys.prospect(prospectId),
    queryFn: async () => {
      const { data, error } = await db.prospects()
        .select('*')
        .eq('id', prospectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!prospectId,
  });
}

export function useProspectActivities(prospectId) {
  return useQuery({
    queryKey: keys.prospectActivities(prospectId),
    queryFn: async () => {
      const { data, error } = await db.activities()
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!prospectId,
  });
}

export function useCreateProspect() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const { data, error } = await db.prospects()
        .insert({ ...formData, originator_id: user.id })
        .select()
        .single();
      if (error) throw error;
      await db.activities().insert({
        prospect_id: data.id,
        activity_type: 'created',
        description: 'Prospect created',
        created_by: user.id,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.prospects(user?.id) }),
  });
}

export function useUpdateProspect(scopedId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const prospectId = scopedId || payload.prospectId;
      const formData = scopedId ? payload : payload.data;
      const { data, error } = await db.prospects()
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', prospectId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.prospects(user?.id) });
      if (data?.id) qc.invalidateQueries({ queryKey: keys.prospect(data.id) });
    },
  });
}

export function useDeleteProspect() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prospectId) => {
      const { error } = await db.prospects().delete().eq('id', prospectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.prospects(user?.id) }),
  });
}

export function useLogActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ prospectId, activityType, description }) => {
      const { data, error } = await db.activities()
        .insert({
          prospect_id: prospectId,
          activity_type: activityType,
          description,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { prospectId }) => {
      qc.invalidateQueries({ queryKey: keys.prospectActivities(prospectId) });
    },
  });
}

export function useCreateActivity(prospectId) {
  const logActivity = useLogActivity();
  return {
    ...logActivity,
    mutate: (payload, options) => logActivity.mutate({ prospectId, activityType: payload.type, description: payload.notes }, options),
    mutateAsync: (payload, options) => logActivity.mutateAsync({ prospectId, activityType: payload.type, description: payload.notes }, options),
  };
}
