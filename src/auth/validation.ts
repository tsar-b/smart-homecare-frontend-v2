export interface RegistrationFields {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly agreed: boolean;
}

export type RegistrationFieldErrors = Partial<
  Record<'name' | 'phone' | 'email' | 'password' | 'confirm' | 'address' | 'terms', string>
>;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Match the form's advertised password rules and the API's maximum length. */
export function registrationPasswordError(password: string): string | null {
  if (!password) return '비밀번호를 입력해 주세요.';
  if (password.length < 8) return '8자 이상 입력해 주세요.';
  if (password.length > 200) return '비밀번호는 200자 이하로 입력해 주세요.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return '영문과 숫자를 함께 사용해 주세요.';
  }
  return null;
}

export function validateRegistrationFields(input: RegistrationFields): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  if (input.name.trim().length < 2) errors.name = '이름을 2자 이상 입력해 주세요.';
  else if (input.name.trim().length > 120) errors.name = '이름은 120자 이하로 입력해 주세요.';

  const phoneDigits = input.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    errors.phone = '연락 가능한 전화번호를 입력해 주세요.';
  }
  if (!isValidEmail(input.email)) errors.email = '이메일 형식을 확인해 주세요.';

  const passwordError = registrationPasswordError(input.password);
  if (passwordError) errors.password = passwordError;
  if (!input.confirmPassword) errors.confirm = '비밀번호를 다시 입력해 주세요.';
  else if (input.password !== input.confirmPassword) errors.confirm = '비밀번호가 서로 다릅니다.';
  if (!input.agreed) errors.terms = '서비스 이용과 개인정보 처리 동의가 필요합니다.';
  return errors;
}
