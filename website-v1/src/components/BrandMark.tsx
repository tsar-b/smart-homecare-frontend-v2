import { Link } from 'react-router-dom';

interface BrandMarkProps {
  readonly inverse?: boolean;
}

export function BrandMark({ inverse = false }: BrandMarkProps) {
  return (
    <Link className={`brand-mark${inverse ? ' brand-mark--inverse' : ''}`} to="/" aria-label="Smart HomeCare home">
      <span className="brand-mark__letters" aria-hidden="true">SHC</span>
      <span className="brand-mark__rule" aria-hidden="true" />
      <span className="brand-mark__name" aria-hidden="true">
        <span>SMART</span>
        <span>HOMECARE</span>
      </span>
    </Link>
  );
}
