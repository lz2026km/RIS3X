import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AuditService } from "../../modules/audit/audit.service";

const AUDITED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_FIELDS =
  /password|secret|token|authorization|cookie|credential|key/i;

/**
 * [v3.0.6.16-9] PHI 读取审计 (HIPAA §164.312(b) / 等保 "访问审计").
 *
 * 此前本拦截器只审计写操作 (POST/PUT/PATCH/DELETE), **GET 全部跳过** ——
 * 系统无法回答「谁在何时查看了某患者影像/报告」这一合规必答问题。
 * 这里对「带对象 id 或 patientId 的 PHI 读取」补记 `PHI_VIEW:<path>`;
 * 列表类 GET 不审计, 避免审计表被浏览行为淹没。
 */
const PHI_READ_PATTERNS: RegExp[] = [
  /^\/patients?\b/i,
  /\/reports?\b/i,
  /\/critical(-?values?|-v2|-ext|-alert)?\b/i,
  /\/dicom/i,
  /\/studies\b/i,
  /\/series\b/i,
  /\/instances\b/i,
  /\/eye\/pacs\b/i,
  /\/vna\b/i,
  /\/patient-portal\b/i,
];
/** 只有指向「具体对象」的读取才算 PHI 访问 (含路径 id 或 patientId 查询参数) */
function isPhiReadPath(path: string, hasObjectId: boolean): boolean {
  if (!hasObjectId) return false;
  return PHI_READ_PATTERNS.some((re) => re.test(path));
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      baseUrl?: string;
      route?: { path?: string };
      originalUrl?: string;
      url?: string;
      user?: { sub?: string };
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      params?: Record<string, string>;
      query?: Record<string, unknown>;
      body?: unknown;
    }>();
    const method = request.method?.toUpperCase() ?? "UNKNOWN";
    const routePath = this.routePath(request);
    const objectId =
      request.params?.["id"] ??
      request.params?.["patientId"] ??
      request.params?.["studyId"] ??
      request.params?.["reportId"] ??
      undefined;
    const query = request.query as Record<string, unknown> | undefined;
    const phiRead =
      method === "GET" &&
      isPhiReadPath(
        routePath,
        Boolean(objectId || query?.["patientId"] || query?.["reportId"]),
      );
    if (!AUDITED_METHODS.has(method) && !phiRead) return next.handle();

    const action = phiRead ? `PHI_VIEW:${routePath}` : `${method}:${routePath}`;
    const userId = request.user?.sub;
    const ip = request.ip ?? "unknown";
    const rawUserAgent = request.headers?.["user-agent"];
    const userAgent =
      typeof rawUserAgent === "string" ? rawUserAgent.slice(0, 512) : "";
    const resourceId = objectId ?? (query?.["patientId"] as string | undefined);
    const fields = this.changedFields(request.body);

    return next.handle().pipe(
      tap({
        next: () =>
          this.record({
            userId,
            action,
            resource: routePath,
            resourceId,
            detail: {
              method,
              fields,
              ...(phiRead
                ? { phi: true, patientId: query?.["patientId"] }
                : {}),
            },
            ip,
            userAgent,
            success: true,
          }),
        error: (error: unknown) =>
          this.record({
            userId,
            action,
            resource: routePath,
            resourceId,
            detail: {
              method,
              error: error instanceof Error ? error.name : "UnknownError",
              statusCode:
                error instanceof HttpException ? error.getStatus() : 500,
            },
            ip,
            userAgent,
            success: false,
          }),
      }),
    );
  }

  private routePath(request: {
    baseUrl?: string;
    route?: { path?: string };
    originalUrl?: string;
    url?: string;
  }): string {
    const route = request.route?.path;
    const path = route
      ? `${request.baseUrl ?? ""}${route === "/" ? "" : route}`
      : (request.originalUrl ?? request.url ?? "/").split("?")[0];
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return normalized.replace(/^\/api(?=\/)/, "") || "/";
  }

  private changedFields(body: unknown): string[] {
    if (!body || typeof body !== "object" || Array.isArray(body)) return [];
    return Object.keys(body as Record<string, unknown>)
      .filter((field) => !SENSITIVE_FIELDS.test(field))
      .slice(0, 50);
  }

  private record(entry: Parameters<AuditService["log"]>[0]): void {
    try {
      const promise = this.audit.log(entry);
      if (promise && typeof promise.catch === "function") {
        void promise.catch((error: unknown) => {
          this.logger.error(
            "Failed to persist audit log",
            error instanceof Error ? error.stack : undefined,
          );
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        "Failed to persist audit log",
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
