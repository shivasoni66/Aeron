export type MissionCategory = 'M01' | 'M02' | 'M03' | 'M04';

export interface MissionModuleData {
  id: MissionCategory;
  code: string;
  title: string;
  description: string;
  stage: number;
  totalStages: number;
  stageLabel: string;
  progressPercent: number;
  asset: string;
  sortiesLogged: number;
  xpReward: number;
  icon: string;
}

export interface OperatorProgression {
  rankLevel: number;
  rankTitle: string;
  callsign: string;
  currentXp: number;
  targetXp: number;
  protocolComplianceIndex: number;
}

