import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BackupService } from "./backup.service";
import { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  BackupCreateQuerySchema,
  BackupRestoreParamSchema,
} from "./backup.schema";

@ApiTags("backup")
@Controller("backup")
@ApiBearerAuth()
@Roles("ADMIN", "DIRECTOR")
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Post()
  @ApiOperation({ summary: "创建备份" })
  create(
    @Query(new ZodValidationPipe(BackupCreateQuerySchema))
    query: { type?: string },
    @Req() req: { user: { sub: string } },
  ) {
    return this.backup.createBackup(query.type || "FULL", req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: "备份列表" })
  list(@Query() query: { page?: string; pageSize?: string; type?: string }) {
    return this.backup.listBackups({
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      type: query.type,
    });
  }

  @Get(":id/download")
  @ApiOperation({ summary: "下载备份文件" })
  async download(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const record = await this.backup.getBackupFilePath(id);
    const filename = path.basename(record.filePath!);
    const filestream = fs.createReadStream(record.filePath!);
    res.set({
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": (record.sizeBytes ?? 0).toString(),
    });
    return new StreamableFile(filestream);
  }

  @Post(":id/restore")
  @ApiOperation({ summary: "恢复备份" })
  restore(
    @Param("id", new ZodValidationPipe(BackupRestoreParamSchema)) id: string,
  ) {
    return this.backup.restoreBackup(id);
  }
}
