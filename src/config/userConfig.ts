export interface UserConfig {
  leftPanelWidth: number;
  rightPanelWidth: number;
  layoutPreset: 'full' | 'compact' | 'focus';
  showLeftPanel: boolean;
  showRightPanel: boolean;
  editorFontSize: number;
  editorFontFamily: string;
  editorLineHeight: number;
  editorTabSize: number;
  autoSave: boolean;
  autoSaveInterval: number;
  shortcutPreset: 'default' | 'vscode' | 'word';
  theme: 'light' | 'dark' | 'high-contrast';
  fontSizeScale: number;
  reducedMotion: boolean;
  highContrast: boolean;
  rightPanelDefaultTab: string;
  leftPanelDefaultSection: string;
  sidebarCollapsed: boolean;
}

export const DEFAULT_CONFIG: UserConfig = {
  leftPanelWidth: 240,
  rightPanelWidth: 320,
  layoutPreset: 'full',
  showLeftPanel: true,
  showRightPanel: true,
  editorFontSize: 14,
  editorFontFamily: 'inherit',
  editorLineHeight: 1.7,
  editorTabSize: 4,
  autoSave: true,
  autoSaveInterval: 30,
  shortcutPreset: 'default',
  theme: 'light',
  fontSizeScale: 1.0,
  reducedMotion: false,
  highContrast: false,
  rightPanelDefaultTab: 'templates',
  leftPanelDefaultSection: 'images',
  sidebarCollapsed: false,
};
