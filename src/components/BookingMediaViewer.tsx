import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
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
  const player = useVideoPlayer(url);
  return <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />;
}

export function BookingMediaViewer({
  visible,
  attachment,
  url,
  loading = false,
  error = null,
  onRequestClose,
}: BookingMediaViewerProps) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>{attachment?.kind === 'video' ? '동영상' : '사진'}</Text>
          <Pressable
            onPress={onRequestClose}
            accessibilityRole="button"
            accessibilityLabel="첨부 파일 닫기"
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={27} color={colors.white} />
          </Pressable>
        </View>
        <View style={styles.stage}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={styles.message}>안전한 보기 주소를 불러오고 있어요.</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={42} color={colors.white} />
              <Text style={styles.message}>{error}</Text>
            </View>
          ) : attachment && url ? (
            attachment.kind === 'video' ? (
              <VideoContent url={url} />
            ) : (
              <Image source={{ uri: url }} style={styles.media} resizeMode="contain" />
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
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  message: { marginTop: spacing.md, textAlign: 'center', fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.white },
  pressed: { opacity: 0.72 },
});
