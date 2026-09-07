import type { ReactNode } from 'react';

interface SectionHeadingProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly centered?: boolean;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  centered = false,
}: SectionHeadingProps) {
  return (
    <div className={`section-heading${centered ? ' section-heading--centered' : ''}`}>
      <div className="section-heading__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="section-heading__description">{description}</p> : null}
      </div>
      {action ? <div className="section-heading__action">{action}</div> : null}
    </div>
  );
}
