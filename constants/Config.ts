if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Не найдены переменные окружения Supabase в файле .env');
}

export const Config = {
    supabase: {
        url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
        anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },

    // App Configuration
    app: {
        name: 'ShiftTracker',
        version: '1.0.0',
        defaultCurrency: '₽',
        defaultHourlyRate: 500,
        workDayStart: '09:00',
        workDayEnd: '18:00',
        breakDuration: 60, // minutes
    },

    // Features
    features: {
        enableNotifications: true,
        enableBiometricAuth: false,
        enableOfflineMode: true,
        enableDataExport: true,
    },

    // UI Configuration
    ui: {
        defaultTheme: 'light',
        animationsEnabled: true,
        splashScreenDuration: 2000, // ms
    },

    // Storage
    storage: {
        shiftsCacheKey: '@shifts_cache',
        settingsKey: '@app_settings',
        lastSyncKey: '@last_sync',
    },

    // API
    api: {
        timeout: 10000, // ms
        maxRetries: 3,
        cacheDuration: 5 * 60 * 1000, // 5 minutes
    },

    // Validation
    validation: {
        minHourlyRate: 100,
        maxHourlyRate: 10000,
        maxShiftDuration: 24, // hours
        maxExtraPayment: 100000,
    },
} as const;