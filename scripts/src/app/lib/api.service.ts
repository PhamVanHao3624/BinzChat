/**
 * File: api.service.ts
 * Chức năng: Cấu hình Axios để gọi API từ ứng dụng React Native đến Backend Node.js.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Địa chỉ gốc của API backend (localhost:4000)
// Chú ý: Nếu chạy trên thiết bị Android thật, dùng 'http://10.0.2.2:4000/api'
const API_BASE_URL = 'http://localhost:4000/api';

// Khởi tạo instance axios với cấu hình cơ bản
const api = axios.create({
  baseURL: "http://localhost:4000/api",
  timeout: 10000, // Thêm timeout 10 giây để tránh treo ứng dụng khi mạng chậm
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interceptor: Tự động đính kèm Token xác thực vào Header của mỗi request
 * Nếu bạn có hệ thống đăng nhập, token sẽ được lấy từ AsyncStorage.
 */
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Các hàm gọi cụ thể phục vụ chức năng Bình chọn (Poll)
 */
export const pollApi = {
  // Lấy toàn bộ danh sách Poll của một cuộc hội thoại cụ thể (chatId)
  getPollsByChat: (chatId: string) => api.get(`/polls?chatId=${chatId}`),

  // Gửi yêu cầu tạo một cuộc bình chọn mới lên Server
  createPoll: (pollData: any) => api.post('/polls', pollData),

  // Gửi lựa chọn vote của người dùng cho một Poll cụ thể
  vote: (pollId: string, voteData: { userId: string; optionIds: string[] }) =>
    api.post(`/polls/${pollId}/vote`, voteData),

  // Yêu cầu server đóng/kết thúc một cuộc bình chọn
  closePoll: (id: string) => api.post(`/polls/${id}/close`),
};

export default api;
