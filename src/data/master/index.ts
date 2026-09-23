// [v3.0.6.8-27] 主数据池统一导出 + 工具函数
export * from "./doctorMasterMock";
export * from "./patientMasterMock";
export * from "./deviceMasterMock";
export * from "./examItemMasterMock";

import { DOCTOR_MASTER, DOCTOR_BY_ID, DOCTOR_STATS, pickDoctors } from './doctorMasterMock';
import { PATIENT_MASTER, PATIENT_BY_ID, PATIENT_STATS, pickPatients, pickByModality } from './patientMasterMock';
import { DEVICE_MASTER, DEVICE_BY_ID, DEVICE_STATS } from './deviceMasterMock';
import { EXAM_ITEM_MASTER, EXAM_BY_CODE, EXAM_ITEM_STATS } from './examItemMasterMock';

// 全局统计
export const MASTER_STATS = {
  doctors: DOCTOR_STATS,
  patients: PATIENT_STATS,
  devices: DEVICE_STATS,
  examItems: EXAM_ITEM_STATS,
  totalEntities:
    DOCTOR_MASTER.length +
    PATIENT_MASTER.length +
    DEVICE_MASTER.length +
    EXAM_ITEM_MASTER.length,
};

// 工具: 获取任意 ID 对应实体
export function getEntity(id: string):
  | { type: "doctor"; data: typeof DOCTOR_MASTER[number] }
  | { type: "patient"; data: typeof PATIENT_MASTER[number] }
  | { type: "device"; data: typeof DEVICE_MASTER[number] }
  | { type: "examItem"; data: typeof EXAM_ITEM_MASTER[number] }
  | null {
  if (id.startsWith("D")) {
    const data = DOCTOR_BY_ID[id];
    return data ? { type: "doctor", data } : null;
  }
  if (id.startsWith("P")) {
    const data = PATIENT_BY_ID[id];
    return data ? { type: "patient", data } : null;
  }
  if (id.startsWith("DEV-")) {
    const data = DEVICE_BY_ID[id];
    return data ? { type: "device", data } : null;
  }
  if (id.includes("-")) {
    const data = EXAM_BY_CODE[id];
    return data ? { type: "examItem", data } : null;
  }
  return null;
}

// 工具: 通过医生 ID 列出患者 (用医生 ID 前缀找患者)
export function getDoctorName(id: string): string {
  return DOCTOR_BY_ID[id]?.name || id;
}

export function getPatientName(id: string): string {
  return PATIENT_BY_ID[id]?.name || id;
}

export function getDeviceName(id: string): string {
  return DEVICE_BY_ID[id]?.model || id;
}

export function getExamItemName(code: string): string {
  return EXAM_BY_CODE[code]?.name || code;
}

// 工具: 重新导出常用工具
export { pickDoctors, pickPatients, pickByModality };
