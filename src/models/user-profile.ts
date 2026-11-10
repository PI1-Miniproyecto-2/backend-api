import type { Timestamp } from 'firebase-admin/firestore';
import type { AVATAR_IDS } from '../config/avatars';

export interface UserProfile {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  usernameNormalized: string | null;
  email: string;
  avatarId: typeof AVATAR_IDS[number];
  authProvider: 'password' | 'google.com';
  profileCompleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
export type ProfileResponse = Omit<UserProfile, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };
