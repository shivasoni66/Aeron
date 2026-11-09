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
    <div className="flex flex-col w-full gap-space-lg font-label-telemetry text-xs">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">[ANALYTICS ENGINE]</span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-label-telemetry text-[10px] font-bold">
              DATABASE AGGREGATIONS
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
            OPERATIONAL REPORTS & ANALYTICS
          </h1>
          <p className="font-body-sm text-secondary text-xs">
            Authoritative fleet statistics, mission vertical distributions, and flight telemetry metrics.
          </p>
        </div>

        {analytics?.dataFreshnessTimestamp && (
          <div className="text-right text-[11px] text-outline">
            <span>DATA FRESHNESS: </span>
            <span className="text-primary-fixed">{new Date(analytics.dataFreshnessTimestamp).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-outline">COMPUTING REAL-TIME DATABASE AGGREGATIONS...</div>
      ) : (
        <div className="space-y-space-md">
          {/* Top Row Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40 space-y-2">
              <span className="text-outline uppercase">CUMULATIVE FLIGHT TIME</span>
              <div className="text-3xl font-headline-md text-primary font-bold">
                {metrics?.totalFlightDurationHours || 0} <span className="text-sm font-normal text-secondary">HOURS</span>
              </div>
              <p className="text-[11px] text-outline">Aggregate duration across all logged airframe sorties</p>
            </div>

            <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40 space-y-2">
              <span className="text-outline uppercase">TELEMETRY SOURCES</span>
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <span className="text-outline block text-[10px]">REAL AIRFRAME</span>
                  <span className="text-xl font-bold text-primary-fixed">{metrics?.flightsBySource?.REAL || 0}</span>
                </div>
                <div className="h-8 w-[1px] bg-surface-variant" />
                <div>
                  <span className="text-outline block text-[10px]">SIMULATION</span>
                  <span className="text-xl font-bold text-secondary">{metrics?.flightsBySource?.SIMULATION || 0}</span>
                </div>
              </div>
            </div>

            <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40 space-y-2">
              <span className="text-outline uppercase">VERIFICATION STAGING</span>
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <span className="text-outline block text-[10px]">PENDING</span>
                  <span className="text-xl font-bold text-error">{metrics?.outcomesByReviewStatus?.PENDING_REVIEW || 0}</span>
                </div>
                <div className="h-8 w-[1px] bg-surface-variant" />
                <div>
                  <span className="text-outline block text-[10px]">PUBLISHED</span>
                  <span className="text-xl font-bold text-primary-fixed">{metrics?.outcomesByReviewStatus?.PUBLISHED || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            {/* Missions by Category */}
            <div className="p-space-lg rounded bg-surface-container-low border border-surface-variant/40 space-y-3">
              <h3 className="font-headline-md text-base text-primary">MISSION VOLUME BY VERTICAL</h3>
              <div className="space-y-2.5">
                {Object.entries(metrics?.missionsByCategory || {}).length === 0 ? (
                  <div className="text-outline py-4 text-center">NO MISSION DATA RECORDED</div>
                ) : (
                  Object.entries(metrics?.missionsByCategory || {}).map(([cat, count]) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-secondary">
                        <span>{cat}</span>
                        <strong className="text-primary">{count}</strong>
                      </div>
                      <div className="w-full bg-surface-container-lowest h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary-fixed h-full" style={{ width: `${Math.min(100, count * 20)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Incidents by Severity */}
            <div className="p-space-lg rounded bg-surface-container-low border border-surface-variant/40 space-y-3">
              <h3 className="font-headline-md text-base text-primary">INCIDENTS BY SEVERITY RATING</h3>
              <div className="space-y-2.5">
                {Object.entries(metrics?.incidentsBySeverity || {}).length === 0 ? (
                  <div className="text-outline py-4 text-center">ZERO INCIDENTS RECORDED</div>
                ) : (
                  Object.entries(metrics?.incidentsBySeverity || {}).map(([sev, count]) => (
                    <div key={sev} className="space-y-1">
                      <div className="flex justify-between text-secondary">
                        <span className={sev === 'CRITICAL' ? 'text-error font-bold' : ''}>{sev}</span>
                        <strong className="text-primary">{count}</strong>
                      </div>
                      <div className="w-full bg-surface-container-lowest h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${sev === 'CRITICAL' || sev === 'HIGH' ? 'bg-error' : 'bg-primary-fixed'}`}
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

