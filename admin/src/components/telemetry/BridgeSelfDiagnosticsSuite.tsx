import React, { useState, useEffect, useCallback } from 'react';
import {
  BridgeDiagnosticsResponse,
  runBridgeDiagnostics
} from '../../services/bridgeController';

export const BridgeSelfDiagnosticsSuite: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<BridgeDiagnosticsResponse | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const executeDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const res = await runBridgeDiagnostics();
      if (res) {
        setDiagnostics(res);
        setLastRunTime(new Date().toLocaleTimeString());
      } else {
        setErrorMsg('Unable to retrieve diagnostics. Verify local controller is active on 127.0.0.1:8765.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error executing bridge self-diagnostics.');
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    executeDiagnostics();
  }, [executeDiagnostics]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-success/15 text-success border border-success/30 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            PASS
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-warning/15 text-warning border border-warning/30 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            WARNING
          </span>
        );
      case 'FAIL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-danger/15 text-danger border border-danger/30 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            FAIL
          </span>
        );
      case 'WAITING':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-elevated text-text-muted border border-border flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            WAITING
          </span>
        );
    }
  };

  return (
    <div className="w-full bg-surface rounded-xl border border-border p-5 shadow-sm space-y-4 font-sans text-xs">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-aeron-lime/10 border border-aeron-lime/25 flex items-center justify-center text-aeron-lime">
            <span className="material-symbols-outlined text-[20px]">fact_check</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-text-primary tracking-wide">
                Bridge Self-Diagnostics Suite
              </h2>
              {diagnostics && (
                <span
                  className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                    diagnostics.overall === 'PASS'
                      ? 'bg-success/15 text-success border border-success/30'
                      : diagnostics.overall === 'FAIL'
                      ? 'bg-danger/15 text-danger border border-danger/30'
                      : 'bg-warning/15 text-warning border border-warning/30'
                  }`}
                >
                  {diagnostics.overall} ({diagnostics.summary.passed}/{diagnostics.summary.total} PASS)
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted">
              Comprehensive 13-stage verification across hardware link, MAVLink stream, and cloud ingestion.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {lastRunTime && (
            <span className="text-[11px] text-text-muted font-mono hidden sm:inline">
              Last probe: {lastRunTime}
            </span>
          )}
          <button
            onClick={executeDiagnostics}
            disabled={isRunning}
            className="px-3.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-secondary text-text-primary border border-border font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] text-accent-primary ${isRunning ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isRunning ? 'Running Checks...' : 'Run Diagnostics'}</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-2 text-danger text-xs font-mono">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary Scoreboard */}
      {diagnostics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/70 flex items-center justify-between">
            <span className="text-text-muted text-[11px]">Total Checks</span>
            <span className="font-mono font-bold text-sm text-text-primary">
              {diagnostics.summary.total}
            </span>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/70 flex items-center justify-between">
            <span className="text-text-muted text-[11px]">Passed</span>
            <span className="font-mono font-bold text-sm text-success">
              {diagnostics.summary.passed}
            </span>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/70 flex items-center justify-between">
            <span className="text-text-muted text-[11px]">Warnings / Standby</span>
            <span className="font-mono font-bold text-sm text-warning">
              {diagnostics.summary.warnings}
            </span>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/70 flex items-center justify-between">
            <span className="text-text-muted text-[11px]">Waiting Link</span>
            <span className="font-mono font-bold text-sm text-text-muted">
              {diagnostics.summary.waiting}
            </span>
          </div>
        </div>
      )}

      {/* Diagnostics Check List */}
      <div className="space-y-2 pt-1">
        {diagnostics?.checks.map((chk, index) => (
          <div
            key={chk.id}
            className="p-3 rounded-lg bg-surface-elevated/70 border border-border/60 hover:border-border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div className="flex items-start sm:items-center gap-3">
              <span className="font-mono text-[10px] text-text-muted font-bold w-5 shrink-0 text-right">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h4 className="font-semibold text-xs text-text-primary">
                  {chk.name}
                </h4>
                <p className="text-[11px] text-text-secondary leading-snug mt-0.5 font-mono">
                  {chk.details}
                </p>
              </div>
            </div>
            <div className="self-end sm:self-center">
              {getStatusBadge(chk.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
