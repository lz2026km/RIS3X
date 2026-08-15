/**
 * G005 RIS v3.0.6.11-100 Wave 3A (G-19) — LLM provider id zod schema
 */
import { z } from 'zod'

export const LlmProviderIdSchema = z.enum(['mock', 'deepseek', 'hunyuan'])
