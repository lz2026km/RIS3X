export type Notification = { id: string; type: string; title: string; body: string; };
export type NotificationChannel = { type: 'sms' | 'email' | 'push' | 'voice'; enabled: boolean; };
export type SmsConfig = { provider: string; apiKey: string; };
export type VoiceConfig = { provider: string; voiceId: string; };

export type NotificationProviderConfig = any;
export type IVRMenu = any;
export type EscalationChain = any;
export type IVRMenuItem = any;
export type SmsPayload = any;
export type SendResult = any;
export type SmsStatus = any;
export type VoicePayload = any;
export type VoiceStatus = any;
export type SmsRecipient = any;
export type EscalationChainNode = any;
