import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { Roles } from "../common/decorators/roles.decorator";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FhirService } from "./fhir.service";
import { FhirCapabilityService } from "./fhir-capability.service";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  CreatePatientSchema,
  CreateSubscriptionSchema,
  UpdatePatientSchema,
} from "./fhir.schema";
import { z } from "zod";

type CreatePatientDto = z.infer<typeof CreatePatientSchema>;
type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>;
type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;

@ApiTags("fhir")
@Controller("fhir/r4")
@ApiBearerAuth()
@Roles("ADMIN", "DIRECTOR", "DOCTOR", "TECHNICIAN")
export class FhirController {
  constructor(
    private readonly service: FhirService,
    private readonly capability: FhirCapabilityService,
  ) {}

  // --- CapabilityStatement ---
  // [G005 v3.0.6.16-0] 此前后端没有 metadata 端点, 前端硬编码了一份含
  // `SMART: true` / `create` / `update` 的 CapabilityStatement 对客户超报能力。
  // 现改为由实际路由推导, 并且 SMART 显式为 false。
  @Get("metadata")
  metadata(
    @Req() req?: { protocol?: string; get?: (k: string) => string | undefined },
  ) {
    const proto = req?.protocol ?? "https";
    const host = req?.get?.("host") ?? "localhost";
    const baseUrl = `${proto}://${host}`;
    return {
      ...this.capability.capabilityStatement(baseUrl),
      gaps: this.capability.gaps(),
      supportedResourceTypes: this.capability.supportedResourceTypes(),
    };
  }

  // --- Patient ---
  @Get("Patient/:id")
  readPatient(@Param("id") id: string) {
    return this.service.readPatient(id);
  }

  @Get("Patient")
  searchPatient(
    @Query("name") name?: string,
    @Query("identifier") identifier?: string,
    @Query("birthdate") birthdate?: string,
    @Query("_count") _count?: string,
  ) {
    return this.service.searchPatient({ name, identifier, birthdate, _count });
  }

  @Post("Patient")
  @HttpCode(HttpStatus.CREATED)
  createPatient(
    @Body(new ZodValidationPipe(CreatePatientSchema)) body: CreatePatientDto,
  ) {
    return this.service.createPatient(body);
  }

  @Put("Patient/:id")
  updatePatient(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdatePatientSchema)) body: UpdatePatientDto,
  ) {
    return this.service.updatePatient(id, body);
  }

  @Delete("Patient/:id")
  deletePatient(@Param("id") id: string) {
    return this.service.deletePatient(id);
  }

  @Get("Patient/:id/$everything")
  patientEverything(@Param("id") id: string) {
    return this.service.patientEverything(id);
  }

  // --- Observation ---
  @Get("Observation/:id")
  readObservation(@Param("id") id: string) {
    return this.service.readObservation(id);
  }

  @Get("Observation")
  searchObservation(
    @Query("patient") patient?: string,
    @Query("_count") _count?: string,
  ) {
    return this.service.searchObservation({ patient, _count });
  }

  // --- DiagnosticReport ---
  @Get("DiagnosticReport/:id")
  readDiagnosticReport(@Param("id") id: string) {
    return this.service.readDiagnosticReport(id);
  }

  /**
   * [v3.0.6.16-7] 接收 DiagnosticReport。
   * 前端 FHIRDiagnosticReport「推送到 FHIR 服务器」此前打到不存在的端点
   * (旧实现直接伪造 201 Created) —— 现真实落库到 FhirResource。
   */
  @Post("DiagnosticReport")
  @HttpCode(HttpStatus.CREATED)
  createDiagnosticReport(@Body() body: Record<string, unknown>) {
    return this.service.createDiagnosticReport(body);
  }

  @Get("DiagnosticReport")
  searchDiagnosticReport(
    @Query("patient") patient?: string,
    @Query("status") status?: string,
    @Query("_count") _count?: string,
  ) {
    return this.service.searchDiagnosticReport({ patient, status, _count });
  }

  // --- ImagingStudy ---
  @Get("ImagingStudy/:id")
  readImagingStudy(@Param("id") id: string) {
    return this.service.readImagingStudy(id);
  }

  @Get("ImagingStudy")
  searchImagingStudy(
    @Query("patient") patient?: string,
    @Query("modality") modality?: string,
    @Query("_count") _count?: string,
  ) {
    return this.service.searchImagingStudy({ patient, modality, _count });
  }

  // --- Subscription ---
  @Post("Subscription")
  @Roles("ADMIN", "DIRECTOR")
  @HttpCode(HttpStatus.CREATED)
  createSubscription(
    @Body(new ZodValidationPipe(CreateSubscriptionSchema))
    body: CreateSubscriptionDto,
  ) {
    return this.service.createSubscription(body);
  }

  @Get("Subscription/:id")
  @Roles("ADMIN", "DIRECTOR")
  getSubscription(@Param("id") id: string) {
    return this.service.getSubscription(id);
  }

  @Get("Subscription")
  @Roles("ADMIN", "DIRECTOR")
  searchSubscription() {
    return this.service.searchSubscription();
  }

  @Delete("Subscription/:id")
  @Roles("ADMIN", "DIRECTOR")
  deleteSubscription(@Param("id") id: string) {
    return this.service.deleteSubscription(id);
  }

  // --- Bulk Data Export ---
  @Get("$export")
  @Roles("ADMIN", "DIRECTOR", "TECHNICIAN")
  async bulkExport(
    @Query("_outputFormat") _outputFormat?: string,
    @Query("_since") _since?: string,
    @Query("_type") _type?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const { jobId } = await this.service.bulkExport(
      _outputFormat,
      _since,
      _type,
    );
    if (res) {
      res.setHeader("Content-Location", `/fhir/r4/$export-status/${jobId}`);
    }
    return { jobId, statusCode: 202 };
  }

  @Get("$export-status/:jobId")
  @Roles("ADMIN", "DIRECTOR", "TECHNICIAN")
  async bulkExportStatus(
    @Param("jobId") jobId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.bulkExportStatus(jobId);
    res.setHeader(
      "Content-Type",
      typeof result === "string"
        ? "application/fhir+ndjson"
        : "application/json",
    );
    if (typeof result === "string") {
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="export.ndjson"',
      );
    }
    return result;
  }
}
