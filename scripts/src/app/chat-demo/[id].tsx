// Màn hình: Chi tiết cuộc hội thoại (chat 1-1 / chat nhóm)
// ---------------------------------------------------------
// - Dùng chung cho cả 1-1 và group: tuỳ thuộc tham số truyền vào (name, members, online)
// - Dữ liệu tin nhắn hiện tại là mock (lưu trong state), chỉ để demo UI và logic cơ bản (chưa gọi API).

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

// Kiểu dữ liệu cho 1 option trong bình chọn (poll)
type PollOption = {
  id: string;
  text: string;
  votes: number;
  votedByMe?: boolean;
};

// Kiểu dữ liệu cho 1 cuộc họp trong lịch làm việc
type MeetingInfo = {
  title: string;
  time: string;
  location?: string;
};

// Kiểu dữ liệu cho 1 nhắc việc / reminder đơn giản
type ReminderInfo = {
  title: string;
  time: string;
};

// Kiểu dữ liệu cho 1 thông báo nhóm
type GroupNotificationInfo = {
  title: string;
  description?: string;
};

// Kiểu dữ liệu cho 1 tin nhắn trong nhóm (có thể là text, có file đính kèm, hoặc có bình chọn)
type Message = {
  id: string;
  text: string;
  createdAt: string; 
  isMe: boolean; 
  showTimeAbove?: string; 
  senderName?: string; 
  senderAvatarInitial?: string; 
  hasAttachment?: boolean; 
  poll?: {
    question: string;
    options: PollOption[];
    allowMulti?: boolean;
    closed?: boolean;
  };
  meeting?: MeetingInfo;
  reminder?: ReminderInfo;
  groupNotification?: GroupNotificationInfo;
};

// Dữ liệu tin nhắn giả để demo UI.
const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    text: "Has anyone reviewed the Q3 campaign brief yet? We need to finalize the budget allocations by EOD.",
    createdAt: "10:15 AM",
    isMe: false,
    senderName: "Alex Rivers",
    senderAvatarInitial: "A",
    showTimeAbove: "TODAY",
  },
  {
    id: "2",
    text: "Just finished looking at the assets. They look great!",
    createdAt: "10:18 AM",
    isMe: false,
    senderName: "Jordan Lee",
    senderAvatarInitial: "J",
  },
  {
    id: "3",
    text: "I've uploaded the final PDF for the strategy below. Let me know if we need changes.",
    createdAt: "10:20 AM",
    isMe: true,
    senderName: "You",
    hasAttachment: true,
  },
  {
    id: "4",
    text: "Q3_Marketing_Strategy_v2.pdf",
    createdAt: "10:22 AM",
    isMe: true,
    senderName: "You",
    hasAttachment: true,
  },
  {
    id: "5",
    text: "",
    createdAt: "10:25 AM",
    isMe: false,
    senderName: "Alex Rivers",
    senderAvatarInitial: "A",
    poll: {
      question: "When should we schedule the next campaign review meeting?",
      options: [
        { id: "o1", text: "Tomorrow morning", votes: 3 },
        { id: "o2", text: "Tomorrow afternoon", votes: 5 },
        { id: "o3", text: "Next Monday", votes: 2 },
      ],
    },
  },
];

const ChatDetailScreen: React.FC = () => {
  const router = useRouter();

  // Lấy tham số từ URL
  const { id, name, members, online } = useLocalSearchParams<{
    id: string;
    name?: string;
    members?: string;
    online?: string;
  }>();

  // State chứa danh sách tin nhắn hiện tại
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);

  // State nội dung đang nhập
  const [inputValue, setInputValue] = useState("");

  const initials = useMemo(() => {
    const displayName = name || `Chat #${id}`;
    return displayName.charAt(0).toUpperCase();
  }, [id, name]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={stylesDetail.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {/* Header */}
        <View style={stylesDetail.header}>
          <TouchableOpacity
            style={stylesDetail.headerButton}
            onPress={() => router.back()}
          >
            <Text style={stylesDetail.headerButtonText}>←</Text>
          </TouchableOpacity>

          <View style={stylesDetail.headerCenter}>
            <View style={stylesDetail.headerAvatarRow}>
              <View style={stylesDetail.avatarCircle}>
                <Text style={stylesDetail.avatarInitial}>{initials}</Text>
              </View>
              <View style={stylesDetail.headerTextBlock}>
                <Text style={stylesDetail.headerTitle}>
                  {name || `Chat #${id}`}
                </Text>
                <Text style={stylesDetail.headerSubtitle}>
                  {members ? `${members} members` : "24 members"} •{" "}
                  {online ? `${online} online` : "8 online"}
                </Text>
              </View>
            </View>
          </View>

          <View style={stylesDetail.headerActions}>
            <TouchableOpacity style={stylesDetail.headerIconButton}>
              <Text style={stylesDetail.headerIconText}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={stylesDetail.headerIconButton}>
              <Text style={stylesDetail.headerIconText}>🎥</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }} />
      </KeyboardAvoidingView>
    </>
  );
};

const stylesDetail = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E5E7EB",
  },
  header: {
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonText: {
    fontSize: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  headerTextBlock: {
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  headerIconText: {
    fontSize: 18,
  },
});

export default ChatDetailScreen;
