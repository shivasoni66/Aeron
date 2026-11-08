import { describe, it, expect } from 'vitest';
import { AuthorizationPolicy } from '../../src/middleware/policy.middleware.js';
import { AuthenticatedUser } from '../../src/middleware/auth.middleware.js';

describe('AERON Auth — Reusable Resource Ownership Policies', () => {
  const citizenUser: AuthenticatedUser = {
    id: 'user_cit_111',
    email: 'citizen1@aeron.gov',
    name: 'Citizen Jane',
    role: 'citizen',
    accountStatus: 'active'
  };

  const otherCitizenUser: AuthenticatedUser = {
    id: 'user_cit_222',
    email: 'citizen2@aeron.gov',
    name: 'Citizen Bob',
    role: 'citizen',
    accountStatus: 'active'
  };

  const managerUser: AuthenticatedUser = {
    id: 'user_mgr_333',
    email: 'manager@aeron.gov',
    name: 'Manager Smith',
    role: 'manager',
    accountStatus: 'active'
  };

  const adminUser: AuthenticatedUser = {
    id: 'user_adm_999',
    email: 'admin@aeron.gov',
    name: 'Admin Chief',
    role: 'admin',
    accountStatus: 'active'
  };

  // 1. Citizen Report Ownership Policy
  describe('canAccessCitizenReport', () => {
    it('allows a citizen to access their own report', () => {
      const allowed = AuthorizationPolicy.canAccessCitizenReport(citizenUser, 'user_cit_111');
      expect(allowed).toBe(true);
    });

    it('denies a citizen from accessing another citizen report', () => {
      const allowed = AuthorizationPolicy.canAccessCitizenReport(citizenUser, 'user_cit_222');
      expect(allowed).toBe(false);
    });

    it('allows managers and admins to inspect any citizen report for triage', () => {
      expect(AuthorizationPolicy.canAccessCitizenReport(managerUser, 'user_cit_111')).toBe(true);
      expect(AuthorizationPolicy.canAccessCitizenReport(adminUser, 'user_cit_111')).toBe(true);
    });
  });

  // 2. Mission Access Policy
  describe('canAccessMission', () => {
    it('allows admins to access any operational mission', () => {
      expect(AuthorizationPolicy.canAccessMission(adminUser, 'user_mgr_other')).toBe(true);
    });

    it('allows managers to access missions assigned to them', () => {
      expect(AuthorizationPolicy.canAccessMission(managerUser, 'user_mgr_333')).toBe(true);
    });

    it('denies managers from accessing missions assigned to other managers', () => {
      expect(AuthorizationPolicy.canAccessMission(managerUser, 'user_mgr_999')).toBe(false);
    });

    it('strictly denies citizens from accessing internal mission records', () => {
      expect(AuthorizationPolicy.canAccessMission(citizenUser, 'user_cit_111')).toBe(false);
      expect(AuthorizationPolicy.canAccessMission(citizenUser, undefined)).toBe(false);
    });
  });

  // 3. Telemetry Stream Access Policy
  describe('canAccessTelemetry', () => {
    it('allows admins full access to telemetry', () => {
      expect(AuthorizationPolicy.canAccessTelemetry(adminUser)).toBe(true);
    });

    it('allows managers access only if the drone is assigned to their operational mission', () => {
      expect(AuthorizationPolicy.canAccessTelemetry(managerUser, true)).toBe(true);
      expect(AuthorizationPolicy.canAccessTelemetry(managerUser, false)).toBe(false);
    });

    it('STRICTLY DENIES citizens from receiving raw telemetry under all conditions', () => {
      expect(AuthorizationPolicy.canAccessTelemetry(citizenUser, true)).toBe(false);
      expect(AuthorizationPolicy.canAccessTelemetry(citizenUser, false)).toBe(false);
    });
  });

  // 4. Confidential Incident / Subterranean SAR Protection
  describe('canAccessIncident', () => {
    it('allows citizens to view public (non-confidential) incidents', () => {
      expect(AuthorizationPolicy.canAccessIncident(citizenUser, false)).toBe(true);
    });

    it('STRICTLY BLOCKS citizens from confidential search-and-rescue incidents', () => {
      expect(AuthorizationPolicy.canAccessIncident(citizenUser, true)).toBe(false);
      expect(AuthorizationPolicy.canAccessIncident(otherCitizenUser, true)).toBe(false);
    });

    it('allows authorized managers and admins to view confidential SAR incidents', () => {
      expect(AuthorizationPolicy.canAccessIncident(managerUser, true)).toBe(true);
      expect(AuthorizationPolicy.canAccessIncident(adminUser, true)).toBe(true);
    });
  });
});

