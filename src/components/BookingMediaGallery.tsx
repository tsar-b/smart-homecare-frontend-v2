import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BookingAttachment } from '../domain';
import { formatMediaBytes } from '../media';
import { colors, fonts, layout, radius, spacing } from '../theme/tokens';

interface BookingMediaGalleryProps {
  readonly attachments: readonly BookingAttachment[];
  readonly onOpen: (attachment: BookingAttachment) => void;
  readonly onDelete?: (attachment: BookingAttachment) => void;
  readonly onRetry?: (attachment: BookingAttachment) => void;
  readonly deletingId?: string | null;
  readonly completingId?: string | null;
}

function ImageThumbnail({ url }: { readonly url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.preview, styles.placeholder]}>
        <Ionicons name="image-outline" size={38} color={colors.primary} />
        <Text style={styles.size}>눌러서 사진 보기</Text>
      </View>
    );
  }
  return (
    <Image source={{ uri: url }} style={styles.preview} resizeMode="cover" onError={() => setFailed(true)} />
  );
}

export function BookingMediaGallery({
  attachments,
  onOpen,
  onDelete,
  onRetry,
  deletingId = null,
  completingId = null,
}: BookingMediaGalleryProps) {
  if (attachments.length === 0) {
    return <Text style={styles.empty}>첨부된 사진이나 동영상이 없습니다.</Text>;
  }

  return (
    <View style={styles.grid}>
      {attachments.map((attachment, index) => {
        const ready = attachment.status === 'ready';
        return (
          <View key={attachment.id} style={styles.tile}>
            <Pressable
              onPress={() => ready && onOpen(attachment)}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}번째 ${attachment.kind === 'image' ? '사진' : '동영상'} 열기`}
              accessibilityState={{ disabled: !ready }}
              style={({ pressed }) => [styles.open, pressed && styles.pressed]}
            >
              {attachment.kind === 'image' && attachment.downloadUrl ? (
                <ImageThumbnail key={attachment.downloadUrl} url={attachment.downloadUrl} />
              ) : (
                <View style={[styles.preview, styles.placeholder]}>
                  <Ionicons
                    name={attachment.kind === 'video' ? 'play-circle' : 'image-outline'}
                    size={38}
                    color={ready ? colors.primary : colors.disabled}
                  />
                </View>
              )}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {attachment.kind === 'image' ? '사진' : '동영상'}
                </Text>
              </View>
            </Pressable>
            <View style={styles.meta}>
              <Text style={styles.size}>{formatMediaBytes(attachment.sizeBytes)}</Text>
              {attachment.status === 'pending' && onRetry ? (
                <Pressable
                  onPress={() => onRetry(attachment)}
                  disabled={completingId !== null || deletingId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`${index + 1}번째 첨부 파일 처리 완료 확인`}
                  style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                >
                  {completingId === attachment.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.retryText}>처리 확인</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={[styles.status, ready ? styles.ready : styles.pending]}>
                  {ready ? '보기' : attachment.status === 'rejected' ? '업로드 거부' : attachment.status === 'deleting' ? '삭제 중' : '처리 중'}
                </Text>
              )}
            </View>
            {onDelete ? (
              <Pressable
                onPress={() => onDelete(attachment)}
                disabled={deletingId !== null || completingId !== null || attachment.status === 'deleting'}
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}번째 첨부 파일 삭제`}
                style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
              >
                {deletingId === attachment.id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                )}
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: spacing.md, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  tile: { width: '47%', flexGrow: 1, maxWidth: 270, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, backgroundColor: colors.surface },
  open: { width: '100%' },
  preview: { width: '100%', aspectRatio: 1.35, backgroundColor: colors.disabledSoft },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySubtle },
  badge: { position: 'absolute', top: spacing.xs, left: spacing.xs, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: radius.pill, backgroundColor: 'rgba(16, 24, 40, 0.76)' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white },
  meta: { minHeight: 42, padding: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  size: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  status: { fontFamily: fonts.semibold, fontSize: 11 },
  ready: { color: colors.primary },
  pending: { color: colors.warning },
  retry: { minHeight: 30, minWidth: 66, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  retryText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.primaryDark },
  delete: { position: 'absolute', top: spacing.xs, right: spacing.xs, width: layout.minTouchTarget, height: layout.minTouchTarget, marginTop: -6, marginRight: -6, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.dangerSoft },
  pressed: { opacity: 0.7 },
});
