// Màn hình gốc (root) của ứng dụng khi dùng Expo Router.
// Ở đây mình chỉ đơn giản redirect sang màn hình demo danh sách chat.
// Nếu sau này bạn muốn quay lại flow Welcome/Login thì đổi lại đường dẫn href.
import { Redirect } from "expo-router";

export default function Index() {
  // Ghi log để bạn dễ theo dõi trong Metro / console
  console.log("📍 Index - Redirecting to Chat Demo");

  // Điều hướng thẳng sang route `/chat-demo`
  // Tương ứng với file `/src/app/chat-demo/index.tsx`
  return <Redirect href="/chat-demo" />;
}