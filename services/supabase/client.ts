import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

export const supabaseUrl = 'https://ordhaflngrhvktewbwik.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZGhhZmxuZ3Jodmt0ZXdid2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjE0MjgsImV4cCI6MjA4NDM5NzQyOH0.CfunZTq3JNeEjpzC3x2MpybaqLznorQkzfsHweVEtyY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});