import { Module } from "@nestjs/common";
import { EyeService } from "./eye.service";
import { EyeController } from "./eye.controller";
import { EyeReportAiController } from "./eye-report-ai.controller";
import { EyeReportAiService } from "./eye-report-ai.service";

@Module({
  controllers: [EyeController, EyeReportAiController],
  providers: [EyeService, EyeReportAiService],
})
export class EyeModule {}
