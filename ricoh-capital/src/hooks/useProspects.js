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
        .select('*, assigned_profile:assigned_to(full_name, avatar_initials)')
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
        .select('*, created_by_profile:created_by(full_name, avatar_initials)')
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
      // Log creation activity
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

// Can be called as useUpdateProspect() with { prospectId, data }
// OR as useUpdateProspect(id) and mutateAsync(updateData) — scoped form
export function useUpdateProspect(scopedId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      // Scoped form: useUpdateProspect(id) + mutateAsync({ field: value })
      // Classic form: useUpdateProspect() + mutateAsync({ prospectId, data })
      const prospectId = scopedId || payload.prospectId;
      const formData   = scopedId ? payload : payload.data;
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

// Scoped activity creation — useCreateActivity(prospectId)
// mutateAsync({ type, notes }) — `notes` is stored in `description` column
export function useCreateActivity(prospectId) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, notes }) => {
      const { data, error } = await db.activities()
        .insert({
          prospect_id: prospectId,
          activity_type: type,
          description: notes,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.prospectActivities(prospectId) });
    },
  });
}
