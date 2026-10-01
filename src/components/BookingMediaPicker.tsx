import { t, useLocale } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BookingAttachment, LocalBookingMedia } from '../domain';
import {
  BOOKING_MEDIA_PILOT_UPLOADS_ENABLED,
  MAX_BOOKING_ATTACHMENTS,
  MediaSelectionError,
  formatMediaBytes,
  formatMediaDuration,
  preparePickedMedia,
  validateCombinedMedia,
} from '../media';
import { colors, fonts, layout, radius, spacing } from '../theme/tokens';
import { Button } from './Button';

export type LocalMediaUploadStatus = 'selected' | 'uploading' | 'uploaded' | 'failed';

export interface LocalMediaUploadPresentation {
  readonly status: LocalMediaUploadStatus;
  readonly progress?: number;
  readonly error?: string | null;
  /** Server row retained so a lost completion response can be retried safely. */
  readonly attachmentId?: string;
  /** Storage accepted the bytes; retry only the idempotent completion call. */
  readonly storageUploaded?: boolean;
  /** False when the file must be removed and selected again instead. */
  readonly retryable?: boolean;
}

interface BookingMediaPickerProps {
  readonly value: readonly LocalBookingMedia[];
  readonly onChange: (media: readonly LocalBookingMedia[]) => void;
  readonly disabled?: boolean;
  readonly preview?: boolean;
  readonly existingAttachments?: readonly BookingAttachment[];
  readonly uploadState?: Readonly<Record<string, LocalMediaUploadPresentation>>;
  readonly onError?: (message: string) => void;
}

export function BookingMediaPicker({
  value,
  onChange,
  disabled = false,
  preview = false,
  existingAttachments = [],
  uploadState = {},
  onError,
}: BookingMediaPickerProps) {
  useLocale();
  const [preparing, setPreparing] = useState(false);
  const selectingRef = useRef(false);
  const mountedRef = useRef(true);
  const sourceSelectionsRef = useRef(new Map<string, string>());
  const latestRef = useRef({ value, existingAttachments, disabled, preview, onChange, onError });
  latestRef.current = { value, existingAttachments, disabled, preview, onChange, onError };
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const totalCount = existingAttachments.length + value.length;
  const atLimit = totalCount >= MAX_BOOKING_ATTACHMENTS;

  const showError = (message: string) => {
    if (!mountedRef.current) return;
    const handler = latestRef.current.onError;
    handler?.(message);
    if (!handler) Alert.alert(t('첨부 파일을 추가할 수 없습니다'), message);
  };

  const chooseMedia = async () => {
    if (disabled || preview || selectingRef.current || atLimit) return;
    selectingRef.current = true;
    setPreparing(true);
    try {
      // Expo's system photo picker grants access to selected assets itself.
      // A denied/limited broad-library permission must not block that picker.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: BOOKING_MEDIA_PILOT_UPLOADS_ENABLED ? ['images', 'videos'] : ['images'],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, MAX_BOOKING_ATTACHMENTS - totalCount),
        orderedSelection: true,
        allowsEditing: false,
        exif: false,
        quality: 1,
      });
      if (result.canceled || !mountedRef.current) return;

      const additions: LocalBookingMedia[] = [];
      const newSources = new Map<string, string>();
      const selectedIds = new Set(latestRef.current.value.map((item) => item.clientAttachmentId));
      for (const asset of result.assets) {
        if (!mountedRef.current || latestRef.current.disabled || latestRef.current.preview) return;
        const source = asset.assetId ? `asset:${asset.assetId}` : `uri:${asset.uri}`;
        const priorSelection = sourceSelectionsRef.current.get(source);
        if (
          newSources.has(source) ||
          (priorSelection && selectedIds.has(priorSelection)) ||
          latestRef.current.value.some((item) => item.uri === asset.uri)
        ) continue;
        const prepared = await preparePickedMedia(asset);
        additions.push(prepared);
        newSources.set(source, prepared.clientAttachmentId);
      }
      if (!mountedRef.current || latestRef.current.disabled || latestRef.current.preview) return;
      const current = latestRef.current;
      validateCombinedMedia([...current.existingAttachments, ...current.value], additions);
      if (additions.length > 0) {
        current.onChange([...current.value, ...additions]);
        for (const [source, id] of newSources) sourceSelectionsRef.current.set(source, id);
      }
    } catch (error) {
      showError(error instanceof MediaSelectionError ? error.message : t('선택한 파일을 준비하지 못했습니다. 다시 선택해 주세요.'));
    } finally {
      selectingRef.current = false;
      if (mountedRef.current) setPreparing(false);
    }
  };

  const remove = (clientAttachmentId: string) => {
    if (disabled || preparing) return;
    onChange(value.filter((item) => item.clientAttachmentId !== clientAttachmentId));
  };

  return (
    <View>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>
            {BOOKING_MEDIA_PILOT_UPLOADS_ENABLED ? t('현장 사진 및 동영상') : t('현장 사진')}
          </Text>
          <Text style={styles.description}>
            {t("고장 부위나 설치 환경을 보여 주면 상담과 방문 준비에 도움이 됩니다.")}</Text>
        </View>
        <Text style={styles.counter}>{totalCount}/{MAX_BOOKING_ATTACHMENTS}</Text>
      </View>

      {value.length > 0 ? (
        <View style={styles.grid}>
          {value.map((media, index) => {
            const presentation = uploadState[media.clientAttachmentId];
            const progress = Math.round((presentation?.progress ?? 0) * 100);
            const locked = disabled || presentation?.status === 'uploading' || presentation?.status === 'uploaded';
            return (
              <View key={media.clientAttachmentId} style={styles.tile}>
                {media.kind === 'image' ? (
                  <Image source={{ uri: media.uri }} style={styles.preview} resizeMode="cover" />
                ) : (
                  <View style={[styles.preview, styles.videoPreview]}>
                    <Ionicons name="videocam" size={30} color={colors.primary} />
                    <Text style={styles.videoDuration}>
                      {formatMediaDuration(media.durationMs) ?? '동영상'}
                    </Text>
                  </View>
                )}
                <View style={styles.kindBadge}>
                  <Ionicons
                    name={media.kind === 'image' ? 'image-outline' : 'videocam-outline'}
                    size={13}
                    color={colors.white}
                  />
                  <Text style={styles.kindText}>{media.kind === 'image' ? t('사진') : t('동영상')}</Text>
                </View>
                {!locked ? (
                  <Pressable
                    onPress={() => remove(media.clientAttachmentId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${index + 1}번째 첨부 파일 제거`}
                    style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={18} color={colors.white} />
                  </Pressable>
                ) : null}
                <View style={styles.tileFooter}>
                  <Text style={styles.sizeText}>{formatMediaBytes(media.sizeBytes)}</Text>
                  {presentation?.status === 'uploading' ? (
                    <View
                      style={styles.progressTrack}
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: 100, now: progress }}
                    >
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                  ) : null}
                  {presentation?.status === 'uploaded' ? (
                    <Text style={styles.successText}>{t("업로드 완료")}</Text>
                  ) : presentation?.status === 'failed' ? (
                    <Text style={styles.errorText} numberOfLines={2}>{presentation.error || '업로드 실패'}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <Button
        label={
          preview
            ? t('디자인 미리보기 · 첨부 불가')
            : atLimit
              ? t('첨부 가능 개수를 모두 사용했습니다')
              : BOOKING_MEDIA_PILOT_UPLOADS_ENABLED
                ? t('사진 또는 동영상 추가')
                : t('사진 추가')
        }
        icon="images-outline"
        variant="secondary"
        onPress={() => void chooseMedia()}
        loading={preparing}
        disabled={disabled || preview || atLimit}
        accessibilityHint={t("기기의 사진 보관함에서 예약에 첨부할 파일을 선택합니다")}
      />
      <Text style={styles.limitText}>
        {BOOKING_MEDIA_PILOT_UPLOADS_ENABLED
          ? t('최대 6개 · 동영상 2개 · 사진당 10MB · 동영상당 60초/45MB · 전체 100MB')
          : t('최대 6개 · 사진당 약 6.3MB')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  headingCopy: { flex: 1, paddingRight: spacing.md },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  description: { marginTop: spacing.xxs, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  counter: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tile: { width: '47%', flexGrow: 1, maxWidth: 260, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface },
  preview: { width: '100%', aspectRatio: 1.35, backgroundColor: colors.disabledSoft },
  videoPreview: { alignItems: 'center', justifyContent: 'center', gap: spacing.xxs, backgroundColor: colors.primarySubtle },
  videoDuration: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primaryDark },
  kindBadge: { position: 'absolute', top: spacing.xs, left: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: radius.pill, backgroundColor: 'rgba(16, 24, 40, 0.76)' },
  kindText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white },
  remove: { position: 'absolute', top: spacing.xs, right: spacing.xs, width: layout.minTouchTarget, height: layout.minTouchTarget, marginTop: -6, marginRight: -6, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 24, 40, 0.78)' },
  tileFooter: { minHeight: 42, padding: spacing.xs },
  sizeText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  progressTrack: { height: 5, marginTop: spacing.xs, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.disabledSoft },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  successText: { marginTop: spacing.xxs, fontFamily: fonts.semibold, fontSize: 11, color: colors.success },
  errorText: { marginTop: spacing.xxs, fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, color: colors.danger },
  limitText: { marginTop: spacing.xs, textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  pressed: { opacity: 0.72 },
});
