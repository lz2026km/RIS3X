// @ts-nocheck
import { useState } from "react";
import { AlertTriangle, Clock, Plus, CalendarCheck, CalendarX } from "lucide-react";
import { regionalApi } from "../../services/api";
import { Send } from "lucide-react";
import {
  PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { t } from "../../i18n/appI18n";

const C = {
  primary: "#1e40af", primaryLight: "#3b82f6", primaryLighter: "#dbeafe",
  accent: "#0891b2", white: "#ffffff", bg: "#e8e8e8", border: "#d1d5db",
  borderLight: "#e5e7eb", textDark: "#1f2937", textMid: "#4b5563", textLight: "#9ca3af",
  success: "#059669", successBg: "#d1fae5", warning: "#d97706", warningBg: "#fef3c7",
  danger: "#dc2626", dangerBg: "#fee2e2", info: "#2563eb", infoBg: "#dbeafe",
  purple: "#7c3aed", purpleBg: "#ede9fe",
};

const ATTENDANCE_STATS = [
  { name: "正常出勤", value: 85, color: "#059669" },
  { name: "迟到", value: 8, color: "#d97706" },
  { name: "早退", value: 4, color: "#f59e0b" },
  { name: "请假", value: 3, color: "#3b82f6" },
];

const ATTENDANCE_DATA = [
  { staffId: "S001", name: "张伟明", date: "2026-04-28", shift: "day", checkIn: "07:55", checkOut: "18:02", status: "normal", late: 0, early: 0 },
  { staffId: "S002", name: "李秀英", date: "2026-04-28", shift: "day", checkIn: "08:01", checkOut: "18:05", status: "normal", late: 1, early: 0 },
  { staffId: "S003", name: "王建国", date: "2026-04-28", shift: "day", checkIn: "07:58", checkOut: "19:30", status: "normal", late: 0, early: 0 },
  { staffId: "S004", name: "刘芳", date: "2026-04-28", shift: "morning", checkIn: "07:52", checkOut: "12:15", status: "normal", late: 0, early: 1 },
  { staffId: "S006", name: "赵志刚", date: "2026-04-28", shift: "morning", checkIn: "08:00", checkOut: "12:00", status: "normal", late: 0, early: 0 },
  { staffId: "S007", name: "孙伟", date: "2026-04-28", shift: "afternoon", checkIn: "12:05", checkOut: "18:30", status: "late", late: 1, early: 0 },
  { staffId: "S009", name: "吴敏", date: "2026-04-28", shift: "day", checkIn: "07:56", checkOut: "18:00", status: "normal", late: 0, early: 0 },
  { staffId: "S013", name: "马云飞", date: "2026-04-28", shift: "day", checkIn: "08:10", checkOut: "17:45", status: "late", late: 1, early: 1 },
];

const ATTENDANCE_MONTHLY = [
  { month: "2026-01", present: 98.5, late: 1.2, absent: 0.3, leave: 2.5 },
  { month: "2026-02", present: 97.8, late: 1.5, absent: 0.5, leave: 3.2 },
  { month: "2026-03", present: 98.2, late: 1.0, absent: 0.2, leave: 2.8 },
  { month: "2026-04", present: 98.6, late: 0.8, absent: 0.1, leave: 2.2 },
];

const LEAVE_REQUESTS = [
  { id: "L001", staffId: "S004", name: "刘芳", type: "年假", startDate: "2026-05-06", endDate: "2026-05-08", days: 3, reason: "家庭旅行", status: "pending", applyDate: "2026-04-25" },
  { id: "L002", staffId: "S007", name: "孙伟", type: "病假", startDate: "2026-04-29", endDate: "2026-04-29", days: 1, reason: "感冒发热", status: "pending", applyDate: "2026-04-28" },
  { id: "L003", staffId: "S010", name: "郑晓丽", type: "事假", startDate: "2026-05-10", endDate: "2026-05-12", days: 3, reason: "处理私事", status: "approved", applyDate: "2026-04-20" },
  { id: "L004", staffId: "S014", name: "李雪", type: "病假", startDate: "2026-04-30", endDate: "2026-04-30", days: 1, reason: "身体不适", status: "rejected", applyDate: "2026-04-27" },
];

const LeaveRow = ({ leave, onApprove, onReject }) => {
  const statusStyles = { pending: { bg: C.warningBg, color: C.warning }, approved: { bg: C.successBg, color: C.success }, rejected: { bg: C.dangerBg, color: C.danger } };
  const s = statusStyles[leave.status] || statusStyles.pending;
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${C.borderLight}`, gap: 16, fontSize: 13 }}>
      <div style={{ flex: 1, fontWeight: 500, color: C.textDark }}>{leave.name}</div>
      <div style={{ flex: 1, color: C.primary }}>{leave.type}</div>
      <div style={{ flex: 1, color: C.textDark }}>{leave.startDate} ~ {leave.endDate}</div>
      <div style={{ flex: 1, color: C.textMid }}>{leave.days}{t("deptSched.days")}</div>
      <div style={{ flex: 1 }}><span style={{ padding: "2px 8px", borderRadius: 4, background: s.bg, color: s.color, fontSize: 12 }}>{leave.status === "pending" ? t("deptSched.leavePending") : leave.status === "approved" ? t("deptSched.leaveApproved") : t("deptSched.leaveRejected")}</span></div>
      {leave.status === "pending" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onApprove} style={{ padding: "4px 12px", background: C.success, color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>{t("deptSched.approve")}</button>
          <button onClick={onReject} style={{ padding: "4px 12px", background: C.danger, color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>{t("deptSched.reject")}</button>
        </div>
      )}
    </div>
  );
};

export default function DepartmentSchedule() {
  const [leaveList, setLeaveList] = useState(LEAVE_REQUESTS);
  const [dateFrom, setDateFrom] = useState("2026-04-28");
  const [dateTo, setDateTo] = useState("2026-04-28");
  const [attendanceRows, setAttendanceRows] = useState(ATTENDANCE_DATA);
  const [querying, setQuerying] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [newLeave, setNewLeave] = useState({ name: "", type: "年假", startDate: "", endDate: "", days: 1, reason: "" });
  const [attendResult, setAttendResult] = useState("");

  const handleApprove = (id) => { setLeaveList((list) => list.map((l) => l.id === id ? { ...l, status: "approved" } : l)); };
  const handleReject = (id) => { setLeaveList((list) => list.map((l) => l.id === id ? { ...l, status: "rejected" } : l)); };

  const handleQuery = async () => {
    setQuerying(true);
    setAttendResult("");
    try {
      const res = await regionalApi.getDepartmentSchedule();
      const rows = res.success && Array.isArray(res.data) && res.data.length > 0 ? res.data : ATTENDANCE_DATA;
      setAttendanceRows(rows.map((r, i) => ({
        staffId: r.staffId || `S${String(i + 1).padStart(3, '0')}`,
        name: r.staffName || r.name || t("deptSched.staffFallback"),
        date: r.workDate || dateFrom,
        shift: r.shift || "day",
        checkIn: r.checkIn || "-",
        checkOut: r.checkOut || "-",
        status: r.status || "normal",
        late: r.lateTimes || 0,
        early: r.earlyTimes || 0,
      })));
      setAttendResult(`已按 ${dateFrom} ~ ${dateTo} 查询，获取 ${rows.length} 条排班/考勤记录`);
    } catch {
      setAttendanceRows(ATTENDANCE_DATA);
      setAttendResult(t("deptSched.scheduleUnavailable"));
    } finally {
      setQuerying(false);
    }
  };

  const handleCreateLeave = () => {
    if (!newLeave.name.trim() || !newLeave.startDate || !newLeave.endDate) { alert(t("deptSched.fillRequired")); return; }
    setLeaveList(prev => [...prev, {
      id: `L${Date.now()}`,
      staffId: `S${String(Date.now()).slice(-4)}`,
      name: newLeave.name,
      type: newLeave.type,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      days: newLeave.days,
      reason: newLeave.reason || "-",
      status: "pending",
      applyDate: new Date().toISOString().split("T")[0],
    }]);
    setShowLeaveForm(false);
    setNewLeave({ name: "", type: "年假", startDate: "", endDate: "", days: 1, reason: "" });
  };

  const panelStyle = { background: C.white, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: `1px solid ${C.borderLight}`, overflow: "hidden" };
  const panelHeaderStyle = { padding: "12px 16px", borderBottom: `1px solid ${C.borderLight}`, fontSize: 14, fontWeight: 600, color: C.textDark, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-primary)" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginBottom: 16 }}>
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span>{t("deptSched.attendanceRecords")} {/* [G005 Wave2B P2] ATTENDANCE_DATA 等硬编码 → 演示数据徽标 */}<span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: 600 }}>{t("deptSched.demoBadge")}</span></span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }} />
            <span style={{ fontSize: 12, color: C.textMid }}>{t("deptSched.to")}</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }} />
            <button onClick={() => void handleQuery()} disabled={querying} style={{ padding: "4px 12px", background: C.primary, color: C.white, border: "none", borderRadius: 4, cursor: querying ? "wait" : "pointer", fontSize: 12 }}>{querying ? t("deptSched.querying") : t("deptSched.query")}</button>
          </div>
        </div>
        {attendResult && <div style={{ padding: "8px 16px", background: C.infoBg, color: C.info, fontSize: 12 }}>{attendResult}</div>}
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--bg-primary)" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>{t("deptSched.colName")}</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>{t("deptSched.colShift")}</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>{t("deptSched.colCheckIn")}</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>{t("deptSched.colCheckOut")}</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>{t("deptSched.colStatus")}</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${C.border}`, color: C.textMid, fontWeight: 500 }}>{t("deptSched.colAbnormal")}</th>
            </tr></thead>
            <tbody>{attendanceRows.map((a) => (
              <tr key={a.staffId} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "10px 12px", fontWeight: 500, color: C.textDark }}>{a.name}</td>
                <td style={{ padding: "10px 12px", color: C.textMid }}>{a.shift === "morning" ? t("deptSched.shiftMorning") : a.shift === "afternoon" ? t("deptSched.shiftAfternoon") : a.shift === "night" ? t("deptSched.shiftNight") : t("deptSched.shiftDay")}</td>
                <td style={{ padding: "10px 12px", color: C.textMid }}>{a.checkIn}</td>
                <td style={{ padding: "10px 12px", color: C.textMid }}>{a.checkOut}</td>
                <td style={{ padding: "10px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, background: a.status === "normal" ? C.successBg : C.warningBg, color: a.status === "normal" ? C.success : C.warning }}>{a.status === "normal" ? t("deptSched.statusNormal") : t("deptSched.statusAbnormal")}</span></td>
                <td style={{ padding: "10px 12px", color: a.late > 0 ? C.danger : a.early > 0 ? C.warning : C.success }}>{a.late > 0 ? t("deptSched.lateTimes", { count: a.late }) : a.early > 0 ? t("deptSched.earlyTimes", { count: a.early }) : t("deptSched.none")}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${C.borderLight}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>{t("deptSched.monthlyTrend")}</div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ATTENDANCE_MONTHLY}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} domain={[90, 105]} /><Tooltip />
                <Area type="monotone" dataKey="present" stackId="1" stroke={C.success} fill={C.successBg} name={t("deptSched.presentRate")} />
                <Area type="monotone" dataKey="late" stackId="2" stroke={C.warning} fill={C.warningBg} name={t("deptSched.lateRate")} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}><span>{t("deptSched.leaveRequests")}</span><button onClick={() => setShowLeaveForm(true)} style={{ padding: "4px 10px", background: C.primary, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Plus style={{ width: 12, height: 12 }} /> {t("deptSched.newRequest")}</button></div>
          {showLeaveForm && (
            <div style={{ padding: 12, borderBottom: `1px solid ${C.borderLight}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input placeholder={t("deptSched.namePlaceholder")} value={newLeave.name} onChange={e => setNewLeave({ ...newLeave, name: e.target.value })} style={{ flex: 1, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }} />
                <select value={newLeave.type} onChange={e => setNewLeave({ ...newLeave, type: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}>
                  <option>年假</option><option>病假</option><option>事假</option><option>调休</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="date" value={newLeave.startDate} onChange={e => setNewLeave({ ...newLeave, startDate: e.target.value })} style={{ flex: 1, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }} />
                <span style={{ fontSize: 12, color: C.textMid }}>{t("deptSched.to")}</span>
                <input type="date" value={newLeave.endDate} onChange={e => setNewLeave({ ...newLeave, endDate: e.target.value })} style={{ flex: 1, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }} />
              </div>
              <input placeholder={t("deptSched.reasonPlaceholder")} value={newLeave.reason} onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => setShowLeaveForm(false)} style={{ padding: "4px 10px", background: C.white, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontSize: 12 }}>{t("deptSched.cancel")}</button>
                <button onClick={handleCreateLeave} style={{ padding: "4px 10px", background: C.primary, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Send size={11} />{t("deptSched.submit")}</button>
              </div>
            </div>
          )}
          <div style={{ overflow: "auto" }}>
            {leaveList.map((leave) => <LeaveRow key={leave.id} leave={leave} onApprove={() => handleApprove(leave.id)} onReject={() => handleReject(leave.id)} />)}
          </div>
        </div>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}><span>{t("deptSched.lateEarlyStats")}</span><span style={{ fontSize: 12, color: C.textMid }}>{t("deptSched.thisMonth")}</span></div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ textAlign: "center", padding: 16, background: C.warningBg, borderRadius: 8 }}>
                <AlertTriangle style={{ width: 24, height: 24, color: C.warning, margin: "0 auto 8px" }} />
                <div style={{ fontSize: 24, fontWeight: 700, color: C.warning }}>8</div>
                <div style={{ fontSize: 12, color: C.textMid }}>{t("deptSched.lateCount")}</div>
              </div>
              <div style={{ textAlign: "center", padding: 16, background: C.infoBg, borderRadius: 8 }}>
                <Clock style={{ width: 24, height: 24, color: C.info, margin: "0 auto 8px" }} />
                <div style={{ fontSize: 24, fontWeight: 700, color: C.info }}>4</div>
                <div style={{ fontSize: 12, color: C.textMid }}>{t("deptSched.earlyCount")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
