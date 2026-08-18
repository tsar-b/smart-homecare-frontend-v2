// BookingConfirm.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  TextInput,
  Image,
  BackHandler,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Crypto from 'expo-crypto';
import axios from 'axios';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

const API = process.env.SERVER_API;

interface SelectedOption {
  _id: string;
  key: string;
  label: string;
  selectedLabel: string;
  selectedValue: string;
  extraCost: number;
}
interface Tier {
  tier: string;
  price: number;
  memo?: string;
}
interface Slot {
  time: string;
  available: boolean;
}
type ConfirmRoute = RouteProp<RootStackParamList, 'Confirm'>;
type ConfirmNav = NativeStackNavigationProp<RootStackParamList>;

export default function BookingConfirm() {
  const { token, currentUser } = useAuth();
  const navigation = useNavigation<ConfirmNav>();
  const route = useRoute<ConfirmRoute>();

  const {
  subtype,
  serviceType,
  tier,
  selectedOptions,
  symptom: symptomFromRoute = '',
}: {
  subtype: { _id: string; name: string };
  serviceType: { _id: string; name: string; label: string };
  tier: Tier;
  selectedOptions: SelectedOption[];
  symptom?: string;
} = route.params;

  const [reservationDate, setReservationDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [symptom, setSymptom] = useState(symptomFromRoute);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionRef = useRef<{ fingerprint: string; id: string } | null>(null);

  const fetchSlots = async (day: Date) => {
    const yyyyMMdd = day.toISOString().slice(0, 10);
    try {
      const { data } = await axios.get<Slot[]>(
        `${API}/timeslots`,
        { params: { date: yyyyMMdd } },
      );
      setSlots(data);
      setSelectedSlot(null);
    } catch {
      Alert.alert('시간 정보를 불러오지 못했습니다.');
    }
  };

  const isPast = (slot: string) => {
    const now = new Date();
    if (now.toDateString() !== reservationDate.toDateString()) return false;
    const [h, m] = slot.split(':').map(Number);
    return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
  };

  useEffect(() => {
    fetchSlots(reservationDate);
  }, [reservationDate]);

  
  const totalExtraCost = selectedOptions.reduce(
    (sum, opt) => sum + (opt.extraCost || 0),
    0,
  );
  const totalPrice = tier.price === -1 ? -1 : tier.price + totalExtraCost;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!selectedSlot) {
      Alert.alert('오류', '예약 시간을 선택해주세요.');
      return;
    }

    const bookingDetails = {
      asset_id: subtype._id,
      service_type: serviceType.name,
      subtype: subtype.name,
      name: currentUser?.name ?? '게스트',
      phone: currentUser?.phone,
      address: currentUser?.address,
      reservation_date: reservationDate.toISOString().split('T')[0],
      reservation_time: selectedSlot,
      ...(totalPrice >= 0 ? { total_price: totalPrice } : {}),
      symptom: serviceType.name === 'fix' ? symptom : '',
    };
    const fingerprint = JSON.stringify(bookingDetails);
    if (!submissionRef.current || submissionRef.current.fingerprint !== fingerprint) {
      submissionRef.current = { fingerprint, id: Crypto.randomUUID() };
    }
    const clientRequestId = submissionRef.current.id;
    const payload = { ...bookingDetails, client_request_id: clientRequestId };

    setIsSubmitting(true);
    try {
      await axios.post(`${API}/bookings`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': clientRequestId,
        },
      });
      submissionRef.current = null;
      Alert.alert('예약 완료', '서비스가 성공적으로 예약되었습니다.');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err: any) {
      console.error('Booking failed:', err);
      const code = err.response?.data?.code;
      Alert.alert(
        '오류',
        code === 'BOOKING_SLOT_UNAVAILABLE'
          ? '이미 선택된 예약 시간입니다.'
          : '예약에 실패했습니다. 다시 시도해도 중복 예약은 생성되지 않습니다.',
      );
      fetchSlots(reservationDate);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  useFocusEffect(
  useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true); 
    return () => sub.remove();
  }, [])
);

    const handleBack = () => {
        Alert.alert('경고', '서비스 선택부터 다시 시작해야 합니다.', [
          { text: '취소', style: 'cancel' },
          {
            text: '돌아가기',
            style: 'destructive',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'BookingMenu' }],
              }),
          },
        ]);
      };

  return (
    <LinearGradient colors={['#d0eaff', '#89c4f4']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>예약 확인</Text>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Image source={require('./asset/icons/back-button.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <View style={styles.receiptBox}>
          <Text style={styles.summaryRow}><Text style={styles.label}>기기:</Text> {subtype.name}</Text>
          <Text style={styles.summaryRow}><Text style={styles.label}>서비스:</Text> {serviceType.label}</Text>
          <Text style={styles.summaryRow}><Text style={styles.label}>티어:</Text> {tier.tier.toUpperCase()}</Text>
          <Text style={styles.summaryRow}><Text style={styles.label}>기본 가격:</Text> {tier.price === -1 ? '가격문의' : `₩${tier.price.toLocaleString()}`}</Text>
        </View>

        {selectedOptions.length > 0 && (
          <View style={styles.receiptBox}>
            <Text style={styles.sectionTitle}>선택한 옵션</Text>
            {selectedOptions.map(opt => (
              <Text key={opt.key} style={styles.optionRow}>
                {opt.label} ({opt.selectedLabel}): + ₩{opt.extraCost.toLocaleString()}
              </Text>
            ))}
          </View>
        )}

        {serviceType.name === 'fix' && (
          <View style={styles.symptBox}>
            <Text style={styles.sectionTitle}>증상</Text>
            <TextInput
              style={{
                backgroundColor: '#fff',
                padding: 10,
                borderRadius: 8,
                borderColor: '#ccc',
                borderWidth: 1,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              multiline
              placeholder="예: 냉방이 잘 안돼요, 물이 새요 등"
              value={symptom}
              onChangeText={setSymptom}
            />
          </View>
        )}

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>총 가격</Text>
          <Text style={styles.totalValue}>{totalPrice === -1 ? '가격문의' : `₩${totalPrice.toLocaleString()}`}</Text>
        </View>

        <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateButtonText}>예약 날짜: {reservationDate.toLocaleDateString()}</Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={reservationDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => {
              setShowPicker(false);
              if (d) setReservationDate(d);
            }}
          />
        )}

        <View style={styles.timeSlotContainer}>
          <Text style={styles.sectionTitle}>예약 시간 선택</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlotList}>
            {slots.map(({ time, available }) => {
              const disabled = isPast(time) || !available;
              const isSelected = selectedSlot === time;
              return (
                <TouchableOpacity
                  key={time}
                  style={[styles.timeSlotButton, isSelected && styles.timeSlotButtonSelected, disabled && styles.timeSlotButtonDisabled]}
                  onPress={() => !disabled && setSelectedSlot(time)}
                  disabled={disabled}
                >
                  <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextSelected, disabled && styles.timeSlotTextDisabled]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitText}>{isSubmitting ? '예약 처리 중' : '예약 확정'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  )}; 


const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'JalnanGothic',
    fontSize: 28,
    color: '#010198',
    textAlign: 'center',
    marginBottom: 24,
  },
  receiptBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },

   symptBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },

  summaryRow: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    marginBottom: 6,
    color: '#333',
  },
  label: {
    fontFamily: 'Pretendard-Bold',
    color: '#555',
  },
  sectionTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    marginBottom: 12,
    color: '#010198',
  },
  optionRow: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  totalBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  totalLabel: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#d32f2f',
  },
  totalValue: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#d32f2f',
  },
  dateButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  dateButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#010198',
  },
  submitButton: {
    backgroundColor: '#007BFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#fff',
  },
  timeSlotContainer: {
    marginVertical: 20,
  },
  timeSlotList: {
    flexDirection: 'row',
    gap: 12,
  },
  timeSlotButton: {
    backgroundColor: '#ffffffaa',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderColor: '#ccc',
    borderWidth: 1,
    marginHorizontal: 5,
  },
  timeSlotButtonSelected: {
    backgroundColor: '#007BFF',
    borderColor: '#007BFF',
  },
  timeSlotButtonDisabled: {
    backgroundColor: '#ddd',
    borderColor: '#bbb',
  },
  timeSlotText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#333',
  },
  timeSlotTextSelected: {
    color: '#ffffff',
    fontFamily: 'Pretendard-Bold',
  },
  timeSlotTextDisabled: {
    color: '#888',
    fontFamily: 'Pretendard-Regular',
  },
   backButton: {
    position: 'absolute',
    left: 24,
    top: 60,
    padding: 8,
  },
  backIcon: { width: 24, height: 24, tintColor: '#010198' },
});
