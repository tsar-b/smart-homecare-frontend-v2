import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { copy, services, tx } from '../content';
import type { Locale } from '../types';
import { ServiceGlyph } from './ServiceGlyph';

interface ServiceGridProps {
  readonly locale: Locale;
  readonly compact?: boolean;
}

export function ServiceGrid({ locale, compact = false }: ServiceGridProps) {
  return (
    <div className={`service-grid${compact ? ' service-grid--compact' : ''}`}>
      {services.map((service, index) => (
        <article className="service-card" key={service.slug} style={{ '--service-accent': service.accent } as React.CSSProperties}>
          <div className="service-card__topline">
            <span className="service-card__index">0{index + 1}</span>
            <span className="service-card__icon">
              <ServiceGlyph name={service.icon} />
            </span>
          </div>
          <p className="service-card__eyebrow">{tx(service.eyebrow, locale)}</p>
          <h3>{tx(service.name, locale)}</h3>
          <p>{tx(service.summary, locale)}</p>
          <Link className="text-link" to={`/services/${service.slug}`}>
            {tx(copy.common.learnMore, locale)}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </article>
      ))}
    </div>
  );
}
