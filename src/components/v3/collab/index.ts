/**
 * G005 放射RIS系统 v3.0.1 - 协同 + 危急值 + 消息组件统一导出
 * 对标厂商:飞利浦 / 联影 / 卫宁
 */
export {
  MentionPicker,
  SAMPLE_USERS,
  type MentionPickerProps,
  type MentionUser,
} from "./MentionPicker";
export {
  ChatRoom,
  type ChatRoomProps,
  type ChatMessage,
  type MessageType,
} from "../messages/ChatRoom";
export {
  CriticalEscalation,
  type CriticalEscalationProps,
  type CriticalEscalationConfig,
  type EscalationEvent,
  type EsclateLevel,
} from "./CriticalEscalation";
