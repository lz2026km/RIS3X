import { Injectable } from '@nestjs/common';

@Injectable()
export class CdsService {
  async listGuidelines() {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async getGuideline(id: string) {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async createGuideline(body: any) {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async listAlerts() {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async acknowledgeAlert(id: string, body: any) {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async getDoseMonitoring() {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async getCdsStatistics() {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async listCdsRules() {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async createCdsRule(body: any) {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async getCdsManagement() {
    // TODO: implement with Prisma
    return { data: [] };
  }
}
