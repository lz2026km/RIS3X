export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiChatRequest {
  messages: AiChatMessage[]
  temperature?: number
  maxTokens?: number
}

export interface AiProviderInfo {
  id: string
  name: string
  available: boolean
}

export interface AiProvider {
  readonly info: AiProviderInfo
  chat(req: AiChatRequest): Promise<string>
}
