/**
 * G005 RIS v3.0.6.16-6 — 眼科报告 AI 辅助 Controller
 *
 *   POST /eye/report/ai/continue      续写
 *   POST /eye/report/ai/rewrite       改写
 *   POST /eye/report/nlp/extract      NLP 结构化提取
 *   POST /eye/report/voice/transcribe 语音转写 (未配置 ASR 时如实返回错误)
 *   POST /eye/report/ai/feedback      反馈登记
 */
import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  EyeReportAiService,
  ContinueRequest,
  RewriteRequest,
  ExtractRequest,
  TranscribeRequest,
  FeedbackRequest,
} from "./eye-report-ai.service";

@ApiTags("eye")
@ApiBearerAuth()
@Controller("eye/report")
export class EyeReportAiController {
  constructor(private readonly svc: EyeReportAiService) {}

  @Post("ai/continue")
  continue(@Body() body: ContinueRequest) {
    return this.svc.continue(body);
  }

  @Post("ai/rewrite")
  rewrite(@Body() body: RewriteRequest) {
    return this.svc.rewrite(body);
  }

  @Post("nlp/extract")
  extract(@Body() body: ExtractRequest) {
    return this.svc.extract(body);
  }

  @Post("voice/transcribe")
  transcribe(@Body() body: TranscribeRequest) {
    return this.svc.transcribe(body);
  }

  @Post("ai/feedback")
  feedback(@Body() body: FeedbackRequest) {
    return this.svc.feedback(body);
  }
}
