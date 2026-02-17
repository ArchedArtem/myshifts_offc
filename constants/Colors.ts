export type ColorTheme = 'light' | 'dark';

type Palette = {
    primary: string;
    secondary: string;
    background: string;
    white: string;
    black: string;
    gray: string;
    lightGray: string;
    darkGray: string;
    border: string;
    success: string;
    error: string;
    lightError: string;
    lightPrimary: string;
    onPrimary: string;
};

const palettes: Record<ColorTheme, Palette> = {
    light: {
        primary: '#2196F3',
        secondary: '#03A9F4',
        background: '#F5F5F5',
        white: '#FFFFFF',
        black: '#000000',
        gray: '#9E9E9E',
        lightGray: '#F0F0F0',
        darkGray: '#424242',
        border: '#E0E0E0',
        success: '#4CAF50',
        error: '#F44336',
        lightError: '#FFEBEE',
        lightPrimary: '#E3F2FD',
        onPrimary: '#FFFFFF',
    },
    dark: {
        primary: '#2F7FD6',
        secondary: '#2C96E8',
        background: '#1B1F2A',
        white: '#232938',
        black: '#000000',
        gray: '#AAB2C0',
        lightGray: '#2A3040',
        darkGray: '#F5F5F5',
        border: '#363E52',
        success: '#66BB6A',
        error: '#EF5350',
        lightError: '#4A1E22',
        lightPrimary: '#24354A',
        onPrimary: '#FFFFFF',
    },
};

let activeTheme: ColorTheme = 'light';

export const setColorTheme = (theme: ColorTheme) => {
    activeTheme = theme;
};

export const getColorTheme = () => activeTheme;

const Colors = new Proxy(palettes.light as Palette, {
    get(_target, prop: string) {
        return palettes[activeTheme][prop as keyof Palette];
    },
});

export default Colors;
