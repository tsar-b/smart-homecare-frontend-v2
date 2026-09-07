import { Globe2, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { copy, tx } from '../content';
import { useSite } from '../context/SiteContext';
import { BrandMark } from './BrandMark';
import { CatalogStatus } from './CatalogStatus';

function navigation(locale: 'ko' | 'en') {
  return [
    { to: '/services', label: tx(copy.nav.services, locale) },
    { to: '/#process', label: tx(copy.nav.process, locale) },
    { to: '/about', label: tx(copy.nav.about, locale) },
    { to: '/support', label: tx(copy.nav.support, locale) },
  ];
}

export function Layout() {
  const { locale, setLocale, session } = useSite();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname, location.hash]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        {locale === 'ko' ? '본문으로 건너뛰기' : 'Skip to content'}
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <BrandMark />
          <nav className="desktop-nav" aria-label={locale === 'ko' ? '주요 메뉴' : 'Primary navigation'}>
            {navigation(locale).map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="site-header__actions">
            <button
              className="locale-switch"
              type="button"
              onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
              aria-label={locale === 'ko' ? 'Switch to English' : '한국어로 전환'}
            >
              <Globe2 size={17} aria-hidden="true" />
              {locale === 'ko' ? 'EN' : 'KO'}
            </button>
            <Link className="account-link" to="/account">
              {session?.user?.name ?? tx(copy.nav.account, locale)}
            </Link>
            <Link className="button button--small" to="/book">
              {tx(copy.nav.book, locale)}
            </Link>
            <button
              className="menu-toggle"
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={menuOpen ? (locale === 'ko' ? '메뉴 닫기' : 'Close menu') : (locale === 'ko' ? '메뉴 열기' : 'Open menu')}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
        <nav
          id="mobile-navigation"
          className={`mobile-nav${menuOpen ? ' mobile-nav--open' : ''}`}
          aria-label={locale === 'ko' ? '모바일 메뉴' : 'Mobile navigation'}
        >
          <div className="container mobile-nav__inner">
            {navigation(locale).map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/account">{tx(copy.nav.account, locale)}</NavLink>
            <NavLink to="/book">{tx(copy.nav.book, locale)}</NavLink>
          </div>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__grid">
          <div className="site-footer__brand">
            <BrandMark inverse />
            <p>
              {locale === 'ko'
                ? '집 관리의 요청부터 기록까지, 한 흐름으로 연결합니다.'
                : 'One connected path from a home-care request to its record.'}
            </p>
            <CatalogStatus />
          </div>
          <div className="site-footer__column">
            <h2>{locale === 'ko' ? '서비스' : 'Services'}</h2>
            <Link to="/services">{tx(copy.nav.services, locale)}</Link>
            <Link to="/book">{tx(copy.nav.book, locale)}</Link>
            <Link to="/account">{tx(copy.nav.account, locale)}</Link>
          </div>
          <div className="site-footer__column">
            <h2>{locale === 'ko' ? '회사' : 'Company'}</h2>
            <Link to="/about">{tx(copy.nav.about, locale)}</Link>
            <Link to="/support">{tx(copy.nav.support, locale)}</Link>
          </div>
          <div className="site-footer__contact">
            <p className="eyebrow">CONTACT</p>
            <p>
              {locale === 'ko'
                ? '운영 연락처와 사업자 정보는 검증된 내용으로 배포 전에 연결합니다.'
                : 'Operational contacts and business details are connected with verified information before launch.'}
            </p>
          </div>
        </div>
        <div className="container site-footer__bottom">
          <span>© {new Date().getFullYear()} Smart HomeCare</span>
          <span>{locale === 'ko' ? '웹사이트 v1 프리뷰' : 'Website v1 preview'}</span>
        </div>
      </footer>
    </div>
  );
}
