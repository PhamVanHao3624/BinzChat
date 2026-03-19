// Màn hình: Chi tiết cuộc hội thoại (chat 1-1 / chat nhóm)
// ---------------------------------------------------------
// - Dùng chung cho cả 1-1 và group: tuỳ thuộc tham số truyền vào (name, members, online)
// - Dữ liệu tin nhắn hiện tại là mock (lưu trong state), chỉ để demo UI và logic cơ bản (chưa gọi API).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { io } from "socket.io-client";
import { pollApi } from "../lib/api.service";

// Kiểu dữ liệu cho 1 option trong bình chọn (poll)
// Ví dụ 1 option: "Tomorrow morning" với số lượng vote tương ứng.
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
// ---------------------------------------------------------------------------------------
type Message = {
  id: string;             // Định danh duy nhất của tin nhắn (từ MongoDB hoặc timestamp)
  text: string;           // Nội dung văn bản (nếu có)
  createdAt: string;       // Thời gian gửi (ví dụ "10:15 AM", "Now")
  isMe: boolean;          // Đánh dấu tin nhắn này là của chính người dùng hiện tại
  showTimeAbove?: string;  // Nhãn thời gian hiển thị phía trên (TODAY, YESTERDAY)
  senderName?: string;     // Tên người gửi hiển thị cạnh bubble
  senderAvatarInitial?: string; // Chữ cái viết tắt của avatar
  hasAttachment?: boolean; // Cờ đánh dấu có đính kèm file hay không
  poll?: {                 // Thông tin về cuộc bình chọn (nếu có)
    question: string;
    options: PollOption[];
    allowMulti?: boolean;
    closed?: boolean;
  };
  meeting?: MeetingInfo;   // Thông tin lịch họp (nếu có)
  reminder?: ReminderInfo; // Thông tin nhắc việc (nếu có)
  groupNotification?: GroupNotificationInfo; // Thông tin thông báo nhóm (nếu có)
};

// Dữ liệu tin nhắn giả để demo UI.
// Khi tích hợp API thật, bạn chỉ cần thay thế MOCK_MESSAGES bằng dữ liệu từ server.


const ChatDetailScreen: React.FC = () => {
  const router = useRouter();

  // Lấy tham số từ URL: /chat-demo/[id]?name=Marketing%20Team&members=24&online=8
  // -> Cho phép màn hình này hiển thị đúng tiêu đề / thông tin nhóm khi điều hướng từ màn khác.
  const { id, name, members, online } = useLocalSearchParams<{
    id: string;
    name?: string;
    members?: string;
    online?: string;
  }>();

  // State chứa danh sách tin nhắn hiện tại (fetch từ API + tin nhắn mới)
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  // Đối tượng socket dùng để giao tiếp thời gian thực
  // Dùng useRef để giữ instance của socket không bị khởi tạo lại khi re-render (giúp ổn định kết nối)
  const socketRef = useRef<any>(null);

  // Khởi tạo Socket.IO và nạp dữ liệu ban đầu
  useEffect(() => {
    loadInitialData();

    // Kết nối đến server Socket.io (localhost:4000)
    const socket = io("http://localhost:4000");
    const chatId = id || "public-chat"; // ID mặc định nếu không có tham số
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[Socket] Connected to server with ID: ${socket.id}`);
      // Tham gia vào phòng của chat này để nhận thông báo có poll mới
      if (id) {
        socket.emit("joinPoll", id); // Backend dùng chung joinPoll cho cả chat room nếu cần
        // Hoặc cụ thể hơn nếu backend yêu cầu join theo tên room
        socket.emit("joinChat", id);
        console.log(`[Socket] Joined chat room: ${id}`);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Lắng nghe sự kiện có người tạo poll mới
    socket.on("pollCreated", (newPoll: any) => {
      // Tránh trùng lặp nếu mình là người tạo (đã thêm local)
      setMessages((prev) => {
        if (prev.some(m => m.id === newPoll._id)) return prev;

        const pollMessage: Message = {
          id: newPoll._id,
          text: "",
          createdAt: new Date(newPoll.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: newPoll.createdBy === userId,
          senderName: newPoll.createdBy === userId ? "You" : "User",
          poll: {
            question: newPoll.question,
            options: newPoll.options.map((opt: any) => ({
              id: opt._id,
              text: opt.text,
              votes: opt.votes,
            })),
          },
        };
        return [...prev, pollMessage];
      });
      // Tham gia phòng cập nhật của poll mới này
      socket.emit("joinPoll", newPoll._id);
    });

    // Lắng nghe sự kiện có người vote hoặc poll thay đổi
    socket.on("pollUpdated", (updatedPoll: any) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== updatedPoll._id || !msg.poll) return msg;
          return {
            ...msg,
            poll: {
              ...msg.poll,
              options: updatedPoll.options.map((opt: any) => ({
                id: opt._id,
                text: opt.text,
                votes: opt.votes,
                votedByMe: updatedPoll.votesByUser[userId!]?.includes(opt._id),
              })),
              closed: updatedPoll.isClosed,
            },
          };
        })
      );
    });

    // Lắng nghe sự kiện poll bị đóng
    socket.on("pollClosed", (closedPoll: any) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== closedPoll._id || !msg.poll) return msg;
          return {
            ...msg,
            poll: {
              ...msg.poll,
              closed: true,
            },
          };
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [id, userId]);

  /**
   * Hàm khởi tạo: Lấy định danh người dùng và tải danh sách poll từ MongoDB
   */
  const loadInitialData = async () => {
    try {
      setIsLoading(true);

      // (1) Quản lý định danh: Lấy userId từ bộ nhớ máy (AsyncStorage)
      let storedUserId = await AsyncStorage.getItem("userId");
      if (!storedUserId) {
        // Nếu chưa có, tạo một ID tạm thời cho thiết bị này
        storedUserId = "user_" + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem("userId", storedUserId);
      }
      setUserId(storedUserId);

      // (2) Tải dữ liệu: Lấy danh sách các cuộc bình chọn của phòng chat này (id)
      const response = await pollApi.getPollsByChat(id || "default");
      const polls = response.data;

      // (3) Chuyển đổi dữ liệu từ Backend sang định dạng giao diện hiển thị (Message)
      const pollMessages: Message[] = polls.map((p: any) => ({
        id: p._id,
        text: "",
        createdAt: new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: p.createdBy === storedUserId,
        senderName: p.createdBy === storedUserId ? "You" : "User",
        poll: {
          question: p.question,
          options: p.options.map((opt: any) => ({
            id: opt._id, // ID của phương án do backend quản lý
            text: opt.text,
            votes: opt.votes,
            // Kiểm tra xem người dùng hiện tại đã từng vote cho phương án này chưa
            votedByMe: p.votesByUser && p.votesByUser[storedUserId!]?.includes(opt._id),
          })),
          allowMulti: p.allowMultiSelect,
          closed: p.isClosed,
        },
      }));

      // Cập nhật trạng thái hiển thị (không dùng dữ liệu giả MOCK_MESSAGES để đảm bảo thực tế)
      setMessages(pollMessages);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu từ API:", error);
      setMessages([]); // Nếu lỗi, hiển thị màn hình trống
    } finally {
      setIsLoading(false); // Kết thúc trạng thái đang tải
    }
  };

  // State chứa nội dung đang nhập trong ô TextInput (gửi tin nhắn text bình thường)
  const [inputValue, setInputValue] = useState("");

  // State phục vụ luồng "Tạo bình chọn" (poll composer) ở phía dưới
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsDraft, setPollOptionsDraft] = useState<string[]>([
    "",
    "",
  ]);

  // State cho "Lịch làm việc": tạo lịch họp, nhắc việc, thông báo nhóm
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");

  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderTime, setReminderTime] = useState("");

  const [isCreatingNotification, setIsCreatingNotification] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationDescription, setNotificationDescription] = useState("");

  // Tên hiển thị đầu (chữ cái) cho avatar nhóm (ví dụ "M" cho "Marketing Team")
  const initials = useMemo(() => {
    const displayName = name || `Chat #${id}`;
    return displayName.charAt(0).toUpperCase();
  }, [id, name]);

  // Hàm gửi tin nhắn text (không xử lý file, không xử lý poll).
  // Chỉ thêm 1 item mới vào cuối mảng `messages`.
  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(), // tạm dùng timestamp làm id
      text: inputValue.trim(),
      createdAt: "Now",
      isMe: true,
      senderName: "You",
    };

    // Thêm tin nhắn mới vào cuối mảng
    setMessages((prev) => [...prev, newMessage]);
    setInputValue(""); // clear ô input
  };

  // Hàm xử lý vote cho 1 option trong poll (bình chọn).
  // Ý tưởng:
  // - Duyệt qua danh sách messages, tìm message có poll tương ứng.
  // - Trong poll đó, map lại từng option:
  //   + Nếu là option được bấm -> toggle trạng thái votedByMe và cộng/trừ 1 vote.
  //   + Nếu poll không cho chọn nhiều (allowMulti = false) thì bỏ chọn các option khác.
  /**
   * Hàm xử lý khi người dùng nhấn bình chọn (Vote) một phương án
   * 1. Gửi request lên server
   * 2. Nhận kết quả poll đã cập nhật
   * 3. Refresh state local để UI hiển thị số vote mới nhất
   */
  const handleVote = async (messageId: string, optionId: string) => {
    try {
      // Gửi yêu cầu vote lên server
      const response = await pollApi.vote(messageId, {
        userId: userId,
        optionIds: [optionId],
      });

      // Lấy lại thông tin Poll đã được cập nhật từ Server (số vote mới, trạng thái mới)
      const updatedPoll = response.data;

      // Cập nhật lại UI dựa trên dữ liệu mới nhất từ server
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId || !msg.poll) return msg;

          return {
            ...msg,
            poll: {
              ...msg.poll,
              options: updatedPoll.options.map((opt: any) => ({
                id: opt._id,
                text: opt.text,
                votes: opt.votes,
                votedByMe: updatedPoll.votesByUser[userId]?.includes(opt._id),
              })),
              closed: updatedPoll.isClosed,
            },
          };
        })
      );
    } catch (error) {
      console.error("Lỗi khi thực hiện vote:", error);
    }
  };

  // Hàm tạo message bình chọn mới từ dữ liệu trong composer:
  // - Cần ít nhất 1 câu hỏi + 2 lựa chọn hợp lệ.
  // - Sau khi tạo xong, reset lại state composer.
  /**
   * Hàm xử lý khi người dùng nhấn nút "Create Poll"
   */
  const handleCreatePoll = async () => {
    const trimmedQuestion = pollQuestion.trim();
    // Lọc bỏ các phương án trống
    const cleanedOptions = pollOptionsDraft
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);

    // Kiểm tra tính hợp lệ trước khi gửi
    if (!trimmedQuestion || cleanedOptions.length < 2) {
      return;
    }

    try {
      // Gọi API để tạo poll trong MongoDB
      const response = await pollApi.createPoll({
        question: trimmedQuestion,
        options: cleanedOptions.map((text) => ({ text })),
        chatId: id || "default", // ID của phòng chat hiện tại
        createdBy: userId,
      });

      // Lấy poll vừa được tạo thành công
      const newPoll = response.data;

      // Tạo đối tượng tin nhắn để hiển thị ngay trên UI
      const pollMessage: Message = {
        id: newPoll._id,
        text: "",
        createdAt: "Now",
        isMe: true,
        senderName: "You",
        poll: {
          question: newPoll.question,
          options: newPoll.options.map((opt: any) => ({
            id: opt._id,
            text: opt.text,
            votes: 0,
          })),
        },
      };

      // Đưa poll mới vào danh sách tin nhắn hiện tại
      setMessages((prev) => [...prev, pollMessage]);

      // Tham gia phòng của poll này để nhận update realtime
      if (socketRef.current) {
        socketRef.current.emit("joinPoll", newPoll._id);
      }

      // Đóng giao diện tạo poll và reset form
      setIsCreatingPoll(false);
      setPollQuestion("");
      setPollOptionsDraft(["", ""]);
    } catch (error) {
      console.error("Lỗi khi tạo bình chọn:", error);
    }
  };

  /**
   * Hàm xử lý khi người tạo nhấn "Kết thúc bình chọn"
   */
  const handleClosePoll = async (pollId: string) => {
    try {
      const response = await pollApi.closePoll(pollId);
      const closedPoll = response.data;

      // Cập nhật UI local ngay lập tức
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== pollId || !msg.poll) return msg;
          return {
            ...msg,
            poll: { ...msg.poll, closed: true },
          };
        })
      );
    } catch (error) {
      console.error("Lỗi khi kết thúc poll:", error);
    }
  };

  const handleChangePollOption = (index: number, value: string) => {
    setPollOptionsDraft((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddPollOption = () => {
    setPollOptionsDraft((prev) => [...prev, ""]);
  };

  // Tạo 1 message kiểu "meeting card"
  const handleCreateMeeting = () => {
    const title = meetingTitle.trim();
    const time = meetingTime.trim();
    if (!title || !time) return;

    const meetingMessage: Message = {
      id: Date.now().toString(),
      text: "",
      createdAt: "Now",
      isMe: true,
      senderName: "You",
      meeting: {
        title,
        time,
        location: meetingLocation.trim() || undefined,
      },
    };

    setMessages((prev) => [...prev, meetingMessage]);
    setIsCreatingMeeting(false);
    setMeetingTitle("");
    setMeetingTime("");
    setMeetingLocation("");
  };

  // Tạo 1 message kiểu "reminder card"
  const handleCreateReminder = () => {
    const title = reminderTitle.trim();
    const time = reminderTime.trim();
    if (!title || !time) return;

    const reminderMessage: Message = {
      id: Date.now().toString(),
      text: "",
      createdAt: "Now",
      isMe: true,
      senderName: "You",
      reminder: {
        title,
        time,
      },
    };

    setMessages((prev) => [...prev, reminderMessage]);
    setIsCreatingReminder(false);
    setReminderTitle("");
    setReminderTime("");
  };

  // Tạo 1 message kiểu "group notification"
  const handleCreateNotification = () => {
    const title = notificationTitle.trim();
    if (!title) return;

    const notificationMessage: Message = {
      id: Date.now().toString(),
      text: "",
      createdAt: "Now",
      isMe: true,
      senderName: "You",
      groupNotification: {
        title,
        description: notificationDescription.trim() || undefined,
      },
    };

    setMessages((prev) => [...prev, notificationMessage]);
    setIsCreatingNotification(false);
    setNotificationTitle("");
    setNotificationDescription("");
  };

  // Hàm render từng tin nhắn trong FlatList.
  // Tại đây xử lý luôn:
  // - Hiển thị separator ngày (TODAY).
  // - Hiển thị tiêu đề người gửi, avatar trái/phải.
  // - Phân biệt 3 loại nội dung: text thường, file PDF (attachment card), poll.
  const renderMessage = ({ item }: { item: Message }) => {
    // Căn lề trái/phải tuỳ thuộc là tin nhắn của mình hay của người khác
    const containerStyle = item.isMe
      ? [stylesMsg.messageContainer, stylesMsg.messageRight]
      : [stylesMsg.messageContainer, stylesMsg.messageLeft];

    // Màu nền bubble
    const bubbleStyle = item.isMe
      ? [stylesMsg.bubble, stylesMsg.bubbleRight]
      : [stylesMsg.bubble, stylesMsg.bubbleLeft];

    // Màu chữ
    const textStyle = item.isMe
      ? [stylesMsg.messageText, stylesMsg.messageTextRight]
      : [stylesMsg.messageText, stylesMsg.messageTextLeft];

    const isAttachmentCard =
      item.hasAttachment && item.isMe && item.text.endsWith(".pdf");

    return (
      <>
        {/* Label thời gian (TODAY, YESTERDAY, ...) */}
        {item.showTimeAbove ? (
          <View style={stylesMsg.daySeparatorWrapper}>
            <View style={stylesMsg.daySeparatorLine} />
            <Text style={stylesMsg.daySeparatorText}>{item.showTimeAbove}</Text>
            <View style={stylesMsg.daySeparatorLine} />
          </View>
        ) : null}

        {/* Tên người gửi cho tin nhắn group (trừ khi là bạn và không cần hiển thị) */}
        {!item.isMe && item.senderName ? (
          <Text style={stylesMsg.senderLabel}>{item.senderName}</Text>
        ) : null}

        <View style={containerStyle}>
          {/* Avatar bên trái cho người khác, bên phải cho mình */}
          {!item.isMe && item.senderAvatarInitial ? (
            <View style={stylesMsg.senderAvatar}>
              <Text style={stylesMsg.senderAvatarText}>
                {item.senderAvatarInitial}
              </Text>
            </View>
          ) : null}

          <View style={bubbleStyle}>
            {/* Nội dung chính trong bubble: poll / meeting / reminder / notification / text / attachment */}
            {item.poll ? (
              <>
                <Text
                  style={[
                    textStyle,
                    item.isMe && stylesMsg.pollQuestionRight,
                  ]}
                >
                  📊 BÌNH CHỌN: {item.poll.question}
                </Text>
                {item.poll.options.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      stylesMsg.pollOption,
                      opt.votedByMe && stylesMsg.pollOptionSelected,
                      item.poll?.closed && stylesMsg.pollOptionDisabled,
                    ]}
                    onPress={() => handleVote(item.id, opt.id)}
                    disabled={item.poll?.closed}
                  >
                    <View style={stylesMsg.pollOptionTextWrapper}>
                      <Text
                        style={[
                          stylesMsg.pollOptionText,
                          opt.votedByMe && stylesMsg.pollOptionTextSelected,
                        ]}
                      >
                        {opt.text} {opt.votedByMe && "✔️"}
                      </Text>
                    </View>
                    <Text style={stylesMsg.pollOptionVotes}>
                      {opt.votes} vote{opt.votes !== 1 ? "s" : ""}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Hiển thị trạng thái hoặc nút đóng Poll */}
                {item.poll.closed ? (
                  <View style={stylesMsg.pollStatusBadge}>
                    <Text style={stylesMsg.pollStatusText}>Bình chọn đã kết thúc</Text>
                  </View>
                ) : item.isMe ? (
                  <TouchableOpacity
                    style={stylesMsg.closePollButton}
                    onPress={() => handleClosePoll(item.id)}
                  >
                    <Text style={stylesMsg.closePollButtonText}>Kết thúc bình chọn</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : item.meeting ? (
              <>
                <Text style={stylesMsg.meetingTitle}>{item.meeting.title}</Text>
                <View style={stylesMsg.meetingMetaRow}>
                  <Text style={stylesMsg.meetingTime}>{item.meeting.time}</Text>
                  {item.meeting.location ? (
                    <Text style={stylesMsg.meetingLocation}>
                      • {item.meeting.location}
                    </Text>
                  ) : null}
                </View>
              </>
            ) : item.reminder ? (
              <>
                <Text style={stylesMsg.reminderTitle}>
                  {item.reminder.title}
                </Text>
                <Text style={stylesMsg.reminderTime}>{item.reminder.time}</Text>
              </>
            ) : item.groupNotification ? (
              <>
                <Text style={stylesMsg.notificationTitle}>
                  {item.groupNotification.title}
                </Text>
                {item.groupNotification.description ? (
                  <Text style={stylesMsg.notificationDescription}>
                    {item.groupNotification.description}
                  </Text>
                ) : null}
              </>
            ) : !isAttachmentCard ? (
              <Text style={textStyle}>{item.text}</Text>
            ) : (
              <>
                <Text style={stylesMsg.messageTextRight}>
                  Q3_Marketing_Strategy_v2.pdf
                </Text>
                <View style={stylesMsg.attachmentCard}>
                  <View style={stylesMsg.attachmentIconWrapper}>
                    <Text style={stylesMsg.attachmentIcon}>📄</Text>
                  </View>
                  <View style={stylesMsg.attachmentTextBlock}>
                    <Text style={stylesMsg.attachmentTitle} numberOfLines={1}>
                      Q3_Marketing_Strategy_v2.pdf
                    </Text>
                    <Text style={stylesMsg.attachmentMeta}>
                      4.2 MB • PDF
                    </Text>
                  </View>
                  <TouchableOpacity style={stylesMsg.attachmentDownload}>
                    <Text style={stylesMsg.attachmentDownloadText}>⬇️</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {item.isMe ? (
            <View style={stylesMsg.senderAvatarRight}>
              <Text style={stylesMsg.senderAvatarText}>Y</Text>
            </View>
          ) : null}
        </View>

        <Text style={stylesMsg.timeLabel}>{item.createdAt}</Text>
      </>
    );
  };

  return (
    <>
      {/* Ẩn header mặc định của Expo Router, vì mình tự làm header custom phía dưới */}
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={stylesDetail.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {/* Header phía trên cùng */}
        <View style={stylesDetail.header}>
          {/* Nút back về màn hình danh sách */}
          <TouchableOpacity
            style={stylesDetail.headerButton}
            onPress={() => router.back()}
          >
            <Text style={stylesDetail.headerButtonText}>←</Text>
          </TouchableOpacity>

          {/* Avatar + tên + trạng thái nhóm */}
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
                  {online ? `${online} online` : "8 online"} • {" "}
                  <Text style={{ color: '#10B981', fontWeight: 'bold' }}>Realtime Active</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Nút gọi voice / video (demo) */}
          <View style={stylesDetail.headerActions}>
            <TouchableOpacity style={stylesDetail.headerIconButton}>
              <Text style={stylesDetail.headerIconText}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={stylesDetail.headerIconButton}>
              <Text style={stylesDetail.headerIconText}>🎥</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Khu vực danh sách tin nhắn */}
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={{ marginTop: 10, color: "#6B7280", fontWeight: "500" }}>
              Đang tải dữ liệu...
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={stylesDetail.messagesList}
          />
        )}

        {/* Khu vực tạo bình chọn (poll composer) nằm trên thanh nhập tin nhắn */}
        {isCreatingPoll && (
          <View style={stylesDetail.pollComposer}>
            <Text style={stylesDetail.pollComposerTitle}>New poll</Text>
            <TextInput
              style={stylesDetail.pollQuestionInput}
              placeholder="Poll question"
              placeholderTextColor="#9CA3AF"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOptionsDraft.map((opt, index) => (
              <TextInput
                key={index}
                style={stylesDetail.pollOptionInput}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor="#9CA3AF"
                value={opt}
                onChangeText={(text) => handleChangePollOption(index, text)}
              />
            ))}
            <View style={stylesDetail.pollActionsRow}>
              <TouchableOpacity onPress={handleAddPollOption}>
                <Text style={stylesDetail.pollActionsSecondary}>+ Add option</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => {
                  setIsCreatingPoll(false);
                  setPollQuestion("");
                  setPollOptionsDraft(["", ""]);
                }}
              >
                <Text style={stylesDetail.pollActionsSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={stylesDetail.pollSendButton}
                onPress={handleCreatePoll}
              >
                <Text style={stylesDetail.pollSendButtonText}>Send poll</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Khu vực tạo lịch họp */}
        {isCreatingMeeting && (
          <View style={stylesDetail.schedulerComposer}>
            <Text style={stylesDetail.schedulerTitle}>New meeting</Text>
            <TextInput
              style={stylesDetail.schedulerInput}
              placeholder="Meeting title"
              placeholderTextColor="#9CA3AF"
              value={meetingTitle}
              onChangeText={setMeetingTitle}
            />
            <TextInput
              style={stylesDetail.schedulerInput}
              placeholder="Time (e.g. Tomorrow, 3:00 PM)"
              placeholderTextColor="#9CA3AF"
              value={meetingTime}
              onChangeText={setMeetingTime}
            />
            <TextInput
              style={stylesDetail.schedulerInput}
              placeholder="Location (optional)"
              placeholderTextColor="#9CA3AF"
              value={meetingLocation}
              onChangeText={setMeetingLocation}
            />
            <View style={stylesDetail.schedulerActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  setIsCreatingMeeting(false);
                  setMeetingTitle("");
                  setMeetingTime("");
                  setMeetingLocation("");
                }}
              >
                <Text style={stylesDetail.pollActionsSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={stylesDetail.schedulerPrimaryButton}
                onPress={handleCreateMeeting}
              >
                <Text style={stylesDetail.schedulerPrimaryButtonText}>
                  Create meeting
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Khu vực tạo nhắc việc */}
        {isCreatingReminder && (
          <View style={stylesDetail.schedulerComposer}>
            <Text style={stylesDetail.schedulerTitle}>New reminder</Text>
            <TextInput
              style={stylesDetail.schedulerInput}
              placeholder="Reminder title"
              placeholderTextColor="#9CA3AF"
              value={reminderTitle}
              onChangeText={setReminderTitle}
            />
            <TextInput
              style={stylesDetail.schedulerInput}
              placeholder="Time (e.g. Today, 5:00 PM)"
              placeholderTextColor="#9CA3AF"
              value={reminderTime}
              onChangeText={setReminderTime}
            />
            <View style={stylesDetail.schedulerActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  setIsCreatingReminder(false);
                  setReminderTitle("");
                  setReminderTime("");
                }}
              >
                <Text style={stylesDetail.pollActionsSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={stylesDetail.schedulerPrimaryButton}
                onPress={handleCreateReminder}
              >
                <Text style={stylesDetail.schedulerPrimaryButtonText}>
                  Create reminder
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Khu vực tạo thông báo nhóm */}
        {isCreatingNotification && (
          <View style={stylesDetail.schedulerComposer}>
            <Text style={stylesDetail.schedulerTitle}>New group announcement</Text>
            <TextInput
              style={stylesDetail.schedulerInput}
              placeholder="Title"
              placeholderTextColor="#9CA3AF"
              value={notificationTitle}
              onChangeText={setNotificationTitle}
            />
            <TextInput
              style={[stylesDetail.schedulerInput, { height: 70 }]}
              placeholder="Description (optional)"
              placeholderTextColor="#9CA3AF"
              value={notificationDescription}
              onChangeText={setNotificationDescription}
              multiline
            />
            <View style={stylesDetail.schedulerActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  setIsCreatingNotification(false);
                  setNotificationTitle("");
                  setNotificationDescription("");
                }}
              >
                <Text style={stylesDetail.pollActionsSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={stylesDetail.schedulerPrimaryButton}
                onPress={handleCreateNotification}
              >
                <Text style={stylesDetail.schedulerPrimaryButtonText}>
                  Send announcement
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Thanh nhập tin nhắn phía dưới */}
        <View style={stylesDetail.inputBar}>
          {/* Nút thêm file / icon (demo) */}
          <TouchableOpacity style={stylesDetail.inputIconButton}>
            <Text style={stylesDetail.inputIconText}>＋</Text>
          </TouchableOpacity>

          {/* Nút bật composer bình chọn */}
          <TouchableOpacity
            style={[stylesDetail.inputIconButton, { marginRight: 6 }]}
            onPress={() => setIsCreatingPoll((prev) => !prev)}
          >
            <Text style={stylesDetail.inputIconText}>📊</Text>
          </TouchableOpacity>

          {/* Nút mở nhanh các composer lịch làm việc */}
          <TouchableOpacity
            style={[stylesDetail.inputIconButton, { marginRight: 6 }]}
            onPress={() => {
              setIsCreatingMeeting((prev) => !prev);
              setIsCreatingReminder(false);
              setIsCreatingNotification(false);
            }}
          >
            <Text style={stylesDetail.inputIconText}>📅</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[stylesDetail.inputIconButton, { marginRight: 6 }]}
            onPress={() => {
              setIsCreatingReminder((prev) => !prev);
              setIsCreatingMeeting(false);
              setIsCreatingNotification(false);
            }}
          >
            <Text style={stylesDetail.inputIconText}>⏰</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[stylesDetail.inputIconButton, { marginRight: 6 }]}
            onPress={() => {
              setIsCreatingNotification((prev) => !prev);
              setIsCreatingMeeting(false);
              setIsCreatingReminder(false);
            }}
          >
            <Text style={stylesDetail.inputIconText}>📢</Text>
          </TouchableOpacity>

          {/* Ô nhập text */}
          <TextInput
            style={stylesDetail.input}
            placeholder="Type a message"
            placeholderTextColor="#9CA3AF"
            value={inputValue}
            onChangeText={setInputValue}
            multiline
          />

          {/* Nút gửi, disable khi không có gì để gửi */}
          <TouchableOpacity
            style={[
              stylesDetail.sendButton,
              !inputValue.trim() && { opacity: 0.5 },
            ]}
            onPress={handleSend}
            disabled={!inputValue.trim()}
          >
            <Text style={stylesDetail.sendButtonText}>
              {inputValue.trim() ? "➤" : "🎤"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
};

export default ChatDetailScreen;

// Style cho phần layout tổng thể, header, input bar
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
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pollComposer: {
    marginHorizontal: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  pollComposerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  pollQuestionInput: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D1D5DB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: "#111827",
    marginBottom: 8,
  },
  pollOptionInput: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: "#111827",
    marginBottom: 6,
  },
  pollActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  pollActionsSecondary: {
    fontSize: 13,
    color: "#6B7280",
    marginHorizontal: 8,
  },
  pollSendButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    marginLeft: 4,
  },
  pollSendButtonText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  schedulerComposer: {
    marginHorizontal: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  schedulerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  schedulerInput: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D1D5DB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: "#111827",
    marginBottom: 8,
  },
  schedulerActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
  },
  schedulerPrimaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    marginLeft: 8,
  },
  schedulerPrimaryButtonText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D1D5DB",
  },
  inputIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  inputIconText: {
    fontSize: 18,
    color: "#4B5563",
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
  },
  sendButton: {
    marginLeft: 6,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

// Style riêng cho bubble tin nhắn
const stylesMsg = StyleSheet.create({
  messageContainer: {
    marginVertical: 6,
    maxWidth: "80%",
  },
  messageLeft: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "flex-end",
  },
  messageRight: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "flex-end",
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleLeft: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderTopLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },
  bubbleRight: {
    backgroundColor: "#2563EB",
    borderRadius: 18,
    borderTopRightRadius: 6,
  },
  messageText: {
    fontSize: 14,
  },
  messageTextLeft: {
    color: "#111827",
  },
  messageTextRight: {
    color: "#FFFFFF",
  },
  senderLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    marginLeft: 52,
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  senderAvatarRight: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  senderAvatarText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  timeLabel: {
    marginTop: 2,
    fontSize: 10,
    color: "#9CA3AF",
    alignSelf: "flex-end",
  },
  daySeparatorWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  daySeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
  },
  daySeparatorText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  attachmentCard: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  attachmentIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  attachmentIcon: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  attachmentTextBlock: {
    flex: 1,
  },
  attachmentTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  attachmentMeta: {
    fontSize: 11,
    color: "#BFDBFE",
  },
  attachmentDownload: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  attachmentDownloadText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  pollQuestionRight: {
    marginBottom: 8,
  },
  pollOption: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pollOptionSelected: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  pollOptionTextWrapper: {
    flex: 1,
    marginRight: 8,
  },
  pollOptionText: {
    fontSize: 13,
    color: "#E5E7EB",
  },
  pollOptionTextSelected: {
    fontWeight: "600",
    color: "#FFFFFF",
  },
  pollOptionVotes: {
    fontSize: 12,
    color: "#BFDBFE",
  },
  pollOptionDisabled: {
    opacity: 0.6,
  },
  pollStatusBadge: {
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    alignSelf: "center",
  },
  pollStatusText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  closePollButton: {
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.5)",
    alignItems: "center",
  },
  closePollButtonText: {
    fontSize: 13,
    color: "#FCA5A5",
    fontWeight: "600",
  },
  meetingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  meetingMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  meetingTime: {
    fontSize: 12,
    color: "#BFDBFE",
  },
  meetingLocation: {
    fontSize: 12,
    color: "#BFDBFE",
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  reminderTime: {
    fontSize: 12,
    color: "#BFDBFE",
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  notificationDescription: {
    fontSize: 13,
    color: "#E5E7EB",
  },
});


