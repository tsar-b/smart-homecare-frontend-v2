import { Platform } from 'react-native';

export const colors = {
  background: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',
  primary: '#175CD3',
  primaryDark: '#0B3B8F',
  primarySoft: '#EAF2FF',
  primarySubtle: '#F2F6FF',
  text: '#101828',
  textSecondary: '#475467',
  textMuted: '#667085',
  border: '#D0D5DD',
  borderSoft: '#EAECF0',
  success: '#067647',
  successSoft: '#ECFDF3',
  warning: '#B54708',
  warningSoft: '#FFFAEB',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  disabled: '#98A2B3',
  disabledSoft: '#F2F4F7',
  white: '#FFFFFF',
  overlay: 'rgba(16, 24, 40, 0.48)',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
} as const;

export const shadow = Platform.select({
  ios: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: {
    elevation: 2,
  },
  default: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
});

export const layout = {
  maxContentWidth: 640,
  horizontalPadding: spacing.lg,
  minTouchTarget: 44,
} as const;
