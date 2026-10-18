/**
 * G005 RIS v3.0.6.16-6 — 报告分发 Controller
 *
 *   GET    /dist/tasks               任务列表
 *   GET    /dist/tasks/:id           单任务
 *   POST   /dist/tasks               入队分发任务
 *   POST   /dist/tasks/:id/retry     重试
 *   GET    /dist/channels            渠道列表
 */
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DistService, CreateDistTaskDto } from "./dist.service";

@ApiTags("dist")
@ApiBearerAuth()
@Controller("dist")
export class DistController {
  constructor(private readonly svc: DistService) {}

  @Get("tasks")
  listTasks(
    @Query("status") status?: string,
    @Query("channel") channel?: string,
    @Query("reportId") reportId?: string,
  ) {
    return this.svc.listTasks({ status, channel, reportId });
  }

  @Get("tasks/:id")
  getTask(@Param("id") id: string) {
    return this.svc.getTask(id);
  }

  @Post("tasks")
  createTask(@Body() body: CreateDistTaskDto) {
    return this.svc.createTask(body);
  }

  @Post("tasks/:id/retry")
  retryTask(@Param("id") id: string) {
    return this.svc.retryTask(id);
  }

  @Get("channels")
  listChannels() {
    return this.svc.listChannels();
  }
}
