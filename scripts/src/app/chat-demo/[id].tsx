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
type Message = {
  id: string;
  text: string;
  createdAt: string; // có thể là "10:15 AM", "10:20 AM", ...
  isMe: boolean; // true: tin nhắn của mình, false: tin nhắn của người khác
  showTimeAbove?: string; // label thời gian nhóm, ví dụ "TODAY"
  senderName?: string; // tên người gửi (cho group chat)
  senderAvatarInitial?: string; // chữ cái đầu avatar
  hasAttachment?: boolean; // message có kèm file card không
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
// Khi tích hợp API thật, bạn chỉ cần thay thế MOCK_MESSAGES bằng dữ liệu từ server.
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

  // Lấy tham số từ URL: /chat-demo/[id]?name=Marketing%20Team&members=24&online=8
  // -> Cho phép màn hình này hiển thị đúng tiêu đề / thông tin nhóm khi điều hướng từ màn khác.
  const { id, name, members, online } = useLocalSearchParams<{
    id: string;
    name?: string;
    members?: string;
    online?: string;
  }>();

  // State chứa danh sách tin nhắn hiện tại (mock + tin nhắn/poll do user gửi trong phiên)
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);

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
  const handleVote = (messageId: string, optionId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.poll || msg.poll.closed) return msg;

        const allowMulti = msg.poll.allowMulti;
        const updatedOptions = msg.poll.options.map((opt) => {
          if (opt.id !== optionId) {
            // Nếu không cho chọn nhiều, bỏ chọn các option khác
            return allowMulti
              ? opt
              : { ...opt, votedByMe: false, votes: opt.votedByMe ? Math.max(opt.votes - 1, 0) : opt.votes };
          }

          const alreadyVoted = !!opt.votedByMe;
          // Toggle vote
          return {
            ...opt,
            votedByMe: !alreadyVoted,
            votes: alreadyVoted ? Math.max(opt.votes - 1, 0) : opt.votes + 1,
          };
        });

        return {
          ...msg,
          poll: {
            ...msg.poll,
            options: updatedOptions,
          },
        };
      })
    );
  };

  // Hàm tạo message bình chọn mới từ dữ liệu trong composer:
  // - Cần ít nhất 1 câu hỏi + 2 lựa chọn hợp lệ.
  // - Sau khi tạo xong, reset lại state composer.
  const handleCreatePoll = () => {
    const trimmedQuestion = pollQuestion.trim();
    const cleanedOptions = pollOptionsDraft
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);

    if (!trimmedQuestion || cleanedOptions.length < 2) {
      return;
    }

    const pollMessage: Message = {
      id: Date.now().toString(),
      text: "",
      createdAt: "Now",
      isMe: true,
      senderName: "You",
      poll: {
        question: trimmedQuestion,
        options: cleanedOptions.map((text, index) => ({
          id: `opt-${index}`,
          text,
          votes: 0,
        })),
      },
    };

    setMessages((prev) => [...prev, pollMessage]);
    setIsCreatingPoll(false);
    setPollQuestion("");
    setPollOptionsDraft(["", ""]);
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
                  {item.poll.question}
                </Text>
                {item.poll.options.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      stylesMsg.pollOption,
                      opt.votedByMe && stylesMsg.pollOptionSelected,
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
                        {opt.text}
                      </Text>
                    </View>
                    <Text style={stylesMsg.pollOptionVotes}>
                      {opt.votes} vote{opt.votes !== 1 ? "s" : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                  {online ? `${online} online` : "8 online"}
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
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={stylesDetail.messagesList}
        />

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

