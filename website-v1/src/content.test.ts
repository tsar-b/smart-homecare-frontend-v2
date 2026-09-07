import { describe, expect, it } from 'vitest';

import { previewInitialization, services } from './content';

describe('website content model', () => {
  it('keeps service routes unique and fully bilingual', () => {
    expect(new Set(services.map((service) => service.slug)).size).toBe(services.length);
    for (const service of services) {
      expect(service.name.ko).not.toBe('');
      expect(service.name.en).not.toBe('');
      expect(service.description.ko).not.toBe('');
      expect(service.description.en).not.toBe('');
    }
  });

  it('uses non-submittable IDs for every preview catalog entity', () => {
    const ids = [
      ...previewInitialization.catalog.categories.map((item) => item.id),
      ...previewInitialization.catalog.serviceTypes.map((item) => item.id),
      ...previewInitialization.catalog.subtypes.map((item) => item.id),
      ...previewInitialization.catalog.pricingTiers.map((item) => item.id),
    ];
    expect(ids.every((id) => id.startsWith('preview-'))).toBe(true);
  });
});
