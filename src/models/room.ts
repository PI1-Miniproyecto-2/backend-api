import type { Timestamp } from 'firebase-admin/firestore';

export interface RoomDocument {
  name: string;
  ownerUid: string;
  participantUids: string[];
  createdAt: Timestamp;
  status: 'active';
}

export interface Room extends RoomDocument {
  roomId: string;
}

export type RoomResponse = Omit<Room, 'createdAt'> & { createdAt: string };
