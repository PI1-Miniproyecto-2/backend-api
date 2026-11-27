export interface RoomMember {
  uid: string;
  displayName: string;
  username: string | null;
  avatarId: string;
}

export interface RoomMembersResponse {
  members: RoomMember[];
}