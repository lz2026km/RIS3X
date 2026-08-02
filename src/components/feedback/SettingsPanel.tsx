import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Tabs,
  Slider,
  Select,
  Switch,
  Radio,
  Button,
  Badge,
  Divider,
} from "antd";
import { SettingOutlined } from "@ant-design/icons";
import {
  SHORTCUT_LIST,
  SHORTCUT_GROUPS,
  formatShortcut,
} from "../../config/shortcuts";
import type { UserConfig } from "../../config/userConfig";

const FONT_FAMILIES = [
  { value: "inherit", label: "继承 (inherit)" },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans-Serif" },
  { value: "monospace", label: "Monospace" },
  { value: '"Noto Serif SC", serif', label: "Noto Serif SC" },
  { value: '"Source Han Serif SC", serif', label: "Source Han Serif" },
];

const LAYOUT_PRESETS = [
  { value: "full", label: "完整" },
  { value: "compact", label: "紧凑" },
  { value: "focus", label: "专注" },
];

const SHORTCUT_PRESETS = [
  { value: "default", label: "默认" },
  { value: "vscode", label: "VS Code" },
  { value: "word", label: "Word" },
];

const THEME_OPTIONS = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "high-contrast", label: "高对比度" },
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
        aria-label={isZh ? "设置" : "Settings"}
        onKeyDown={(e) => {
          if (e.key === "Enter") setOpen(true);
        }}
      >
        {trigger ?? (
          <SettingOutlined
            style={{ fontSize: 18, color: "var(--text-secondary)" }}
          />
        )}
      </div>

      <Modal
        title={isZh ? "设置" : "Settings"}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <Tabs
          defaultActiveKey="layout"
          items={[
            {
              key: "layout",
              label: isZh ? "布局" : "Layout",
              children: (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="layoutPreset"
                      aria-label="布局预设"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      布局预设
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

                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="leftPanelWidth"
                      aria-label="左侧面板宽度"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      左侧面板宽度: {config.leftPanelWidth}px
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

                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="rightPanelWidth"
                      aria-label="右侧面板宽度"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      右侧面板宽度: {config.rightPanelWidth}px
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

                  <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
                    <div>
                      <label
                        htmlFor="showLeftPanel"
                        aria-label="显示左侧面板"
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        显示左侧面板
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
                        aria-label="显示右侧面板"
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        显示右侧面板
                      </label>
                      <Switch
                        id="showRightPanel"
                        checked={config.showRightPanel}
                        onChange={(v) => updateField("showRightPanel", v)}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="rightPanelDefaultTab"
                      aria-label="右侧面板默认标签"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      右侧面板默认标签
                    </label>
                    <Select
                      id="rightPanelDefaultTab"
                      value={config.rightPanelDefaultTab}
                      onChange={(v) => updateField("rightPanelDefaultTab", v)}
                      style={{ width: 200 }}
                      options={[
                        { value: "templates", label: "模板" },
                        { value: "measurements", label: "测量" },
                        { value: "ai-assist", label: "AI 辅助" },
                      ]}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="leftPanelDefaultSection"
                      aria-label="左侧面板默认区段"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      左侧面板默认区段
                    </label>
                    <Select
                      id="leftPanelDefaultSection"
                      value={config.leftPanelDefaultSection}
                      onChange={(v) =>
                        updateField("leftPanelDefaultSection", v)
                      }
                      style={{ width: 200 }}
                      options={[
                        { value: "images", label: "影像" },
                        { value: "reports", label: "报告" },
                        { value: "history", label: "历史" },
                      ]}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: "editor",
              label: isZh ? "编辑" : "Editor",
              children: (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="editorFontSize"
                      aria-label="字体大小"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      字体大小: {config.editorFontSize}px
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

                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="editorFontFamily"
                      aria-label="字体"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      字体
                    </label>
                    <Select
                      id="editorFontFamily"
                      value={config.editorFontFamily}
                      onChange={(v) => updateField("editorFontFamily", v)}
                      style={{ width: 260 }}
                      options={FONT_FAMILIES}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="editorLineHeight"
                      aria-label="行高"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      行高: {config.editorLineHeight.toFixed(1)}
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

                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="editorTabSize"
                      aria-label="Tab 大小"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      Tab 大小: {config.editorTabSize}
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

                  <div style={{ display: "flex", gap: 24 }}>
                    <div>
                      <label
                        htmlFor="autoSave"
                        aria-label="自动保存"
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        自动保存
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
                          aria-label="自动保存间隔"
                          style={{
                            display: "block",
                            marginBottom: 6,
                            fontWeight: 500,
                          }}
                        >
                          间隔: {config.autoSaveInterval}s
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
              label: isZh ? "主题" : "Theme",
              children: (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: 24 }}>
                    <label
                      htmlFor="theme"
                      aria-label="主题"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      主题
                    </label>
                    <Radio.Group
                      id="theme"
                      value={config.theme}
                      onChange={(e) => updateField("theme", e.target.value)}
                      options={THEME_OPTIONS}
                      optionType="button"
                      buttonStyle="solid"
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="fontSizeScale"
                      aria-label="字体缩放"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      字体缩放: {config.fontSizeScale.toFixed(1)}x
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

                  <div style={{ display: "flex", gap: 24 }}>
                    <div>
                      <label
                        htmlFor="reducedMotion"
                        aria-label="减少动效"
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        减少动效
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
                        aria-label="高对比度"
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        高对比度
                      </label>
                      <Switch
                        id="highContrast"
                        checked={config.highContrast}
                        onChange={(v) => updateField("highContrast", v)}
                      />
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: "shortcuts",
              label: isZh ? "快捷键" : "Shortcuts",
              children: (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="shortcutPreset"
                      aria-label="快捷键预设"
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      快捷键预设
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
                      <div key={group} style={{ marginBottom: 20 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            marginBottom: 8,
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
                                background: "#f1f5f9",
                                color: "#64748b",
                                border: "1px solid #e2e8f0",
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
            {isZh ? "重置为默认设置" : "Reset to Default"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
