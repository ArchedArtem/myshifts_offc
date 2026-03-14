import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { Platform } from 'react-native';
import {
  FlexWidget,
  TextWidget,
  registerWidgetTaskHandler,
  requestWidgetUpdate,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import { supabase } from '@/services/supabase/client';

export const NEXT_SHIFT_WIDGET_NAME = 'NextShiftWidget';
const NEXT_SHIFT_WIDGET_STORAGE_KEY = '@myshifts_next_shift_widget_v1';

type NextShiftWidgetState = {
  headline: string;
  value: string;
  updatedAt: string;
};

const DEFAULT_WIDGET_STATE: NextShiftWidgetState = {
  headline: 'Ближайшая смена',
  value: 'Нет ближайшей смены',
  updatedAt: '—',
};

let widgetTaskRegistered = false;

const normalizeTime = (time: string) => time?.split(':').slice(0, 2).join(':') || '--:--';

function buildWidget(state: NextShiftWidgetState): WidgetRepresentation {
  const hasShift = state.value !== 'Нет ближайшей смены' && state.value !== 'Войдите в аккаунт';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        padding: 14,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#1E293B',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <TextWidget text="MYSHIFTS" style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700' }} />
        <TextWidget
          text={hasShift ? '● Запланировано' : '● Нет смен'}
          style={{ color: hasShift ? '#86EFAC' : '#FDBA74', fontSize: 11, fontWeight: '700' }}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          marginTop: 10,
          backgroundColor: '#111827',
          borderRadius: 16,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        <TextWidget text={state.headline} style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500' }} maxLines={1} />
        <TextWidget text={state.value} style={{ marginTop: 6, color: '#F8FAFC', fontSize: 19, fontWeight: '700' }} maxLines={2} />
      </FlexWidget>

      <TextWidget
        text={`Обновлено ${state.updatedAt}`}
        style={{ marginTop: 10, color: '#64748B', fontSize: 11 }}
        truncate="END"
        maxLines={1}
      />
    </FlexWidget>
  );
}

async function getStoredWidgetState(): Promise<NextShiftWidgetState> {
  try {
    const raw = await AsyncStorage.getItem(NEXT_SHIFT_WIDGET_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET_STATE;

    const parsed = JSON.parse(raw) as NextShiftWidgetState;
    if (!parsed?.value) return DEFAULT_WIDGET_STATE;

    return {
      headline: parsed.headline || DEFAULT_WIDGET_STATE.headline,
      value: parsed.value || DEFAULT_WIDGET_STATE.value,
      updatedAt: parsed.updatedAt || DEFAULT_WIDGET_STATE.updatedAt,
    };
  } catch {
    return DEFAULT_WIDGET_STATE;
  }
}

async function saveWidgetState(state: NextShiftWidgetState): Promise<void> {
  await AsyncStorage.setItem(NEXT_SHIFT_WIDGET_STORAGE_KEY, JSON.stringify(state));
}

async function refreshWidgetFromStorage(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await requestWidgetUpdate({
    widgetName: NEXT_SHIFT_WIDGET_NAME,
    renderWidget: async () => buildWidget(await getStoredWidgetState()),
  });
}

export function registerNextShiftWidgetTask(): void {
  if (Platform.OS !== 'android' || widgetTaskRegistered) return;

  registerWidgetTaskHandler(async ({ widgetInfo, renderWidget }) => {
    if (widgetInfo.widgetName !== NEXT_SHIFT_WIDGET_NAME) return;

    const state = await getStoredWidgetState();
    renderWidget(buildWidget(state));
  });

  widgetTaskRegistered = true;
}

export async function syncNextShiftWidgetForUser(userId: string): Promise<void> {
  if (Platform.OS !== 'android' || !userId) return;

  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('shifts')
    .select('date, start_time, end_time')
    .eq('user_id', userId)
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(1);

  if (error) {
    console.warn('Widget sync error:', error.message);
    return;
  }

  const nearest = (data || [])[0] as { date: string; start_time: string; end_time: string } | undefined;

  const state: NextShiftWidgetState = nearest
    ? {
        headline: 'Ближайшая смена',
        value: `${format(new Date(`${nearest.date}T00:00:00`), 'dd.MM')} с ${normalizeTime(nearest.start_time)} до ${normalizeTime(nearest.end_time)}`,
        updatedAt: format(new Date(), 'dd.MM HH:mm'),
      }
    : {
        headline: 'Ближайшая смена',
        value: 'Нет ближайшей смены',
        updatedAt: format(new Date(), 'dd.MM HH:mm'),
      };

  await saveWidgetState(state);
  await refreshWidgetFromStorage();
}

export async function clearNextShiftWidgetState(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await saveWidgetState({
    headline: 'Ближайшая смена',
    value: 'Войдите в аккаунт',
    updatedAt: format(new Date(), 'dd.MM HH:mm'),
  });

  await refreshWidgetFromStorage();
}
