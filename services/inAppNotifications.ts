import { Alert } from 'react-native';
import { supabase } from '@/services/supabase/client';

type Announcement = {
  id: string;
  title: string;
  body: string;
  target_user_id: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const isWithinTimeWindow = (item: Announcement, now: Date) => {
  const startsAt = item.starts_at ? new Date(item.starts_at) : null;
  const endsAt = item.ends_at ? new Date(item.ends_at) : null;

  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
};

export const showLatestUnreadAnnouncement = async (userId?: string) => {
  if (!userId) return;

  const now = new Date();

  const { data: rawAnnouncements, error: announcementsError } = await supabase
    .from('announcements')
    .select('id, title, body, target_user_id, is_active, starts_at, ends_at, created_at')
    .eq('is_active', true)
    .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (announcementsError) {
    return;
  }

  const announcements = ((rawAnnouncements || []) as Announcement[])
    .filter((item) => isWithinTimeWindow(item, now));

  if (announcements.length === 0) return;

  const ids = announcements.map((item) => item.id);

  const { data: readRows } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('user_id', userId)
    .in('announcement_id', ids);

  const readIdSet = new Set((readRows || []).map((item: { announcement_id: string }) => item.announcement_id));
  const firstUnread = announcements.find((item) => !readIdSet.has(item.id));

  if (!firstUnread) return;

  Alert.alert(firstUnread.title, firstUnread.body, [
    {
      text: 'Ок',
      onPress: async () => {
        await supabase.from('announcement_reads').insert([
          {
            announcement_id: firstUnread.id,
            user_id: userId,
          },
        ]);
      },
    },
  ]);
};
