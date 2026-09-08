import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AdminBottomNav,
  AppHeader,
  AppScreen,
  Button,
  Card,
  PageIntro,
  StateView,
} from '../../components';
import { useAuth } from '../../context/AuthContext';
import type { UserProfile } from '../../domain';
import { colors, fonts, layout, radius, spacing } from '../../theme/tokens';
import { LatestRequest } from '../../utils/latestRequest';

function valueOrFallback(value: string | null | undefined) {
  return value?.trim() || '미등록';
}

export default function AdminUsers() {
  const { api } = useAuth();
  const [users, setUsers] = useState<readonly UserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const usersRequest = useRef(new LatestRequest());

  const fetchUsers = useCallback(async () => {
    const request = usersRequest.current.start();
    if (!api) {
      setError('V2 API가 아직 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const firstPage = await api.admin.list('users', {
        page: 1,
        pageSize: 100,
        sort: 'created_at',
        direction: 'desc',
      }, { signal: request.signal });
      if (!request.isCurrent()) return;
      const allUsers = [...firstPage.data];
      const pageCount = Math.ceil(firstPage.total / firstPage.pageSize);

      for (let page = 2; page <= pageCount; page += 1) {
        const nextPage = await api.admin.list('users', {
          page,
          pageSize: firstPage.pageSize,
          sort: 'created_at',
          direction: 'desc',
        }, { signal: request.signal });
        if (!request.isCurrent()) return;
        allUsers.push(...nextPage.data);
      }

      setUsers(allUsers);
    } catch (requestError) {
      if (!request.isCurrent()) return;
      console.error('fetchUsers error', requestError);
      setError('사용자 목록을 불러오지 못했습니다.');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void fetchUsers();
      return () => usersRequest.current.cancel();
    }, [fetchUsers]),
  );

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return users;

    return users.filter(user =>
      [user.name, user.phone, user.email]
        .some(value => value?.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [query, users]);

  const adminCount = users.filter(user => user.isAdmin).length;
  const customerCount = users.length - adminCount;

  const deleteUser = (user: UserProfile) => {
    Alert.alert(
      '사용자 삭제',
      `${user.name || '이 사용자'}의 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            if (!api) return;
            setBusyUserId(user.id);
            try {
              await api.admin.remove('users', user.id);
              await fetchUsers();
            } catch (requestError) {
              console.error('deleteUser error', requestError);
              Alert.alert('오류', '사용자를 삭제하지 못했습니다.');
            } finally {
              setBusyUserId(null);
            }
          },
        },
      ],
    );
  };

  const headerAction = (
    <Pressable
      onPress={() => void fetchUsers()}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="사용자 목록 새로고침"
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
    >
      <Ionicons name="refresh" size={21} color={loading ? colors.disabled : colors.primary} />
    </Pressable>
  );

  return (
    <AppScreen
      padded={false}
      contentStyle={styles.screenContent}
      footer={
        <SafeAreaView edges={['bottom']} style={styles.navSafeArea}>
          <AdminBottomNav active="AdminUsers" />
        </SafeAreaView>
      }
    >
      <AppHeader title="사용자 관리" showBrand action={headerAction} />

      <View style={styles.body}>
        <PageIntro
          title="사용자"
          description="계정 정보를 확인하고 관리자 권한을 안전하게 관리하세요."
        />

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{users.length.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>전체 계정</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{customerCount.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>일반 고객</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{adminCount.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>관리자</Text>
          </View>
        </View>

        <View style={styles.searchGroup}>
          <Text style={styles.searchLabel}>사용자 검색</Text>
          <View style={styles.searchField}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="이름, 연락처 또는 이메일"
              placeholderTextColor={colors.disabled}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="사용자 검색"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="검색어 지우기"
                hitSlop={8}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.capabilityNotice} accessibilityRole="summary">
          <Ionicons name="shield-outline" size={19} color={colors.textSecondary} />
          <Text style={styles.capabilityNoticeText}>
            관리자 권한은 V2 보호 필드입니다. 이 화면에서는 계정 조회와 일반 고객 삭제만 지원합니다.
          </Text>
        </View>

        {error && users.length > 0 ? (
          <View style={styles.inlineError} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={19} color={colors.danger} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        {loading && users.length === 0 ? (
          <StateView title="사용자 목록을 불러오는 중입니다" loading />
        ) : error && users.length === 0 ? (
          <StateView
            title="사용자 목록을 불러오지 못했습니다"
            message="연결 상태를 확인한 뒤 다시 시도해 주세요."
            icon="cloud-offline-outline"
            actionLabel="다시 시도"
            onAction={() => void fetchUsers()}
          />
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={user => user.id}
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              filteredUsers.length === 0 && styles.emptyListContent,
            ]}
            keyboardShouldPersistTaps="handled"
            refreshing={loading}
            onRefresh={() => void fetchUsers()}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <StateView
                title={query ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다'}
                message={query ? '다른 이름, 연락처 또는 이메일로 검색해 보세요.' : undefined}
                icon="people-outline"
              />
            }
            renderItem={({ item }) => {
              const busy = busyUserId === item.id;
              const initial = item.name?.trim().charAt(0) || '?';

              return (
                <Card style={styles.userCard}>
                  <View style={styles.userHeader}>
                    <View style={styles.avatar} accessibilityElementsHidden>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                    <View style={styles.userIdentity}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>
                          {valueOrFallback(item.name)}
                        </Text>
                        <View
                          style={[styles.roleBadge, item.isAdmin && styles.adminRoleBadge]}
                          accessibilityLabel={item.isAdmin ? '관리자 계정' : '일반 고객 계정'}
                        >
                          <Text style={[styles.roleBadgeText, item.isAdmin && styles.adminRoleBadgeText]}>
                            {item.isAdmin ? '관리자' : '고객'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {valueOrFallback(item.phone)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {valueOrFallback(item.email)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {item.isAdmin ? (
                    <View style={styles.protectedRow}>
                      <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.protectedText}>보호된 관리자 계정</Text>
                    </View>
                  ) : (
                    <View style={styles.actionRow}>
                      <Button
                        label="삭제"
                        icon="trash-outline"
                        variant="danger"
                        fullWidth={false}
                        disabled={busyUserId !== null}
                        onPress={() => deleteUser(item)}
                        style={styles.deleteButton}
                      />
                    </View>
                  )}
                </Card>
              );
            }}
          />
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  navSafeArea: {
    backgroundColor: colors.surface,
  },
  headerAction: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
    backgroundColor: colors.primarySubtle,
  },
  body: {
    flex: 1,
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: spacing.xl,
  },
  summaryRow: {
    minHeight: 82,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 27,
    color: colors.text,
  },
  summaryLabel: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  searchGroup: {
    marginBottom: spacing.md,
  },
  searchLabel: {
    marginBottom: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  searchField: {
    minHeight: layout.minTouchTarget + 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capabilityNotice: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.disabledSoft,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  capabilityNoticeText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  inlineError: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineErrorText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  userCard: {
    marginBottom: spacing.sm,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 23,
    color: colors.primaryDark,
  },
  userIdentity: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  name: {
    maxWidth: '72%',
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.disabledSoft,
  },
  adminRoleBadge: {
    backgroundColor: colors.primarySoft,
  },
  roleBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  adminRoleBadgeText: {
    color: colors.primaryDark,
  },
  detailRow: {
    marginTop: spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  actionRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  protectedRow: {
    minHeight: layout.minTouchTarget,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  protectedText: {
    marginLeft: spacing.xs,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  deleteButton: {
    minWidth: 112,
  },
});
