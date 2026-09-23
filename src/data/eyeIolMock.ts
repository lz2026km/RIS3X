/** G005 IOL 库存 Mock 数据 v3.0.6.8-20 */
import type { IolItem } from '../types/eye';

export const MOCK_IOL_INVENTORY: IolItem[] = [
  { id: 'iol-001', manufacturer: 'Alcon', model: 'SA60AT', power: 22.0, sn: 'ALC-20240001', expiryDate: '2028-12-31', lotNumber: 'LOT-2024-0001', location: '眼科手术室', quantity: 1, status: 'in_stock' },
  { id: 'iol-002', manufacturer: 'Alcon', model: 'SA60AT', power: 22.5, sn: 'ALC-20240002', expiryDate: '2028-12-31', lotNumber: 'LOT-2024-0002', location: '眼科手术室', quantity: 1, status: 'in_stock' },
  { id: 'iol-003', manufacturer: 'Alcon', model: 'SA60AT', power: 23.0, sn: 'ALC-20240003', expiryDate: '2028-12-31', lotNumber: 'LOT-2024-0003', location: '眼科手术室', quantity: 1, status: 'in_stock' },
  { id: 'iol-004', manufacturer: 'Zeiss', model: 'CT ASPHINA 509M', power: 21.5, sn: 'ZE-20240004', expiryDate: '2029-06-30', patientId: 'p-1005', implantDate: undefined, surgeon: undefined, lotNumber: 'LOT-2024-0004', location: '眼科手术室', quantity: 0, status: 'implanted' },
  { id: 'iol-005', manufacturer: 'Alcon', model: 'AcrySof IQ Toric SN6AT6', power: 20.0, sn: 'ALC-20240005', expiryDate: '2028-06-30', lotNumber: 'LOT-2024-0005', location: '眼科手术室', quantity: 1, status: 'in_stock' },
  { id: 'iol-006', manufacturer: 'Johnson', model: 'TECNIS PCB00', power: 24.0, sn: 'JNJ-20240006', expiryDate: '2029-12-31', lotNumber: 'LOT-2024-0006', location: '眼科手术室', quantity: 1, status: 'in_stock' },
  { id: 'iol-007', manufacturer: 'Bausch', model: 'enVista MX60', power: 19.5, sn: 'BOL-20240007', expiryDate: '2028-12-31', lotNumber: 'LOT-2024-0007', location: '眼科手术室', quantity: 1, status: 'in_stock' },
  { id: 'iol-008', manufacturer: 'Alcon', model: 'PanOptix TFNT00', power: 23.5, sn: 'ALC-20240008', expiryDate: '2028-09-30', lotNumber: 'LOT-2024-0008', location: '眼科手术室', quantity: 1, status: 'in_stock' },
  { id: 'iol-009', manufacturer: 'Zeiss', model: 'AT LISA tri 839MP', power: 21.0, sn: 'ZE-20240009', expiryDate: '2029-12-31', lotNumber: 'LOT-2024-0009', location: '眼科手术室', quantity: 1, status: 'in_stock' },
  { id: 'iol-010', manufacturer: 'Haohai', model: 'Akreos AO60', power: 22.5, sn: 'HH-20240010', expiryDate: '2028-03-31', lotNumber: 'LOT-2024-0010', location: '眼科手术室', quantity: 1, status: 'in_stock' },
];

export const IOL_MANUFACTURERS = [
  { value: 'Alcon', label: '爱尔康' },
  { value: 'Zeiss', label: '蔡司' },
  { value: 'Johnson', label: '强生' },
  { value: 'Bausch', label: '博士伦' },
  { value: 'Aibo', label: '爱博' },
  { value: 'Leiming', label: '蕾明视康' },
  { value: 'Haohai', label: '昊海生科' },
  { value: 'Huasha', label: '华厦' },
] as const;

export const IOL_MODEL_BY_MANUFACTURER: Record<string, string[]> = {
  Alcon: ['SA60AT', 'AcrySof IQ SN60WF', 'PanOptix TFNT00', 'AcrySof IQ Toric SN6AT6'],
  Zeiss: ['CT ASPHINA 509M', 'AT LISA tri 839MP', 'AT TORBI 709M'],
  Johnson: ['TECNIS PCB00', 'TECNIS Symfony ZXR00', 'TECNIS Toric ZCT'],
  Bausch: ['enVista MX60', 'enVista Toric'],
  Aibo: ['AQ-2000PV', 'AQ-2010A'],
  Leiming: ['SP-100', 'SP-200'],
  Haohai: ['Akreos AO60', 'Akreos AO60 Toric'],
  Huasha: ['HS-A6001', 'HS-T6002'],
};
