import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Send approved originators away from early onboarding steps */
export function useRedirectWhenApproved() {
  const navigate = useNavigate();
  const { profile, isApproved, loading } = useAuth();

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== 'originator' || !isApproved) return;
    navigate('/onboarding/welcome', { replace: true });
  }, [loading, profile?.role, isApproved, navigate]);
}
