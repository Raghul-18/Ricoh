import { createContext, useContext, useEffect, useState } from 'react';
import { authClient, db } from '../lib/backendClient';
import { queryClient } from '../lib/queryClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    const { data, error } = await db.profiles()
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) setProfile(data);
    return data;
  };

  useEffect(() => {
    // Get initial session
    authClient.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setUser(null);
        setProfile(null);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = authClient.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        queryClient.clear();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await authClient.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async ({ email, password, fullName, companyName, role = 'originator' }) => {
    const { data, error } = await authClient.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName, role },
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
    setProfile(null);
    queryClient.clear();
  };

  const refreshProfile = () => {
    if (user?.id) return fetchProfile(user.id);
  };

  const isAdmin = profile?.role === 'admin';
  const isOriginator = profile?.role === 'originator';
  const isCustomer = profile?.role === 'customer';
  const onboardingStatus = profile?.onboarding_status;
  const isApproved = onboardingStatus === 'approved';
  const needsOnboarding = isOriginator && !isApproved;

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      isAdmin,
      isOriginator,
      isCustomer,
      isApproved,
      needsOnboarding,
      onboardingStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
