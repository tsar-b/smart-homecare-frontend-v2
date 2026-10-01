/** Presentation and submit guard only; the server independently enforces membership. */
export function memberBookingState(token: string | null, profile: {
  name?: string | null; isGuest?: boolean; provider?: string | null;
} | null): 'sign_in' | 'profile_unavailable' | 'guest_unavailable' | 'complete_profile' | 'ready' {
  if (!token) return 'sign_in';
  if (!profile) return 'profile_unavailable';
  if (profile.isGuest || profile.provider === 'guest') return 'guest_unavailable';
  if (!profile.name?.trim()) return 'complete_profile';
  return 'ready';
}

export const memberBookingMessages = {
  sign_in: '예약하려면 회원 계정으로 로그인해 주세요.',
  profile_unavailable: '예약자 정보를 불러오지 못했습니다. 설정에서 프로필을 확인해 주세요.',
  guest_unavailable: '비회원 계정으로 새 예약을 접수할 수 없습니다. 회원 계정으로 로그인해 주세요.',
  complete_profile: '예약 전에 내 정보에서 이름을 등록해 주세요.',
} as const;
