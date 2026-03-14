import Constants from 'expo-constants';
import { supabase } from '@/services/supabase/client';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_CHUNK_SIZE = 100;
const FALLBACK_EAS_PROJECT_ID = '52d9d50f-e763-4f74-9637-2c5779f27750';

export type PushAudienceMode = 'all' | 'single';

export type PushTargetUser = {
  id: string;
  email: string;
  full_name: string | null;
};

const getExpoProjectId = (): string | undefined => {
  const easProjectId = Constants?.expoConfig?.extra?.eas?.projectId;
  const legacyProjectId = Constants?.easConfig?.projectId;
  const manifestProjectId = (Constants as any)?.manifest2?.extra?.eas?.projectId
    || (Constants as any)?.manifest?.extra?.eas?.projectId;
  return easProjectId || legacyProjectId || manifestProjectId || FALLBACK_EAS_PROJECT_ID;
};

const getProjectCandidates = () => {
  const projectId = getExpoProjectId();
  const candidates = [projectId, FALLBACK_EAS_PROJECT_ID].filter((value): value is string => !!value);
  return Array.from(new Set(candidates));
};

const toChunks = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const normalizeToken = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
    return null;
  }
  return token;
};

export const registerDevicePushToken = async (
  Notifications: any,
  userId: string,
): Promise<{ ok: boolean; reason?: string; token?: string }> => {
  try {
    const projectCandidates = getProjectCandidates();
    let token: string | null = null;
    let lastErrorMessage = '';

    for (const projectId of projectCandidates) {
      try {
        const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
        token = normalizeToken(tokenResult?.data);
        if (token) break;
      } catch (error: any) {
        lastErrorMessage = error?.message || '';
      }
    }

    if (!token) {
      try {
        const fallbackResult = await Notifications.getExpoPushTokenAsync();
        token = normalizeToken(fallbackResult?.data);
      } catch (error: any) {
        lastErrorMessage = error?.message || lastErrorMessage;
      }
    }

    if (!token) {
      return {
        ok: false,
        reason: `Не удалось получить корректный push-токен. Проверьте, что это dev/release-сборка (не web), и что разрешения выданы.${lastErrorMessage ? ` Причина: ${lastErrorMessage}` : ''}`,
      };
    }

    const { error } = await supabase.from('device_push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: Constants.platform?.ios ? 'ios' : 'android',
        is_active: true,
      },
      {
        onConflict: 'user_id,expo_push_token',
        ignoreDuplicates: false,
      },
    );

    if (error) {
      return { ok: false, reason: error.message };
    }

    return { ok: true, token };
  } catch (error: any) {
    return { ok: false, reason: error?.message || 'Не удалось зарегистрировать push-токен.' };
  }
};

export const findProfileByEmail = async (email: string): Promise<PushTargetUser | null> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes('@')) return null;

  const { data: exactRows, error: exactError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .ilike('email', normalizedEmail)
    .limit(1);

  if (!exactError && exactRows && exactRows.length > 0) {
    return exactRows[0] as PushTargetUser;
  }

  const { data: fuzzyRows, error: fuzzyError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .ilike('email', `%${normalizedEmail}%`)
    .limit(1);

  if (!fuzzyError && fuzzyRows && fuzzyRows.length > 0) {
    return fuzzyRows[0] as PushTargetUser;
  }

  return null;
};

export const searchProfilesByEmail = async (query: string): Promise<PushTargetUser[]> => {
  const normalized = query.trim();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .ilike('email', `%${normalized}%`)
    .order('email', { ascending: true })
    .limit(20);

  if (error) return [];
  return (data || []) as PushTargetUser[];
};

const loadPushTokens = async (targetUserId?: string): Promise<string[]> => {
  let query = supabase
    .from('device_push_tokens')
    .select('expo_push_token')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(5000);

  if (targetUserId) {
    query = query.eq('user_id', targetUserId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const tokens = (data || [])
    .map((row: any) => normalizeToken(row.expo_push_token))
    .filter((token: string | null): token is string => !!token);

  return Array.from(new Set(tokens));
};

const sendChunkToExpo = async (messages: Array<{ to: string; title: string; body: string; data?: Record<string, unknown> }>) => {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Expo push API error ${response.status}: ${raw}`);
  }

  return response.json();
};

export const sendAdminPush = async (params: {
  title: string;
  body: string;
  mode: PushAudienceMode;
  targetUserId?: string;
  createdByUserId: string;
}) => {
  const title = params.title.trim();
  const body = params.body.trim();

  if (!title || !body) {
    throw new Error('Заголовок и текст push-уведомления обязательны.');
  }

  if (params.mode === 'single' && !params.targetUserId) {
    throw new Error('Не выбран получатель push-уведомления.');
  }

  const tokens = await loadPushTokens(params.mode === 'single' ? params.targetUserId : undefined);
  if (tokens.length === 0) {
    throw new Error('Нет активных push-токенов для выбранной аудитории.');
  }

  const chunks = toChunks(tokens, PUSH_CHUNK_SIZE);
  let sentCount = 0;

  for (const chunk of chunks) {
    const messages = chunk.map((token) => ({
      to: token,
      title,
      body,
      sound: 'default',
      data: {
        source: 'admin_push',
        route: '/(app)/notifications',
      },
    }));

    await sendChunkToExpo(messages as any);
    sentCount += chunk.length;
  }

  const { error: logError } = await supabase.from('admin_push_logs').insert({
    created_by: params.createdByUserId,
    title,
    body,
    target_mode: params.mode,
    target_user_id: params.mode === 'single' ? params.targetUserId : null,
    sent_count: sentCount,
  });

  if (logError) {
    // Отправка уже произошла, не блокируем успех из-за логирования.
  }

  return { sentCount };
};
