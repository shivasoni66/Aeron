import React, { useEffect, useState } from 'react';
import { fetchAnalyticsOverview } from '../services/api';
import { AnalyticsOverviewData } from '../types';

export const ReportsAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchAnalyticsOverview()
      .then((data) => setAnalytics(data))
      .catch((err) => console.warn(err))
      .finally(() => setIsLoading(false));
  }, []);

  const metrics = analytics?.metrics;

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-sans text-xs font-semibold border border-primary-fixed/20">
              Fleet & Mission Aggregates
            </span>
          </div>
          <h1 className="font-sans text-2xl font-bold text-on-surface tracking-tight mt-1">
            Operational Reports & Analytics
          </h1>
          <p className="font-sans text-secondary text-xs">
            Authoritative fleet operational statistics, vertical distributions, and telemetry reliability metrics.
          </p>
        </div>

        {analytics?.dataFreshnessTimestamp && (
          <div className="text-right text-[11px] font-sans text-outline">
            <span>Data Freshness: </span>
            <span className="text-primary-fixed font-mono font-bold">{new Date(analytics.dataFreshnessTimestamp).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-outline font-sans text-xs">
          Computing real-time database aggregations...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Row Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-xl bg-surface-container-low border border-surface-variant/40 space-y-2 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-outline text-xs font-mono uppercase">Cumulative Flight Time</span>
                <span className="material-symbols-outlined text-primary-fixed text-lg">flight_takeoff</span>
              </div>
              <div className="text-3xl font-mono text-on-surface font-bold tracking-tight">
                {metrics?.totalFlightDurationHours || 0} <span className="text-sm font-normal text-secondary">HOURS</span>
              </div>
              <p className="text-[11px] text-secondary font-sans">Aggregate airborne duration across all recorded airframe sorties</p>
            </div>

            <div className="p-5 rounded-xl bg-surface-container-low border border-surface-variant/40 space-y-2 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-outline text-xs font-mono uppercase">Telemetry Sources</span>
                <span className="material-symbols-outlined text-status-info text-lg">sensors</span>
              </div>
              <div className="flex items-center gap-6 mt-2 font-mono">
                <div>
                  <span className="text-outline block text-[10px]">REAL HARDWARE</span>
                  <span className="text-2xl font-bold text-primary-fixed">{metrics?.flightsBySource?.REAL || 0}</span>
                </div>
                <div className="h-8 w-[1px] bg-surface-variant/60" />
                <div>
                  <span className="text-outline block text-[10px]">SIMULATION</span>
                  <span className="text-2xl font-bold text-secondary">{metrics?.flightsBySource?.SIMULATION || 0}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-container-low border border-surface-variant/40 space-y-2 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-outline text-xs font-mono uppercase">Verification Staging</span>
                <span className="material-symbols-outlined text-status-warning text-lg">fact_check</span>
              </div>
              <div className="flex items-center gap-6 mt-2 font-mono">
                <div>
                  <span className="text-outline block text-[10px]">PENDING REVIEW</span>
                  <span className="text-2xl font-bold text-status-warning">{metrics?.outcomesByReviewStatus?.PENDING_REVIEW || 0}</span>
                </div>
                <div className="h-8 w-[1px] bg-surface-variant/60" />
                <div>
                  <span className="text-outline block text-[10px]">PUBLISHED</span>
                  <span className="text-2xl font-bold text-primary-fixed">{metrics?.outcomesByReviewStatus?.PUBLISHED || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Missions by Category */}
            <div className="p-6 rounded-xl bg-surface-container-low border border-surface-variant/40 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-surface-variant/40">
                <h3 className="font-sans font-bold text-base text-on-surface">Mission Volume by Vertical</h3>
                <span className="font-mono text-[10px] text-outline">AGGREGATE SESSIONS</span>
              </div>
              <div className="space-y-3 font-mono text-xs">
                {Object.entries(metrics?.missionsByCategory || {}).length === 0 ? (
                  <div className="text-outline py-8 text-center">NO MISSION DATA RECORDED</div>
                ) : (
                  Object.entries(metrics?.missionsByCategory || {}).map(([cat, count]) => (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex justify-between text-secondary">
                        <span className="text-on-surface font-medium">{cat.replace(/_/g, ' ')}</span>
                        <strong className="text-primary-fixed">{count}</strong>
                      </div>
                      <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden border border-surface-variant/30">
                        <div
                          className="bg-primary-fixed h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, count * 20)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Incidents by Severity */}
            <div className="p-6 rounded-xl bg-surface-container-low border border-surface-variant/40 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-surface-variant/40">
                <h3 className="font-sans font-bold text-base text-on-surface">Incidents by Severity Rating</h3>
                <span className="font-mono text-[10px] text-outline">SAFETY METRICS</span>
              </div>
              <div className="space-y-3 font-mono text-xs">
                {Object.entries(metrics?.incidentsBySeverity || {}).length === 0 ? (
                  <div className="text-outline py-8 text-center">ZERO INCIDENTS RECORDED</div>
                ) : (
                  Object.entries(metrics?.incidentsBySeverity || {}).map(([sev, count]) => (
                    <div key={sev} className="space-y-1.5">
                      <div className="flex justify-between text-secondary">
                        <span className={sev === 'CRITICAL' ? 'text-status-danger font-bold' : 'text-on-surface'}>
                          {sev}
                        </span>
                        <strong className="text-on-surface">{count}</strong>
                      </div>
                      <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden border border-surface-variant/30">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            sev === 'CRITICAL'
                              ? 'bg-status-danger'
                              : sev === 'HIGH'
                              ? 'bg-status-warning'
                              : sev === 'MEDIUM'
                              ? 'bg-status-info'
                              : 'bg-primary-fixed'
                          }`}
                          style={{ width: `${Math.min(100, count * 25)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
