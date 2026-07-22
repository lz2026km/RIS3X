import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TeleService } from './tele.service'
import type { Session, SignalMessage, ChatMessage, CursorPosition } from './tele.service'

const CreateSessionSchema = z.object({
  hostId: z.string().min(1),
  hostName: z.string().min(1),
  studyUids: z.array(z.string()).default([]),
})

const JoinSessionSchema = z.object({
  sessionId: z.string().min(1),
  guestId: z.string().min(1),
  guestName: z.string().min(1),
})

const SignalSchema = z.object({
  type: z.enum(['offer', 'answer', 'ice-candidate']),
  from: z.string().min(1),
  to: z.string().min(1),
  sessionId: z.string().min(1),
  payload: z.unknown(),
})

const ChatSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  text: z.string().min(1),
})

const CursorSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  x: z.number(),
  y: z.number(),
  color: z.string().default('#3b82f6'),
})

@ApiTags('tele')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('tele')
export class TeleController {
  constructor(private readonly service: TeleService) {}

  @Post('session')
  createSession(@Body(new ZodValidationPipe(CreateSessionSchema)) body: z.infer<typeof CreateSessionSchema>) {
    return this.service.createSession(body.hostId, body.hostName, body.studyUids)
  }

  @Post('join')
  joinSession(@Body(new ZodValidationPipe(JoinSessionSchema)) body: z.infer<typeof JoinSessionSchema>) {
    return this.service.joinSession(body.sessionId, body.guestId, body.guestName)
  }

  @Post('signal')
  handleSignal(@Body(new ZodValidationPipe(SignalSchema)) body: z.infer<typeof SignalSchema>) {
    this.service.storeSignal(body.sessionId, body)
    return { ok: true }
  }

  @Get('signal/:sessionId')
  getPendingSignals(
    @Param('sessionId') sessionId: string,
    @Query('peer') peer: string,
  ) {
    return this.service.getPendingSignals(sessionId, peer)
  }

  @Get('session/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    const session = this.service.getSession(sessionId)
    if (!session) return { status: 'not_found' }
    return session
  }

  @Delete('session/:sessionId')
  endSession(@Param('sessionId') sessionId: string) {
    this.service.endSession(sessionId)
    return { ok: true }
  }

  @Post('chat')
  sendChat(@Body(new ZodValidationPipe(ChatSchema)) body: z.infer<typeof ChatSchema>) {
    const msg = this.service.addChatMessage({
      sessionId: body.sessionId,
      userId: body.userId,
      userName: body.userName,
      text: body.text,
      timestamp: new Date().toISOString(),
    })
    return msg
  }

  @Get('chat/:sessionId')
  getChat(
    @Param('sessionId') sessionId: string,
    @Query('since') since?: string,
  ) {
    return this.service.getChatMessages(sessionId, since)
  }

  @Post('cursor')
  updateCursor(@Body(new ZodValidationPipe(CursorSchema)) body: z.infer<typeof CursorSchema>) {
    this.service.updateCursor({
      sessionId: body.sessionId,
      userId: body.userId,
      userName: body.userName,
      x: body.x,
      y: body.y,
      color: body.color,
      timestamp: Date.now(),
    })
    return { ok: true }
  }

  @Get('cursor/:sessionId')
  getCursors(@Param('sessionId') sessionId: string) {
    return this.service.getCursors(sessionId)
  }
}
