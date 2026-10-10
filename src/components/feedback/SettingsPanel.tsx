import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Tabs, Slider, Select, Switch, Radio, Button, Divider } from 'antd';
import { Settings } from "lucide-react";
import { useAppTheme, type ThemeMode } from "../Provider";
import {
  SHORTCUT_LIST,
  SHORTCUT_GROUPS,
  formatShortcut,
} from "../../config/shortcuts";
import type { UserConfig } from "../../config/userConfig";
import { t } from "../../i18n/appI18n";

const FONT_FAMILIES = [
  { value: "inherit", label: t("settings.font.inherit") },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans-Serif" },
  { value: "monospace", label: "Monospace" },
  { value: '"Noto Serif SC", serif', label: "Noto Serif SC" },
  { value: '"Source Han Serif SC", serif', label: "Source Han Serif" },
];

const LAYOUT_PRESETS = [
  { value: "full", label: t("settings.layout.full") },
  { value: "compact", label: t("settings.layout.compact") },
  { value: "focus", label: t("settings.layout.focus") },
];

const SHORTCUT_PRESETS = [
  { value: "default", label: t("settings.shortcut.default") },
  { value: "vscode", label: "VS Code" },
  { value: "word", label: "Word" },
];

const THEME_OPTIONS = [
  { value: "light", label: t("settings.theme.light") },
  { value: "dark", label: t("settings.theme.dark") },
  { value: "high-contrast", label: t("settings.theme.highContrast") },
];

export interface SettingsPanelProps {
  config: UserConfig;
  updateConfig: (partial: Partial<UserConfig>) => void;
  resetConfig: () => void;
  updateField: <K extends keyof UserConfig>(
    key: K,
    value: UserConfig[K],
  ) => void;
  trigger?: React.ReactNode;
}

export function SettingsPanel({
  config,
  resetConfig,
  updateField,
  trigger,
}: SettingsPanelProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const isZh = i18n.language?.startsWith("zh");

  // U1-B: 主题状态与 Provider 三向同步 (context + data-theme + localStorage)
  const { theme: appTheme, setTheme } = useAppTheme();

  const groupedShortcuts = SHORTCUT_LIST.reduce<
    Record<string, typeof SHORTCUT_LIST>
  >((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
        role="button"
        tabIndex={0}
        aria-label={t("settings.title")}
        onKeyDown={(e) => {
          if (e.key === "Enter") setOpen(true);
        }}
      >
        {trigger ?? (
          <Settings
            size={18}
            style={{ color: "var(--text-secondary)" }}
          />
        )}
      </div>

      <Modal
        title={t("settings.title")}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <Tabs
          defaultActiveKey="layout"
          items={[
            {
              key: "layout",
              label: t("settings.tab.layout"),
              children: (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="layoutPreset"
                      aria-label={t("settings.layoutPreset")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.layoutPreset")}
                    </label>
                    <Radio.Group
                      id="layoutPreset"
                      value={config.layoutPreset}
                      onChange={(e) =>
                        updateField("layoutPreset", e.target.value)
                      }
                      options={LAYOUT_PRESETS}
                      optionType="button"
                      buttonStyle="solid"
                    />
                  </div>

                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="leftPanelWidth"
                      aria-label={t("settings.leftPanelWidth")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.leftPanelWidthValue", { value: config.leftPanelWidth })}
                    </label>
                    <Slider
                      id="leftPanelWidth"
                      min={160}
                      max={480}
                      step={10}
                      value={config.leftPanelWidth}
                      onChange={(v) => updateField("leftPanelWidth", v)}
                    />
                  </div>

                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="rightPanelWidth"
                      aria-label={t("settings.rightPanelWidth")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.rightPanelWidthValue", { value: config.rightPanelWidth })}
                    </label>
                    <Slider
                      id="rightPanelWidth"
                      min={200}
                      max={600}
                      step={10}
                      value={config.rightPanelWidth}
                      onChange={(v) => updateField("rightPanelWidth", v)}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 'var(--space-6, 24px)', marginBottom: 'var(--space-4, 16px)' }}>
                    <div>
                      <label
                        htmlFor="showLeftPanel"
                        aria-label={t("settings.showLeftPanel")}
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        {t("settings.showLeftPanel")}
                      </label>
                      <Switch
                        id="showLeftPanel"
                        checked={config.showLeftPanel}
                        onChange={(v) => updateField("showLeftPanel", v)}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="showRightPanel"
                        aria-label={t("settings.showRightPanel")}
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        {t("settings.showRightPanel")}
                      </label>
                      <Switch
                        id="showRightPanel"
                        checked={config.showRightPanel}
                        onChange={(v) => updateField("showRightPanel", v)}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="rightPanelDefaultTab"
                      aria-label={t("settings.rightPanelDefaultTab")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.rightPanelDefaultTab")}
                    </label>
                    <Select
                      id="rightPanelDefaultTab"
                      value={config.rightPanelDefaultTab}
                      onChange={(v) => updateField("rightPanelDefaultTab", v)}
                      style={{ width: 200 }}
                      options={[
                        { value: "templates", label: t("settings.panel.templates") },
                        { value: "measurements", label: t("settings.panel.measurements") },
                        { value: "ai-assist", label: t("settings.panel.aiAssist") },
                      ]}
                    />
                  </div>

                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="leftPanelDefaultSection"
                      aria-label={t("settings.leftPanelDefaultSection")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.leftPanelDefaultSection")}
                    </label>
                    <Select
                      id="leftPanelDefaultSection"
                      value={config.leftPanelDefaultSection}
                      onChange={(v) =>
                        updateField("leftPanelDefaultSection", v)
                      }
                      style={{ width: 200 }}
                      options={[
                        { value: "images", label: t("settings.section.images") },
                        { value: "reports", label: t("settings.section.reports") },
                        { value: "history", label: t("settings.section.history") },
                      ]}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: "editor",
              label: t("settings.tab.editor"),
              children: (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="editorFontSize"
                      aria-label={t("settings.editor.fontSize")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.editor.fontSizeValue", { value: config.editorFontSize })}
                    </label>
                    <Slider
                      id="editorFontSize"
                      min={10}
                      max={32}
                      step={1}
                      value={config.editorFontSize}
                      onChange={(v) => updateField("editorFontSize", v)}
                    />
                  </div>

                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="editorFontFamily"
                      aria-label={t("settings.editor.fontFamily")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.editor.fontFamily")}
                    </label>
                    <Select
                      id="editorFontFamily"
                      value={config.editorFontFamily}
                      onChange={(v) => updateField("editorFontFamily", v)}
                      style={{ width: 260 }}
                      options={FONT_FAMILIES}
                    />
                  </div>

                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="editorLineHeight"
                      aria-label={t("settings.editor.lineHeight")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.editor.lineHeightValue", { value: config.editorLineHeight.toFixed(1) })}
                    </label>
                    <Slider
                      id="editorLineHeight"
                      min={1.0}
                      max={2.5}
                      step={0.1}
                      value={config.editorLineHeight}
                      onChange={(v) => updateField("editorLineHeight", v)}
                    />
                  </div>

                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="editorTabSize"
                      aria-label={t("settings.editor.tabSize")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.editor.tabSizeValue", { value: config.editorTabSize })}
                    </label>
                    <Slider
                      id="editorTabSize"
                      min={1}
                      max={8}
                      step={1}
                      value={config.editorTabSize}
                      onChange={(v) => updateField("editorTabSize", v)}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 'var(--space-6, 24px)' }}>
                    <div>
                      <label
                        htmlFor="autoSave"
                        aria-label={t("settings.editor.autoSave")}
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        {t("settings.editor.autoSave")}
                      </label>
                      <Switch
                        id="autoSave"
                        checked={config.autoSave}
                        onChange={(v) => updateField("autoSave", v)}
                      />
                    </div>
                    {config.autoSave && (
                      <div>
                        <label
                          htmlFor="autoSaveInterval"
                          aria-label={t("settings.editor.autoSaveInterval")}
                          style={{
                            display: "block",
                            marginBottom: 6,
                            fontWeight: 500,
                          }}
                        >
                          {t("settings.editor.intervalValue", { value: config.autoSaveInterval })}
                        </label>
                        <Slider
                          id="autoSaveInterval"
                          min={5}
                          max={300}
                          step={5}
                          value={config.autoSaveInterval}
                          onChange={(v) => updateField("autoSaveInterval", v)}
                          style={{ width: 160 }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "theme",
              label: t("settings.tab.theme"),
              children: (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: 'var(--space-6, 24px)' }}>
                    <label
                      htmlFor="theme"
                      aria-label={t("settings.themeLabel")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.themeLabel")}
                    </label>
                    <Radio.Group
                      id="theme"
                      value={appTheme}
                      onChange={(e) => {
                        const v = e.target.value as ThemeMode;
                        setTheme(v);
                        updateField("theme", v);
                      }}
                      options={THEME_OPTIONS}
                      optionType="button"
                      buttonStyle="solid"
                    />
                  </div>

                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="fontSizeScale"
                      aria-label={t("settings.fontSizeScale")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.fontSizeScaleValue", { value: config.fontSizeScale.toFixed(1) })}
                    </label>
                    <Slider
                      id="fontSizeScale"
                      min={0.8}
                      max={1.5}
                      step={0.1}
                      value={config.fontSizeScale}
                      onChange={(v) => updateField("fontSizeScale", v)}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 'var(--space-6, 24px)' }}>
                    <div>
                      <label
                        htmlFor="reducedMotion"
                        aria-label={t("settings.reducedMotion")}
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        {t("settings.reducedMotion")}
                      </label>
                      <Switch
                        id="reducedMotion"
                        checked={config.reducedMotion}
                        onChange={(v) => updateField("reducedMotion", v)}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="highContrast"
                        aria-label={t("settings.theme.highContrast")}
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        {t("settings.theme.highContrast")}
                      </label>
                      <Switch
                        id="highContrast"
                        checked={appTheme === "high-contrast"}
                        onChange={(v) => {
                          setTheme(v ? "high-contrast" : "light");
                          updateField("highContrast", v);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: "shortcuts",
              label: t("settings.tab.shortcuts"),
              children: (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
                    <label
                      htmlFor="shortcutPreset"
                      aria-label={t("settings.shortcutPreset")}
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {t("settings.shortcutPreset")}
                    </label>
                    <Select
                      id="shortcutPreset"
                      value={config.shortcutPreset}
                      onChange={(v) => updateField("shortcutPreset", v)}
                      style={{ width: 200 }}
                      options={SHORTCUT_PRESETS}
                    />
                  </div>

                  <Divider />

                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {Object.entries(groupedShortcuts).map(([group, items]) => (
                      <div key={group} style={{ marginBottom: 'var(--space-5, 20px)' }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            marginBottom: 'var(--space-2, 8px)',
                            letterSpacing: "0.05em",
                          }}
                        >
                          {isZh
                            ? SHORTCUT_GROUPS[group]?.labelZh
                            : SHORTCUT_GROUPS[group]?.labelEn}
                        </div>
                        {items.map((shortcut) => (
                          <div
                            key={shortcut.action}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "6px 0",
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            <span style={{ fontSize: 14, color: "#1e293b" }}>
                              {isZh
                                ? shortcut.descriptionZh
                                : shortcut.descriptionEn}
                            </span>
                            <kbd
                              style={{
                                fontSize: 12,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "var(--bg-primary)",
                                color: "#64748b",
                                border: "1px solid var(--border-color)",
                                fontFamily: "inherit",
                              }}
                            >
                              {formatShortcut(shortcut)}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
          ]}
        />

        <Divider />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button danger onClick={resetConfig}>
            {t("settings.reset")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
