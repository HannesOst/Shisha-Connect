export type RsvpStatus = 'yes' | 'maybe' | 'no';
export type MeetupStatus = 'voting' | 'confirmed' | 'cancelled';
export type BarSource = 'osm' | 'manual' | 'sample';

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  notifications_enabled: boolean;
  reminders_enabled: boolean;
};

export type PublicProfile = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type GroupMember = {
  role: 'admin' | 'member';
  joined_at: string;
  profile: PublicProfile;
};

/** A bar stored in a group (used by meetups). */
export type Bar = {
  id: string;
  group_id: string;
  external_id: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  opening_hours: string | null;
  website: string | null;
  phone: string | null;
  source: BarSource;
};

/** A bar as shown in search results / favourites, not necessarily stored yet. */
export type BarCandidate = {
  key: string;
  id?: string;
  external_id?: string | null;
  group_id?: string;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  opening_hours?: string | null;
  website?: string | null;
  phone?: string | null;
  source: BarSource;
  distanceKm?: number | null;
};

export type Rsvp = {
  user_id: string;
  status: RsvpStatus;
  updated_at: string;
};

export type MeetupOption = {
  id: string;
  starts_at: string;
  bar: Bar | null;
  votes: { user_id: string }[];
};

export type Meetup = {
  id: string;
  group_id: string;
  created_by: string;
  message: string | null;
  status: MeetupStatus;
  starts_at: string | null;
  created_at: string;
  updated_at: string;
  bar: Bar | null;
  group: { id: string; name: string } | null;
  creator: PublicProfile | null;
  rsvps: Rsvp[];
  options?: MeetupOption[];
};

export type AppNotification = {
  id: string;
  meetup_id: string | null;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};
