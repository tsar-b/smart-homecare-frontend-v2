import { useEffect } from 'react';

export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = `${title} | Smart HomeCare`;
    if (!description) return;
    const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previous = tag?.content;
    if (tag) tag.content = description;
    return () => {
      if (tag && previous) tag.content = previous;
    };
  }, [description, title]);
}
