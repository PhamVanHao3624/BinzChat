// Màn hình: Danh sách các cuộc hội thoại (chat list)
// ---------------------------------------------------
// Đây là bản UI đơn giản, dùng dữ liệu giả (mock) cho dễ hiểu.
// Khi kết nối API thật, bạn chỉ cần thay mảng MOCK_CHATS bằng dữ liệu fetch từ server.

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";

// Kiểu dữ liệu cho 1 item trong danh sách chat
type ChatItem = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  avatarUrl?: string;
  isGroup?: boolean;
};

// Dữ liệu giả để hiển thị UI
const MOCK_CHATS: ChatItem[] = [
  {
    id: "1",
    name: "Alex Johnson",
    lastMessage: "Can you send over the final report?",
    time: "10:45 AM",
    avatarUrl: "https://i.pravatar.cc/100?img=1",
  },
  {
    id: "2",
    name: "Marketing Team",
    lastMessage: "The new campaign assets are ready.",
    time: "9:15 AM",
    isGroup: true,
  },
  {
    id: "3",
    name: "Sarah Miller",
    lastMessage: "Let's schedule the sync for Monday...",
    time: "Yesterday",
    unreadCount: 2,
    avatarUrl: "https://i.pravatar.cc/100?img=2",
  },
  {
    id: "4",
    name: "David Chen",
    lastMessage: "Thanks for the feedback on the design.",
    time: "Dec 12",
    avatarUrl: "https://i.pravatar.cc/100?img=3",
  },
  {
    id: "5",
    name: "Emily Blunt",
    lastMessage: "I've attached the signed contract for you.",
    time: "Dec 12",
    avatarUrl: "https://i.pravatar.cc/100?img=4",
  },
  {
    id: "6",
    name: "James Wilson",
    lastMessage: "Looking forward to our meeting next week.",
    time: "Dec 10",
  },
];

const ChatListScreen: React.FC = () => {
  const router = useRouter();

  // Hàm render từng hàng (một cuộc hội thoại)
  const renderItem = ({ item }: { item: ChatItem }) => {
    const onPressItem = () => {
      // Điều hướng sang màn hình chi tiết chat
      // Route: /chat-demo/[id]
      router.push({
        pathname: "/chat-demo/[id]",
        params: { id: item.id, name: item.name },
      });
    };

    return (
      <TouchableOpacity style={styles.chatRow} onPress={onPressItem}>
        {/* Avatar hoặc icon group */}
        <View style={styles.avatarWrapper}>
          {item.isGroup ? (
            // Nếu là group, hiển thị avatar dạng hình vuông bo góc
            <View style={styles.groupAvatar}>
              <Text style={styles.groupAvatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : item.avatarUrl ? (
            // Nếu có avatarUrl thì load ảnh từ internet
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            // Nếu không có avatarUrl thì hiển thị vòng tròn có chữ cái đầu tên
            <View style={styles.emptyAvatar}>
              <Text style={styles.emptyAvatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Chấm online (demo cho 2 user) */}
          {!item.isGroup && (item.id === "1" || item.id === "4") && (
            <View style={styles.onlineDot} />
          )}
        </View>

        {/* Phần nội dung bên phải avatar */}
        <View style={styles.chatContent}>
          {/* Dòng trên: tên + thời gian */}
          <View style={styles.chatHeaderRow}>
            <Text style={styles.chatName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>

          {/* Dòng dưới: tin nhắn cuối + badge unread */}
          <View style={styles.chatBottomRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>

            {item.unreadCount && item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Phần header: title + ô search
  const renderHeader = () => (
    <>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.iconButtonText}>☰</Text>
        </TouchableOpacity>

        <Text style={styles.title}>BizChat</Text>

        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.iconButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          placeholder="Search conversations"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
      </View>
    </>
  );

  // Phần footer: nút new chat + thanh tab dưới cùng (mock)
  const renderFooter = () => (
    <>
      {/* Nút New Chat dạng floating (tròn xanh) */}
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabIcon}>✉️</Text>
      </TouchableOpacity>

      {/* Thanh tab dưới cùng chỉ mang tính minh hoạ */}
      <View style={styles.bottomTab}>
        <TabItem label="Chats" active />
        <TabItem label="Contacts" />
        <TabItem label="Notifications" />
        <TabItem label="Profile" />
        <TabItem label="Settings" />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_CHATS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

// Component nhỏ để vẽ 1 tab dưới cùng
type TabItemProps = {
  label: string;
  active?: boolean;
};

const TabItem: React.FC<TabItemProps> = ({ label, active }) => {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
      {active && <View style={styles.tabIndicator} />}
    </View>
  );
};

export default ChatListScreen;

// Styles cho toàn bộ màn hình danh sách chat
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  listContent: {
    paddingBottom: 80,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    fontSize: 18,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: "#6B7280",
  },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
  },
  chatRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  avatarWrapper: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  emptyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D4ED8",
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  chatContent: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 10,
  },
  chatHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 72,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  fabIcon: {
    fontSize: 24,
    color: "#FFFFFF",
  },
  bottomTab: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  tabLabelActive: {
    color: "#2563EB",
    fontWeight: "600",
  },
  tabIndicator: {
    marginTop: 2,
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#2563EB",
  },
});

