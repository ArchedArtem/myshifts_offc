export const Config = {
    // Supabase Configuration
    supabase: {
        url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ordhaflngrhvktewbwik.supabase.co',
        anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZGhhZmxuZ3Jodmt0ZXdid2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjE0MjgsImV4cCI6MjA4NDM5NzQyOH0.CfunZTq3JNeEjpzC3x2MpybaqLznorQkzfsHweVEtyY',
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
};