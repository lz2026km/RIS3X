/**
 * G005 RIS v3.0.6.6 - IVR/TTS 菜单引擎 (Mock)
 * 危急值升级与广播使用
 */

import { IVR_MENUS } from '../../data/notificationProviders';
import type { IVRMenu, IVRMenuItem } from '../../types/notification';

export interface IVRMenuRender {
  menuId: string;
  greetingRendered: string;
  items: IVRMenuItem[];
  timeoutSec: number;
  maxRetries: number;
  fallbackAction: string;
  twimlHint?: string;
}

export interface IVRMenuService {
  list(): IVRMenu[];
  get(menuId: string): IVRMenu | null;
  render(menuId: string, vars: Record<string, string>): IVRMenuRender | null;
  /** 模拟一次呼叫后医生按键结果 */
  simulateReply(menuId: string, digit: string): { action: string; nextMenuId?: string };
}

class IVRMenuServiceImpl implements IVRMenuService {
  constructor(private menus: IVRMenu[] = IVR_MENUS) {}

  list(): IVRMenu[] {
    return this.menus;
  }

  get(menuId: string): IVRMenu | null {
    return this.menus.find((m) => m.id === menuId) ?? null;
  }

  render(menuId: string, vars: Record<string, string>): IVRMenuRender | null {
    const menu = this.get(menuId);
    if (!menu) return null;
    const greetingRendered = Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), v),
      menu.greeting,
    );
    return {
      menuId: menu.id,
      greetingRendered,
      items: menu.items,
      timeoutSec: menu.timeoutSec ?? 10,
      maxRetries: menu.maxRetries ?? 2,
      fallbackAction: menu.fallbackAction ?? 'hangup',
      twimlHint: `<Gather numDigits="1" action="/ivr/${menuId}/reply">…</Gather>`,
    };
  }

  simulateReply(menuId: string, digit: string): { action: string; nextMenuId?: string } {
    const menu = this.get(menuId);
    if (!menu) return { action: 'hangup' };
    const item = menu.items.find((i) => i.digit === digit);
    if (!item) {
      return { action: menu.fallbackAction ?? 'hangup' };
    }
    return { action: item.action, nextMenuId: item.nextMenuId };
  }
}

export const ivrMenuService: IVRMenuService = new IVRMenuServiceImpl();

/** 默认菜单:危急值确认 */
export const DEFAULT_IVR_MENU_ID = 'ivr-cv-confirm-v1';