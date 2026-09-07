import { describe, expect, it, vi } from 'vitest';

import { mediaKind, validateBookingMedia } from './bookingMedia';
import type { SelectedBookingMedia } from './types';

function file(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

describe('booking media validation', () => {
  it('recognizes only the backend-supported media families', () => {
    expect(mediaKind(file('unit.webp', 'image/webp', 50))).toBe('image');
    expect(mediaKind(file('noise.mov', 'video/quicktime', 50))).toBe('video');
    expect(mediaKind(file('notes.pdf', 'application/pdf', 50))).toBeNull();
  });

  it('keeps accepted files and reports unsupported or oversized files', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-media-id' });
    const result = validateBookingMedia([], [
      file('unit.jpg', 'image/jpeg', 2_000_000),
      file('huge.png', 'image/png', 10_000_001),
      file('notes.pdf', 'application/pdf', 100),
    ]);

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]).toMatchObject({ id: 'test-media-id', kind: 'image' });
    expect(result.errors).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('enforces the two-video and six-file booking limits', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'new-media-id' });
    const existing: SelectedBookingMedia[] = [
      { id: 'v1', kind: 'video', file: file('one.mp4', 'video/mp4', 100) },
      { id: 'v2', kind: 'video', file: file('two.mp4', 'video/mp4', 100) },
      { id: 'i1', kind: 'image', file: file('one.jpg', 'image/jpeg', 100) },
      { id: 'i2', kind: 'image', file: file('two.jpg', 'image/jpeg', 100) },
      { id: 'i3', kind: 'image', file: file('three.jpg', 'image/jpeg', 100) },
    ];
    const result = validateBookingMedia(existing, [
      file('third-video.mp4', 'video/mp4', 100),
      file('last-image.jpg', 'image/jpeg', 100),
      file('overflow-image.jpg', 'image/jpeg', 100),
    ]);

    expect(result.accepted).toHaveLength(6);
    expect(result.accepted.at(-1)?.file.name).toBe('last-image.jpg');
    expect(result.errors.some((message) => message.includes('동영상은 최대 2개'))).toBe(true);
    expect(result.errors.some((message) => message.includes('최대 6개'))).toBe(true);
    vi.unstubAllGlobals();
  });
});
