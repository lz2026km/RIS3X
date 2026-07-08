import { Injectable } from '@nestjs/common';

@Injectable()
export class CosignService {
  async listPendingCosigns() {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async getPendingCosign(id: string) {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async approveCosign(id: string, body: any) {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async rejectCosign(id: string, body: any) {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async listCosignHistory() {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async listCosignRules() {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async createCosignRule(body: any) {
    // TODO: implement with Prisma
    return { data: [] };
  }

  async getCosignStats() {
    // TODO: implement with Prisma
    return { data: [] };
  }
}
