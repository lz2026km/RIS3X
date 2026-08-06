import { describe, it, expect, beforeAll } from 'vitest';
import { changeLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES, LANGUAGE_META } from '../index';
import i18nLib from 'i18next';
import zhCN from '../locales/zh_CN.json';
import enUS from '../locales/en_US.json';

// LanguageDetector + initReactI18next 在 jsdom 环境中影响 t() 的查找
// 此处用干净实例测试语言资源内容
const testI18n = i18nLib.createInstance();

describe('i18n - 国际化', () => {
  beforeAll(async () => {
    await testI18n.init({
      resources: {
        zh_CN: { translation: zhCN as Record<string, unknown> },
        en_US: { translation: enUS as Record<string, unknown> },
      },
      lng: 'zh_CN',
      fallbackLng: 'zh_CN',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  });

  describe('基础功能', () => {
    it('支持 zh_CN 和 en_US', () => {
      expect(SUPPORTED_LANGUAGES).toEqual(['zh_CN', 'en_US']);
    });

    it('包含 2 种语言元数据', () => {
      expect(Object.keys(LANGUAGE_META)).toHaveLength(2);
      expect(LANGUAGE_META.zh_CN?.nativeName).toBe('简体中文');
      expect(LANGUAGE_META.en_US?.nativeName).toBe('English');
    });
  });

  describe('中文(默认)', () => {
    it('common.save = 保存', () => {
      expect(testI18n.t('common.save')).toBe('保存');
    });

    it('nav.home = 首页', () => {
      expect(testI18n.t('nav.home')).toBe('首页');
    });

    it('status.pendingAssignment = 待分配', () => {
      expect(testI18n.t('status.pendingAssignment')).toBe('待分配');
    });

    it('report.findings = 影像所见', () => {
      expect(testI18n.t('report.findings')).toBe('影像所见');
    });

    it('critical.categories 含 15 类', () => {
      expect(testI18n.t('critical.categories.CV-RAD-001')).toBe('主动脉夹层');
      expect(testI18n.t('critical.categories.CV-RAD-015')).toBe('宫外孕破裂');
    });
  });

  describe('英文', () => {
    beforeAll(async () => {
      await testI18n.changeLanguage('en_US');
    });

    it('common.save = Save', () => {
      expect(testI18n.t('common.save')).toBe('Save');
    });

    it('nav.home = Home', () => {
      expect(testI18n.t('nav.home')).toBe('Home');
    });

    it('status.pendingAssignment = Pending Assignment', () => {
      expect(testI18n.t('status.pendingAssignment')).toBe('Pending Assignment');
    });

    it('report.findings = Findings', () => {
      expect(testI18n.t('report.findings')).toBe('Findings');
    });

    it('critical.categories 英文版', () => {
      expect(testI18n.t('critical.categories.CV-RAD-001')).toBe('Aortic Dissection');
      expect(testI18n.t('critical.categories.CV-RAD-002')).toBe('Pulmonary Embolism');
    });
  });

  describe('切换语言', () => {
    it('changeLanguage 切换 zh_CN → en_US', async () => {
      await changeLanguage('en_US');
      expect(getCurrentLanguage()).toBe('en_US');
    });

    it('changeLanguage 切换 en_US → zh_CN', async () => {
      await changeLanguage('zh_CN');
      expect(getCurrentLanguage()).toBe('zh_CN');
    });
  });

  describe('插值', () => {
    it('支持命名插值', () => {
      testI18n.addResource('zh_CN', 'test', 'greet', '你好,{{name}}!');
      expect(testI18n.t('test:greet', { name: '张医生' })).toBe('你好,张医生!');
    });

    it('支持命名插值(英文)', () => {
      testI18n.addResource('en_US', 'test', 'greet', 'Hello, {{name}}!');
      expect(testI18n.t('test:greet', { name: 'Dr. Smith' })).toBe('Hello, Dr. Smith!');
    });
  });

  describe('DICOM 术语', () => {
    beforeAll(async () => {
      await testI18n.changeLanguage('zh_CN');
    });

    it('中文 DICOM 工具齐全', () => {
      expect(testI18n.t('dicom.zoom')).toBe('缩放');
      expect(testI18n.t('dicom.measure')).toBe('测量');
      expect(testI18n.t('dicom.MPR')).toBe('多平面重建');
      expect(testI18n.t('dicom.MIP')).toBe('最大密度投影');
    });

    it('英文 DICOM 工具齐全', async () => {
      await testI18n.changeLanguage('en_US');
      expect(testI18n.t('dicom.zoom')).toBe('Zoom');
      expect(testI18n.t('dicom.measure')).toBe('Measure');
      expect(testI18n.t('dicom.MPR')).toBe('MPR');
      expect(testI18n.t('dicom.MIP')).toBe('MIP');
    });
  });
});
