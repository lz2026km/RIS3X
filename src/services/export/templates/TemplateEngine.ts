/**
 * G005 放射RIS系统 v3.0.6.0 - 导出模板引擎(Jinja/Handlebars/Mustache)
 * Phase R7:支持变量替换/条件/循环/过滤器
 */
import type { ExportTemplateDefinition, TemplateVariable } from '../../types/export';

export type TemplateContext = Record<string, unknown>;

export interface RenderResult {
  output: string;
  warnings: string[];
  missingVariables: string[];
}

export class TemplateEngine {
  render(template: ExportTemplateDefinition, ctx: TemplateContext): RenderResult {
    const warnings: string[] = [];
    const missing: string[] = [];
    const merged = this.mergeWithDefaults(template.variables, ctx, missing, warnings);

    const header = template.header ? this.engineRender(template.engine, template.header, merged, warnings) : '';
    const body = this.engineRender(template.engine, template.body, merged, warnings);
    const footer = template.footer ? this.engineRender(template.engine, template.footer, merged, warnings) : '';

    return {
      output: [header, body, footer].filter(Boolean).join('\n'),
      warnings,
      missingVariables: missing,
    };
  }

  private mergeWithDefaults(
    vars: TemplateVariable[],
    ctx: TemplateContext,
    missing: string[],
    warnings: string[],
  ): TemplateContext {
    const out: TemplateContext = { ...ctx };
    for (const v of vars) {
      if (!(v.name in out) || out[v.name] === undefined || out[v.name] === null) {
        if (v.defaultValue !== undefined) {
          out[v.name] = v.defaultValue;
        } else if (v.required) {
          missing.push(v.name);
          warnings.push(`Required variable "${v.name}" missing`);
          out[v.name] = `[${v.name}]`;
        } else {
          out[v.name] = '';
        }
      }
    }
    return out;
  }

  private engineRender(
    engine: ExportTemplateDefinition['engine'],
    body: string,
    ctx: TemplateContext,
    warnings: string[],
  ): string {
    switch (engine) {
      case 'handlebars':
        return this.renderHandlebars(body, ctx);
      case 'jinja':
        return this.renderJinja(body, ctx, warnings);
      case 'mustache':
        return this.renderMustache(body, ctx);
      case 'plain':
      default:
        return this.renderPlain(body, ctx);
    }
  }

  private renderPlain(body: string, ctx: TemplateContext): string {
    return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => this.lookup(ctx, key));
  }

  private renderMustache(body: string, ctx: TemplateContext): string {
    let out = body;
    out = out.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key: string) => this.escape(this.lookup(ctx, key)));
    out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => this.escape(this.lookup(ctx, key)));
    out = out.replace(/\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key: string, inner: string) => {
      const arr = this.lookup(ctx, key);
      if (!Array.isArray(arr)) return '';
      return arr.map(item => inner.replace(/\{\{\s*this\s*\}\}/g, String(item))).join('');
    });
    return out;
  }

  private renderHandlebars(body: string, ctx: TemplateContext): string {
    let out = body;
    out = out.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key: string) => this.escape(this.lookup(ctx, key)));
    out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => this.escape(this.lookup(ctx, key)));

    out = out.replace(
      /\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, key: string, inner: string) => {
        const v = this.lookup(ctx, key);
        return v ? inner : '';
      },
    );
    out = out.replace(
      /\{\{#unless\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/unless\}\}/g,
      (_, key: string, inner: string) => {
        const v = this.lookup(ctx, key);
        return v ? '' : inner;
      },
    );

    out = out.replace(
      /\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (_, key: string, inner: string) => {
        const arr = this.lookup(ctx, key);
        if (!Array.isArray(arr)) return '';
        return arr
          .map(item => {
            const itemStr = typeof item === 'string' ? item : JSON.stringify(item);
            return inner.replace(/\{\{\s*this\s*\}\}/g, itemStr);
          })
          .join('');
      },
    );

    out = this.applyFilters(out, ctx);
    return out;
  }

  private renderJinja(body: string, ctx: TemplateContext, warnings: string[]): string {
    let out = body;
    out = out.replace(/\{\%\s*if\s+([\w.]+)\s*\%\}([\s\S]*?)\{\%\s*endif\s*\%\}/g, (_, key: string, inner: string) => {
      const v = this.lookup(ctx, key);
      return v ? inner : '';
    });
    out = out.replace(
      /\{\%\s*for\s+(\w+)\s+in\s+([\w.]+)\s*\%\}([\s\S]*?)\{\%\s*endfor\s*\%\}/g,
      (_, varName: string, key: string, inner: string) => {
        const arr = this.lookup(ctx, key);
        if (!Array.isArray(arr)) {
          warnings.push(`Variable "${key}" is not iterable`);
          return '';
        }
        return arr
          .map(item =>
            inner.replace(new RegExp(`\\{\\{\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\w+)\\s*\\}\\}`, 'g'), (_2, prop: string) =>
              typeof item === 'object' && item !== null && prop in (item as object)
                ? String((item as Record<string, unknown>)[prop])
                : '',
            ).replace(new RegExp(`\\{\\{\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g'), String(item)),
          )
          .join('');
      },
    );
    out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => this.escape(this.lookup(ctx, key)));
    out = this.applyFilters(out, ctx);
    return out;
  }

  private applyFilters(body: string, ctx: TemplateContext): string {
    return body.replace(/\{\{\s*([\w.]+)\s*\|\s*(\w+)\s*\}\}/g, (_, key: string, filter: string) => {
      const raw = this.lookup(ctx, key);
      switch (filter) {
        case 'upper':
          return raw.toUpperCase();
        case 'lower':
          return raw.toLowerCase();
        case 'trim':
          return raw.trim();
        case 'json':
          try {
            return JSON.stringify(raw);
          } catch {
            return String(raw);
          }
        case 'date':
          try {
            return new Date(raw).toLocaleString('zh-CN');
          } catch {
            return raw;
          }
        default:
          return raw;
      }
    });
  }

  private lookup(ctx: TemplateContext, path: string): string {
    if (path in ctx) {
      const v = ctx[path];
      if (v === null || v === undefined) return '';
      return typeof v === 'string' ? v : String(v);
    }
    const parts = path.split('.');
    let cur: unknown = ctx;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in (cur as object)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return '';
      }
    }
    if (cur === null || cur === undefined) return '';
    return typeof cur === 'string' ? cur : String(cur);
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

let singleton: TemplateEngine | null = null;

export function getTemplateEngine(): TemplateEngine {
  if (!singleton) singleton = new TemplateEngine();
  return singleton;
}