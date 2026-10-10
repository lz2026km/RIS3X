// [v3.0.6.11-96 Wave 3A P1] Worklist 检查详情抽屉:
// 主体已提取为 ExamDetailView (Drawer / /exam/:id 独立页共用), 本文件仅保留 AppDrawer 外壳。
import { AppDrawer } from "../../components/common/AppDrawer";
import { ExamDetailView } from "./ExamDetailView";
import type { RadiologyExam } from "../../types";

// ============================================================
// DetailDrawer
// ============================================================
export interface DetailDrawerProps {
  exam: RadiologyExam | null;
  onClose: () => void;
  onEditInfo?: (exam: RadiologyExam) => void;
  onAssignDevice?: (exam: RadiologyExam) => void;
  onAssignDoctor?: (exam: RadiologyExam) => void;
  onViewRequisition?: (exam: RadiologyExam) => void;
  onWriteReport?: (exam: RadiologyExam) => void;
  onStartExam?: (exam: RadiologyExam) => void;
  onCancelExam?: (exam: RadiologyExam) => void;
  // [G005 Wave1A W9] 状态流转 (worklistApi checkin/start/complete/cancel) 成功后的刷新回调
  onStatusChanged?: () => void;
  initialTab?: "info" | "images" | "history" | "log" | "timeline";
}

export function DetailDrawer({
  exam,
  onClose,
  onEditInfo,
  onAssignDevice,
  onAssignDoctor,
  onViewRequisition,
  onWriteReport,
  onStartExam,
  onCancelExam,
  onStatusChanged,
  initialTab = "info",
}: DetailDrawerProps) {
  return (
    <AppDrawer
      open={!!exam}
      onClose={onClose}
      placement="right"
      width={500}
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>检查详情</div>
          <div
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              opacity: 0.8,
              marginTop: 2,
            }}
          >
            {exam?.accessionNumber}
          </div>
        </div>
      }
      headerStyle={{
        background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)",
        color: "#fff",
        borderBottom: "none",
      }}
    >
      <ExamDetailView
        exam={exam}
        initialTab={initialTab}
        onEditInfo={onEditInfo}
        onAssignDevice={onAssignDevice}
        onAssignDoctor={onAssignDoctor}
        onViewRequisition={onViewRequisition}
        onWriteReport={onWriteReport}
        onStartExam={onStartExam}
        onCancelExam={onCancelExam}
        onStatusChanged={onStatusChanged}
        // 抽屉内状态流转成功后关闭
        onStatusSuccess={onClose}
      />
    </AppDrawer>
  );
}

export default DetailDrawer;
