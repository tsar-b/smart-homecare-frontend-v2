// src/services/authService.ts
import axios from 'axios';

const API = process.env.SERVER_API;
const SERVER_URL = process.env.SERVER_URL;

/* ---------- e-mail ---------- */
export const loginWithEmail = (email: string, password: string) =>
  axios.post(`${API}/login`, { email, password }).then(r => r.data);

/* ---------- kakao ---------- */
export const loginWithKakao = (
  accessToken: string,
  shippingAddr?: { baseAddress?: string; detailAddress?: string } | null,
) => {
  console.log(
    '↗︎ sending token:', accessToken.slice(0, 10), '…',
    'shippingAddr →', shippingAddr,
  );

  // 🔑  IMPORTANT:  return only the payload
  return axios
    .post(`${API}/kakao/login`, { accessToken, shippingAddr })
    .then(r => r.data); 
};

export const loginWithApple = async (identityToken: string, authorizationCode: string) => {
  const res = await axios.post(`${API}/auth/apple`, {
    identityToken,
    authorizationCode,
  });

  return res.data;
};

/* ---------- address search (kakao) ---------- */

export const searchAddress = async (query: string) => {
  const res = await axios.get('/api/kakao/address', {
    baseURL: SERVER_URL,
    params: { query },
  });
  return res.data.documents ?? res.data;
};
