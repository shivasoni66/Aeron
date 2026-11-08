import { AuthenticatedUser } from './auth.middleware.js';

export class AuthorizationPolicy {
  /**
   * Evaluates if the authenticated user can access a specific CitizenReport resource.
   * - Citizen: only permitted if they are the original author.
   * - Manager & Admin: permitted for municipal review.
   */
  public static canAccessCitizenReport(
    user: AuthenticatedUser,
    reportCitizenId: string
  ): boolean {
    if (user.role === 'admin' || user.role === 'manager') {
      return true;
    }

    if (user.role === 'citizen') {
      return user.id === reportCitizenId;
    }

    return false;
  }

  /**
   * Evaluates if the authenticated user can manage or inspect a Mission.
   * - Admin: permitted for any mission.
   * - Manager: permitted if assigned to the mission.
   * - Citizen: STRICTLY DENIED from accessing internal mission operational details.
   */
  public static canAccessMission(
    user: AuthenticatedUser,
    assignedManagerId?: string
  ): boolean {
    if (user.role === 'admin') {
      return true;
    }

    if (user.role === 'manager') {
      return !assignedManagerId || user.id === assignedManagerId;
    }

    return false;
  }

  /**
   * Evaluates if the user can subscribe to or stream raw drone telemetry.
   * - Admin: full access to all hardware and telemetry.
   * - Manager: access to telemetry of drones assigned to their missions.
   * - Citizen: STRICTLY DENIED from raw telemetry feeds under all circumstances.
   */
  public static canAccessTelemetry(
    user: AuthenticatedUser,
    isDroneAssignedToManager: boolean = false
  ): boolean {
    if (user.role === 'admin') {
      return true;
    }

    if (user.role === 'manager') {
      return isDroneAssignedToManager;
    }

    // Citizens must NEVER receive raw telemetry or internal flight bus data
    return false;
  }

  /**
   * Evaluates access to an Incident.
   * If the incident is marked isConfidential (e.g. Subterranean SAR), citizens are strictly blocked.
   */
  public static canAccessIncident(
    user: AuthenticatedUser,
    isConfidential: boolean
  ): boolean {
    if (user.role === 'admin' || user.role === 'manager') {
      return true;
    }

    if (user.role === 'citizen') {
      return !isConfidential;
    }

    return false;
  }
}

