import { t, useLocale } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import type { BookingAttachment } from '../domain';
import { colors, fonts, layout, radius, spacing } from '../theme/tokens';

interface BookingMediaViewerProps {
  readonly visible: boolean;
  readonly attachment: BookingAttachment | null;
  readonly url: string | null;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly onRequestClose: () => void;
}

function VideoContent({ url }: { readonly url: string }) {
  useLocale();
  const player = useVideoPlayer(url);
  const [status, setStatus] = useState(player.status);
  useEffect(() => {
    const subscription = player.addListener('statusChange', (event) => setStatus(event.status));
    setStatus(player.status);
    return () => subscription.remove();
  }, [player]);
  if (status === 'error') return <MediaLoadError />;
  return (
    <View style={styles.media}>
      <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />
      {status === 'loading' || status === 'idle' ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

function MediaLoadError() {
  useLocale();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={42} color={colors.white} />
      <Text style={styles.message}>
        {t("파일을 불러오지 못했습니다. 네트워크를 확인한 뒤 닫고 다시 열어 주세요.")}</Text>
    </View>
  );
}

function ImageContent({ url }: { readonly url: string }) {
  useLocale();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  if (failed) return <MediaLoadError />;
  return (
    <View style={styles.media}>
      <Image
        source={{ uri: url }}
        style={styles.media}
        resizeMode="contain"
        onError={() => setFailed(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

export function BookingMediaViewer({
  visible,
  attachment,
  url,
  loading = false,
  error = null,
  onRequestClose,
}: BookingMediaViewerProps) {
  useLocale();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>{attachment?.kind === 'video' ? t('동영상') : t('사진')}</Text>
          <Pressable
            onPress={onRequestClose}
            accessibilityRole="button"
            accessibilityLabel={t("첨부 파일 닫기")}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={27} color={colors.white} />
          </Pressable>
        </View>
        <View style={styles.stage}>
          {!visible ? null : loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={styles.message}>{t("안전한 보기 주소를 불러오고 있어요.")}</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={42} color={colors.white} />
              <Text style={styles.message}>{t(error)}</Text>
            </View>
          ) : attachment && url ? (
            attachment.kind === 'video' ? (
              <VideoContent key={url} url={url} />
            ) : (
              <ImageContent key={url} url={url} />
            )
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050A14' },
  header: { minHeight: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.white },
  close: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '100%' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  message: { marginTop: spacing.md, textAlign: 'center', fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.white },
  pressed: { opacity: 0.72 },
});
