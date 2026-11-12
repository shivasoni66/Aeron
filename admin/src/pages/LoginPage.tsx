import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CinematicAuthLayout } from '../components/auth/CinematicAuthLayout';
import { AuthBranding } from '../components/auth/AuthBranding';
import { DroneHeroVisual } from '../components/auth/DroneHeroVisual';
import { RadarPreview } from '../components/auth/RadarPreview';
import { AuthPanel } from '../components/auth/AuthPanel';

export const LoginPage: React.FC = () => {
  const { login, error, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Please enter both operator email and passphrase.');
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    try {
      const res = await login(email, password);
      if (res.success) {
        navigate('/', { replace: true });
      } else {
        setLocalError(res.message || 'Authentication rejected.');
      }
    } finally {
      setSubmitting(false);
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
          roleBadge="DRONE INTEL"
          portalTitle="OPERATIONAL FLIGHT DECK"
          portalSubtitle="Authorized Administrators & Aircraft Operations Access"
          roleDescriptor="ADMINISTRATOR ACCESS"
          email={email}
          setEmail={setEmail}
          emailPlaceholder="admin@aeron.internal"
          password={password}
          setPassword={setPassword}
          handleSubmit={handleSubmit}
          isSubmitting={submitting}
          error={localError || error}
          submitButtonLabel="AUTHENTICATE & ENTER GCS"
          footerText="SECURE AUTHENTICATION // AUTHORIZED PERSONNEL ONLY"
        />
      }
    />
  );
};
