// 法规阈值配置（依据《医疗照射放射防护标准》GBZ 130-2020）
export const REGULATORY_THRESHOLDS = {
  CT: {
    头颅平扫: { DLP: 800, CTDIvol: 60, alertThreshold: 0.8 },
    胸部平扫: { DLP: 600, CTDIvol: 35, alertThreshold: 0.8 },
    腹部平扫: { DLP: 800, CTDIvol: 50, alertThreshold: 0.8 },
    冠脉CTA: { DLP: 1000, CTDIvol: 80, alertThreshold: 1.0 },
    胸部增强: { DLP: 1000, CTDIvol: 60, alertThreshold: 0.8 },
    腹部增强: { DLP: 1200, CTDIvol: 70, alertThreshold: 0.8 },
  },
  DR: {
    胸部正侧位: { DAP: 0.3, alertThreshold: 1.0 },
    腹部平片: { DAP: 1.0, alertThreshold: 1.0 },
    骨盆: { DAP: 0.5, alertThreshold: 1.0 },
  },
  DSA: {
    冠脉造影: { DAP: 3000, alertThreshold: 1.0 },
    脑血管造影: { DAP: 2500, alertThreshold: 1.0 },
    外周血管: { DAP: 2000, alertThreshold: 1.0 },
  },
  MG: {
    乳腺钼靶: { AGD: 6, alertThreshold: 1.0 },
  },
};

export type Modality = keyof typeof REGULATORY_THRESHOLDS;