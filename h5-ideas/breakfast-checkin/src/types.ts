export type Role = 'owner' | 'backup' | 'resident' | 'guardian';
export type Principal = { role: Role; id: string; residentId?: string; shopId: string };
export type Resident = {
  id: string; name: string; guardianName: string; threshold: number; weekdays: number[];
  elderConsent: boolean; guardianConsent: boolean; status: 'waiting' | 'active' | 'paused'; startDate: string;
};
export type Arrival = { residentId: string; date: string; source: 'self' | 'staff'; operator: string };
export type Leave = { id: string; residentId: string; start: string; end: string };
export type Day = { date: string; open: boolean; revision: number; reviewedRevision: number | null; reviewer: string | null };
export type CareTask = {
  id: string; residentId: string; dates: string[]; previousDates?: string[]; state: 'pending' | 'claimed' | 'followup' | 'closed' | 'cancelled' | 'correction' | 'corrected';
  actionable?: boolean; assignee: string | null; attempts: number; nextDate: string | null; outcome: 'fake_handoff' | 'fake_no_answer' | 'fake_pause' | null;
};
export type DailyStatus = 'arrival' | 'leave' | 'closed' | 'unscheduled' | 'unknown' | 'missing' | 'waiting' | 'not_started' | 'paused';
export type RosterRow = { resident: Resident; status: DailyStatus; streak: number; unknownDates: string[]; arrival?: Arrival };
export type StaffView = {
  today: string; version: number; paused: boolean; day: Day; residents: Resident[]; roster: RosterRow[];
  tasks: CareTask[]; days: Day[]; leaves: Leave[];
};
export type MeView = { today: string; version: number; resident: Resident; arrival?: Arrival; leaves: Leave[]; paused: boolean };
export type GuardianView = { name: string; guardianName: string; accepted: boolean; paused: boolean };
export type SessionView = { principal: Principal; csrf: string };
export type PublicView = { shopId: string; shopName: string; demo: true; disclaimer: string };
