/**
 * G005 RIS v3.0.6.11-33 - Notifications Controller
 */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "../common/decorators/roles.decorator";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { currentUserId } from "../common/auth/current-user";
import {
  NotificationsService,
  CreateNotificationDto,
} from "./notifications.service";

const CreateSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["CRITICAL", "REPORT", "TASK", "SYSTEM", "APPOINTMENT"]),
  severity: z.enum(["INFO", "WARN", "ERROR", "CRITICAL"]).optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  link: z.string().optional(),
  targetId: z.string().optional(),
});

const BroadcastSchema = z.object({
  userIds: z.array(z.string()).min(1),
  type: z.enum(["CRITICAL", "REPORT", "TASK", "SYSTEM", "APPOINTMENT"]),
  severity: z.enum(["INFO", "WARN", "ERROR", "CRITICAL"]).optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  link: z.string().optional(),
  targetId: z.string().optional(),
});

const PushSubscriptionSchema = z.object({
  userId: z.string().min(1),
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  topics: z.array(z.string()).optional(),
});

const PushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

const PushSendSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  url: z.string().optional(),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
});

// [v3.0.6.11-99 Wave 5B-C] 报表生成完成推送 (定时报表执行器/报表模块内部调用)
const ReportGeneratedSchema = z.object({
  reportId: z.string().min(1),
  reportName: z.string().min(1),
  recipients: z.array(z.string().min(1)).min(1),
  summary: z.string().optional(),
  link: z.string().optional(),
});

// [v3.0.6.11-99 Wave7B] 站内信/推送订阅类型: 危急值/报告完成/随访提醒/质控通知/系统公告
const UpdateSubscriptionSchema = z.object({
  types: z.array(
    z.enum(["CRITICAL", "REPORT", "FOLLOWUP", "QUALITY", "SYSTEM"]),
  ),
});

// [v3.0.6.11-104 Wave 1C] 历史列表分页 + 类型筛选 (limit 兼容既有调用, 上限 200)
export const HistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  type: z.string().max(40).optional(),
});

@ApiTags("notifications")
@ApiBearerAuth()
@Roles("ADMIN", "DIRECTOR")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  /**
   * 读路径的目标用户: 一律取调用者自身 (JWT payload 的 sub)。
   * 请求里带的 userId 不作为授权依据 —— 传入他人 id 时按调用者自身数据返回。
   */
  private readUserId(req: Request): string {
    return currentUserId(req);
  }

  /**
   * 写路径的目标用户: 必须与调用者一致, 否则 403
   * (禁止把他人通知标记已读 / 改写他人偏好与订阅)。
   */
  private writeUserId(req: Request, userId: string): string {
    const self = currentUserId(req);
    if (userId !== self) {
      throw new ForbiddenException(
        "Not allowed to operate on another user's notifications",
      );
    }
    return self;
  }

  @Get("unread/:userId")
  unread(@Param("userId") userId: string, @Req() req: Request) {
    return this.service.getUnreadCount(this.readUserId(req));
  }

  /**
   * [v3.0.6.16-7] 通知分页列表。
   * 前端 notificationTemplateDictApi.listNotifications 一直调用此路径,
   * 后端此前只有 @Post() 创建 —— 生产 404。静态路径需在动态段之前注册。
   */
  @Get()
  list(
    @Query("userId") userId: string | undefined,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Query("type") type: string | undefined,
    @Req() req: Request,
  ) {
    return this.service.list({
      userId: this.readUserId(req),
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      type,
    });
  }

  // [v3.0.6.11-99 Wave 10D] 通知总览 (按类型/未读/今日) — 静态子路由先于 :id 注册
  @Get("overview")
  overview(@Query("userId") userId: string | undefined, @Req() req: Request) {
    return this.service.getOverview(this.readUserId(req));
  }

  // [v3.0.6.11-99 Wave 10D] 近 30 日通知趋势
  @Get("daily-trend")
  dailyTrend(
    @Query("days") days: string | undefined,
    @Query("userId") userId: string | undefined,
    @Req() req: Request,
  ) {
    return this.service.getDailyTrend(Number(days ?? 30), this.readUserId(req));
  }

  // [v3.0.6.11-99 Wave 10D] 用户偏好 (类型开关 + 渠道 + 免打扰)
  @Get("preferences/:userId")
  preferences(@Param("userId") userId: string, @Req() req: Request) {
    return this.service.getPreferences(this.readUserId(req));
  }

  @Put("preferences/:userId")
  @HttpCode(HttpStatus.OK)
  updatePreferences(
    @Param("userId") userId: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          types: z
            .array(
              z.enum(["CRITICAL", "REPORT", "FOLLOWUP", "QUALITY", "SYSTEM"]),
            )
            .optional(),
          channels: z.record(z.boolean()).optional(),
          quietHours: z
            .object({ enabled: z.boolean(), from: z.string(), to: z.string() })
            .optional(),
        }),
      ),
    )
    body: {
      types?: string[];
      channels?: Record<string, boolean>;
      quietHours?: { enabled: boolean; from: string; to: string };
    },
    @Req() req: Request,
  ) {
    return this.service.updatePreferences(this.writeUserId(req, userId), body);
  }

  @Get("history/:userId")
  history(
    @Param("userId") userId: string,
    @Query(new ZodValidationPipe(HistoryQuerySchema))
    query: z.infer<typeof HistoryQuerySchema>,
    @Req() req: Request,
  ) {
    const pageSize = query.limit ?? query.pageSize;
    const skip = (query.page - 1) * pageSize;
    return this.service.getHistory(
      this.readUserId(req),
      pageSize,
      skip,
      query.type,
    );
  }

  @Get("stats/:userId")
  stats(@Param("userId") userId: string, @Req() req: Request) {
    return this.service.getStats(this.readUserId(req));
  }

  @Post("read/:id")
  read(@Param("id") id: string, @Req() req: Request) {
    return this.service.markRead(id, this.readUserId(req));
  }

  @Post("read-all/:userId")
  readAll(@Param("userId") userId: string, @Req() req: Request) {
    return this.service.markAllRead(this.writeUserId(req, userId));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: Request) {
    return this.service.remove(id, this.readUserId(req));
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateSchema)) body: CreateNotificationDto,
  ) {
    return this.service.create(body);
  }

  @Post("broadcast")
  @HttpCode(HttpStatus.CREATED)
  broadcast(
    @Body(new ZodValidationPipe(BroadcastSchema))
    body: z.infer<typeof BroadcastSchema>,
  ) {
    const { userIds, ...dto } = body;
    return this.service.broadcast(userIds, dto);
  }

  @Post("push-subscribe")
  @HttpCode(HttpStatus.CREATED)
  pushSubscribe(
    @Body(new ZodValidationPipe(PushSubscriptionSchema))
    body: {
      userId: string;
      endpoint: string;
      keys: { p256dh: string; auth: string };
      topics?: string[];
    },
  ) {
    return this.service.savePushSubscription(body.userId, body);
  }

  @Post("push-unsubscribe")
  @HttpCode(HttpStatus.OK)
  pushUnsubscribe(
    @Body(new ZodValidationPipe(PushUnsubscribeSchema))
    body: {
      endpoint: string;
    },
  ) {
    return this.service.removePushSubscription(body.endpoint);
  }

  @Get("vapid-public-key")
  vapidPublicKey() {
    const publicKey = this.service.getVapidPublicKey();
    if (!publicKey) {
      throw new ServiceUnavailableException({
        publicKey: null,
        error:
          "VAPID 未配置: 请设置 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 环境变量后重启服务",
      });
    }
    return { publicKey };
  }

  @Post("push-send")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  pushSend(
    @Body(new ZodValidationPipe(PushSendSchema))
    body: {
      userId: string;
      title: string;
      content: string;
      url?: string;
      tag?: string;
      requireInteraction?: boolean;
    },
  ) {
    return this.service.sendPush(body.userId, body);
  }

  // [v3.0.6.11-99 Wave 5B-C] 报表生成完成推送 (内部端点; Wave 5A 调度落地后由执行器联动)
  @Post("report-generated")
  @HttpCode(HttpStatus.CREATED)
  reportGenerated(
    @Body(new ZodValidationPipe(ReportGeneratedSchema))
    body: z.infer<typeof ReportGeneratedSchema>,
  ) {
    return this.service.reportGenerated(body);
  }

  // [v3.0.6.11-99 Wave7B] 站内信/推送订阅管理:
  //   GET /notifications/subscriptions/:userId  (查订阅类型)
  //   PUT /notifications/subscriptions/:userId  (更新订阅类型, body { types: [...] })
  @Get("subscriptions/:userId")
  subscriptions(@Param("userId") userId: string, @Req() req: Request) {
    return this.service.getSubscriptionConfig(this.readUserId(req));
  }

  @Put("subscriptions/:userId")
  @HttpCode(HttpStatus.OK)
  updateSubscriptions(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(UpdateSubscriptionSchema))
    body: {
      types: Array<"CRITICAL" | "REPORT" | "FOLLOWUP" | "QUALITY" | "SYSTEM">;
    },
    @Req() req: Request,
  ) {
    return this.service.updateSubscriptionConfig(
      this.writeUserId(req, userId),
      body.types,
    );
  }
}
