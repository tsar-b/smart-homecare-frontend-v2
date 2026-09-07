import { AirVent, Refrigerator, Tv2, WashingMachine } from 'lucide-react';

import type { ServiceIconName } from '../types';

interface ServiceGlyphProps {
  readonly name: ServiceIconName;
  readonly size?: number;
}

export function ServiceGlyph({ name, size = 28 }: ServiceGlyphProps) {
  const props = { size, strokeWidth: 1.8, 'aria-hidden': true } as const;
  if (name === 'aircon') return <AirVent {...props} />;
  if (name === 'washer') return <WashingMachine {...props} />;
  if (name === 'refrigerator') return <Refrigerator {...props} />;
  return <Tv2 {...props} />;
}
