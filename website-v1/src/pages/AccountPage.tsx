import { ArrowRight, CheckCircle2, LockKeyhole, LogOut, UserRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { CatalogStatus } from '../components/CatalogStatus';
import { useSite } from '../context/SiteContext';
import { usePageMeta } from '../hooks/usePageMeta';

export function AccountPage() {
  const { authMessage, authPending, catalogSource, locale, login, logout, register, session } = useSite();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  usePageMeta(locale === 'ko' ? '내 계정' : 'Account');

  const rawNext = searchParams.get('next');
  const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/book';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = mode === 'login'
        ? await login({ email, password })
        : await register({ email, name, password, phone: phone || undefined });
      if (result.accessToken) navigate(next);
    } catch {
      // The context exposes the normalized message next to the form.
    }
  }

  if (session?.accessToken) {
    return (
      <section className="account-page">
        <div className="container account-card account-card--signed-in">
          <span className="account-card__symbol"><CheckCircle2 aria-hidden="true" /></span>
          <p className="eyebrow">SESSION ACTIVE</p>
          <h1>{locale === 'ko' ? `${session.user?.name ?? '고객'}님, 로그인되었습니다.` : `Signed in${session.user?.name ? ` as ${session.user.name}` : ''}.`}</h1>
          <p>{locale === 'ko' ? '보안을 위해 이 로컬 프리뷰의 액세스 토큰은 메모리에만 보관되며 새로고침하면 삭제됩니다.' : 'For this local preview, the access token stays in memory and is removed by a refresh.'}</p>
          <div className="account-card__actions">
            <Link className="button button--large" to="/book">{locale === 'ko' ? '예약 계속하기' : 'Continue to booking'} <ArrowRight size={18} aria-hidden="true" /></Link>
            <button className="button button--large button--secondary" type="button" onClick={logout}><LogOut size={18} aria-hidden="true" />{locale === 'ko' ? '로그아웃' : 'Sign out'}</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="account-page">
      <div className="container account-layout">
        <div className="account-layout__intro">
          <span className="account-layout__icon"><LockKeyhole aria-hidden="true" /></span>
          <p className="eyebrow">PRIVATE BY DEFAULT</p>
          <h1>{locale === 'ko' ? '예약과 자료를 내 계정에 연결합니다.' : 'Connect bookings and private media to your account.'}</h1>
          <p>{locale === 'ko' ? '현재 V2 백엔드는 실제 예약 제출과 사진·영상 업로드 전에 인증을 요구합니다. 게스트 예약으로 우회하지 않습니다.' : 'The V2 backend requires authentication before a real booking or private media upload. This site does not bypass that boundary with guest checkout.'}</p>
          <div className="account-layout__status"><CatalogStatus /><span>{catalogSource === 'live' ? (locale === 'ko' ? '로그인 API 사용 가능' : 'Login API ready') : (locale === 'ko' ? '백엔드 연결 후 로그인 가능' : 'Connect the backend to sign in')}</span></div>
        </div>
        <div className="auth-panel">
          <div className="auth-tabs" role="tablist" aria-label={locale === 'ko' ? '계정 방식' : 'Account action'}>
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => setMode('login')}>{locale === 'ko' ? '로그인' : 'Sign in'}</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => setMode('register')}>{locale === 'ko' ? '계정 만들기' : 'Create account'}</button>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <>
                <label><span>{locale === 'ko' ? '이름' : 'Name'}</span><input required maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label><span>{locale === 'ko' ? '전화번호 (선택)' : 'Phone (optional)'}</span><input maxLength={50} autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              </>
            ) : null}
            <label><span>{locale === 'ko' ? '이메일' : 'Email'}</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label><span>{locale === 'ko' ? '비밀번호' : 'Password'}</span><input required type="password" minLength={mode === 'register' ? 8 : 1} maxLength={200} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {authMessage ? <p className="form-message" role="status">{authMessage}</p> : null}
            <button className="button button--large button--full" type="submit" disabled={authPending || catalogSource !== 'live'}>
              <UserRound size={18} aria-hidden="true" />
              {authPending ? (locale === 'ko' ? '연결 중…' : 'Connecting…') : mode === 'login' ? (locale === 'ko' ? '로그인' : 'Sign in') : (locale === 'ko' ? '계정 만들기' : 'Create account')}
            </button>
            <p className="auth-form__note">{locale === 'ko' ? '소셜 로그인 버튼은 브라우저 공급자 설정과 검증이 끝난 뒤 추가합니다.' : 'Social sign-in appears only after browser provider setup and verification are complete.'}</p>
          </form>
        </div>
      </div>
    </section>
  );
}
