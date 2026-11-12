import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CinematicAuthLayout } from '../components/auth/CinematicAuthLayout';
import { AuthBranding } from '../components/auth/AuthBranding';
import { DroneHeroVisual } from '../components/auth/DroneHeroVisual';
import { RadarPreview } from '../components/auth/RadarPreview';
import { AuthPanel } from '../components/auth/AuthPanel';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated && user && ['manager', 'admin'].includes(user.role)) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both operator email and passphrase.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.message || 'Invalid credentials.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CinematicAuthLayout
      securityNotice="AERON AEROSPACE SYSTEMS // SECURE GATEWAY // STRICT RBAC ENFORCED"
      branding={<AuthBranding />}
      hero={<DroneHeroVisual imageSrc="/stealth_drone_hero.png" />}
      radar={<RadarPreview />}
      panel={
        <AuthPanel
          roleBadge="MISSION INTEL"
          portalTitle="OPERATIONAL FLIGHT DECK"
          portalSubtitle="Authorized Mission Manager & Flight Commander Access"
          roleDescriptor="MISSION MANAGER ACCESS"
          email={email}
          setEmail={setEmail}
          emailPlaceholder="manager@aeron.internal"
          password={password}
          setPassword={setPassword}
          handleSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={error}
          submitButtonLabel="AUTHENTICATE & ENTER MISSION DESK"
          footerText="SECURE AUTHENTICATION // AUTHORIZED PERSONNEL ONLY"
        />
      }
    />
  );
};
