export type Role = 'organizer' | 'storyteller' | 'listener';
export type Stage = '童年' | '求学' | '工作' | '恋爱结婚' | '养孩子' | '那个年代' | '心里话';
export interface Member { id: string; name: string; role: Role; revoked: boolean }
export interface Family { id: string; name: string; storytellerName: string }
export interface Ask {
  id: string;
  text: string;
  stage: Stage;
  depth: 'gentle' | 'deep';
  askedBy: string;
  status: 'pending' | 'answered' | 'skipped';
  parentStoryId: string | null;
  followupIds: string[];
  createdAt: string;
}
export interface Followup { id: string; memberId: string; name: string; text: string; answered: boolean }
export interface Story {
  id: string;
  askId: string | null;
  question: string;
  stage: Stage;
  text: string;
  type: 'audio' | 'text';
  mime: string | null;
  duration: number | null;
  bytes: number;
  storytellerId: string;
  recordedById: string;
  recordedBy: string;
  parentStoryId: string | null;
  createdAt: string;
  thenCount: number;
  thenNames: string[];
  myThen: boolean;
  followups: Followup[];
  canDelete: boolean;
}
export interface Snapshot {
  family: Family;
  member: Member;
  members: Member[];
  asks: Ask[];
  stories: Story[];
}
export interface AccessLinks { token: string; passcode?: string }
export interface CreatedFamily {
  snapshot: Snapshot;
  invite: AccessLinks;
  storyteller: AccessLinks;
  recoveryCode: string;
}
export interface StorySubmission {
  askId: string | null;
  submissionId: string;
  consent: true;
}
