# Hướng dẫn Tính năng Bình chọn (Polling) & Realtime

Dự án BinzChat đã được nâng cấp với hệ thống quản lý bình chọn và đồng bộ thời gian thực.

## Các tính năng chính
- **Tạo bình chọn**: Hỗ trợ nhiều phương án, lưu trữ lâu dài trên MongoDB.
- **Bình chọn realtime**: Sử dụng Socket.io để cập nhật kết quả ngay lập tức cho toàn bộ người dùng trong phòng chat.
- **Kết thúc bình chọn**: Chỉ người tạo mới có quyền đóng bình chọn.
- **Xác thực người dùng**: Sử dụng AsyncStorage để định danh người dùng trên thiết bị, giúp theo dõi lượt vote chính xác.

## Cách chạy thử
1. Khởi động Backend: `npm run dev` trong thư mục `api`.
2. Khởi động Frontend: `npx expo start --web` trong thư mục `BinzChat/scripts`.
3. Mở 2 cửa sổ trình duyệt khác nhau để kiểm tra tính năng đồng bộ thời gian thực.
