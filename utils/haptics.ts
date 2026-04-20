import * as ExpoHaptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTICS_KEY = 'myshifts_haptics_settings_v1';

let isHapticsEnabled = true;

AsyncStorage.getItem(HAPTICS_KEY).then((val) => {
    if (val !== null) isHapticsEnabled = JSON.parse(val);
});

export const setHapticsEnabled = async (enabled: boolean) => {
    isHapticsEnabled = enabled;
    await AsyncStorage.setItem(HAPTICS_KEY, JSON.stringify(enabled));
};

export const getHapticsEnabled = () => isHapticsEnabled;

export const impactAsync = async (style = ExpoHaptics.ImpactFeedbackStyle.Light) => {
    if (isHapticsEnabled) await ExpoHaptics.impactAsync(style);
};

export const notificationAsync = async (type = ExpoHaptics.NotificationFeedbackType.Success) => {
    if (isHapticsEnabled) await ExpoHaptics.notificationAsync(type);
};

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;