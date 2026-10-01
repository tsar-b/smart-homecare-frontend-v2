import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getLocale, setLocale, t, useLocale } from './index';
import { colors, fonts, spacing } from '../theme/tokens';
const KEY = 'shc.locale.v1';
let initialized = false;
let revision = 0;
let saveQueue = Promise.resolve();

export function LanguageSwitch() {
  const locale = useLocale();
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    const before = revision;
    void AsyncStorage.getItem(KEY).then(saved => {
      if (before === revision && (saved === 'ko' || saved === 'en')) setLocale(saved);
    }).catch(() => undefined);
  }, []);
  const toggle = () => {
    const next = getLocale() === 'ko' ? 'en' : 'ko';
    revision += 1;
    setLocale(next);
    setSaveError(false);
    saveQueue = saveQueue.catch(() => undefined).then(() => AsyncStorage.setItem(KEY, next));
    void saveQueue.catch(() => setSaveError(true));
  };
  return <View style={styles.row}>
    {saveError ? <Text accessibilityRole="alert" style={styles.note}>{t('언어 설정을 저장하지 못했습니다.')}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={locale === 'ko' ? 'Switch to English' : '한국어로 전환'}
      onPress={toggle} style={styles.button}>
      <Text style={styles.label}>{locale === 'ko' ? 'EN / 한국어' : '한국어 / EN'}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing.md },
  button: { minHeight: 44, minWidth: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  label: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 },
  note: { flex: 1, color: colors.textMuted, fontSize: 12 }
});
