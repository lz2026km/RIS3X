// @ts-nocheck
import { Edit3 } from "lucide-react";

const C = {
  primary: "#1e40af", primaryLight: "#3b82f6", primaryLighter: "#dbeafe",
  accent: "#0891b2", white: "#ffffff", bg: "#e8e8e8", border: "#d1d5db",
  borderLight: "#e5e7eb", textDark: "#1f2937", textMid: "#4b5563", textLight: "#9ca3af",
  success: "#059669", successBg: "#d1fae5", warning: "#d97706", warningBg: "#fef3c7",
  danger: "#dc2626", dangerBg: "#fee2e2", info: "#2563eb", infoBg: "#dbeafe",
  purple: "#7c3aed", purpleBg: "#ede9fe",
};

const ROLES = {
  director: { label: "主任", color: "#dc2626", icon: null, permission: ["report_write", "report_review", "report_print", "device_operate", "data_export", "system_config", "user_manage"] },
  vice_director: { label: "副主任", color: "#d97706", icon: null, permission: ["report_write", "report_review", "report_print", "device_operate", "data_export", "system_config"] },
  physician: { label: "医师", color: "#059669", icon: null, permission: ["report_write", "report_review", "report_print"] },
  technician: { label: "技师", color: "#3b82f6", icon: null, permission: ["device_operate", "report_print"] },
  nurse: { label: "护士", color: "#7c3aed", icon: null, permission: ["report_print"] },
  intern: { label: "实习生", color: "#6b7280", icon: null, permission: [] },
};

const PERMISSIONS = [
  { key: "report_write", label: "报告书写", icon: null },
  { key: "report_review", label: "报告审核", icon: null },
  { key: "report_print", label: "报告打印", icon: null },
  { key: "device_operate", label: "设备操作", icon: null },
  { key: "data_export", label: "数据导出", icon: null },
  { key: "system_config", label: "系统配置", icon: null },
  { key: "user_manage", label: "用户管理", icon: null },
];

export const DEPT_STAFF = [
  { id: "S001", name: "张伟明", role: "director", title: "主任医师", dept: "放射科", phone: "138****1001", email: "zhangwm@hospital.com", status: "online", joinDate: "2015-08-01" },
  { id: "S002", name: "李秀英", role: "vice_director", title: "副主任医师", dept: "放射科", phone: "138****1002", email: "lixy@hospital.com", status: "online", joinDate: "2016-03-15" },
  { id: "S003", name: "王建国", role: "physician", title: "主治医师", dept: "CT组", phone: "138****1003", email: "wangjg@hospital.com", status: "online", joinDate: "2018-07-01" },
  { id: "S004", name: "刘芳", role: "physician", title: "副主任医师", dept: "MR组", phone: "138****1004", email: "liuf@hospital.com", status: "busy", joinDate: "2017-05-20" },
  { id: "S005", name: "陈海涛", role: "physician", title: "主治医师", dept: "DR组", phone: "138****1005", email: "chenht@hospital.com", status: "online", joinDate: "2019-09-01" },
  { id: "S006", name: "赵志刚", role: "technician", title: "主管技师", dept: "CT组", phone: "138****1006", email: "zhaozg@hospital.com", status: "online", joinDate: "2016-11-01" },
  { id: "S007", name: "孙伟", role: "technician", title: "技师", dept: "MR组", phone: "138****1007", email: "sunw@hospital.com", status: "offline", joinDate: "2020-01-15" },
  { id: "S008", name: "周婷", role: "technician", title: "技师", dept: "DR组", phone: "138****1008", email: "zhout@hospital.com", status: "online", joinDate: "2021-03-01" },
  { id: "S009", name: "吴敏", role: "nurse", title: "主管护师", dept: "放射科", phone: "138****1009", email: "wumin@hospital.com", status: "online", joinDate: "2017-08-01" },
  { id: "S010", name: "郑晓丽", role: "nurse", title: "护师", dept: "放射科", phone: "138****1010", email: "zhengxl@hospital.com", status: "busy", joinDate: "2019-06-01" },
  { id: "S011", name: "黄志强", role: "physician", title: "住院医师", dept: "DSA组", phone: "138****1011", email: "huangzq@hospital.com", status: "online", joinDate: "2022-07-01" },
  { id: "S012", name: "林建军", role: "technician", title: "技师", dept: "DSA组", phone: "138****1012", email: "linjj@hospital.com", status: "online", joinDate: "2020-09-01" },
  { id: "S013", name: "马云飞", role: "intern", title: "实习医生", dept: "CT组", phone: "138****1013", email: "mayf@hospital.com", status: "online", joinDate: "2024-06-01" },
  { id: "S014", name: "李雪", role: "intern", title: "实习技师", dept: "MR组", phone: "138****1014", email: "lixue@hospital.com", status: "offline", joinDate: "2024-06-01" },
  { id: "S015", name: "高峰", role: "physician", title: "主治医师", dept: "放射科", phone: "138****1015", email: "gaof@hospital.com", status: "online", joinDate: "2018-02-01" },
];

const PermissionTag = ({ permission }) => {
  const p = PERMISSIONS.find((x) => x.key === permission);
  if (!p) return null;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: C.primaryLighter, color: C.primary, borderRadius: 4, fontSize: 12, margin: "2px" }}>{p.label}</span>;
};

const StaffCard = ({ staff, isSelected, onClick }) => {
  const role = ROLES[staff.role];
  const statusColors = { online: C.success, busy: C.warning, offline: C.textLight };
  return (
    <div style={{ background: isSelected ? C.primaryLighter : C.white, borderRadius: 8, padding: "12px 16px", cursor: "pointer", border: `1px solid ${isSelected ? C.primary : C.borderLight}`, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 12 }} onClick={onClick}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: role?.color || C.textLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 16, fontWeight: 600, position: "relative" }}>
        {staff.name.charAt(0)}
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: statusColors[staff.status] || C.textLight, border: "2px solid white" }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark }}>{staff.name}</div>
        <div style={{ fontSize: 12, color: role?.color || C.textMid }}>{role?.label} · {staff.title}</div>
      </div>
    </div>
  );
};

export default function DepartmentStaffList({ selectedStaff, setSelectedStaff, roleFilter, setRoleFilter, searchKeyword, setSearchKeyword, onEdit, extraStaff = [] }) {
  const filteredStaff = [...DEPT_STAFF, ...extraStaff].filter((s) => {
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    const matchSearch = !searchKeyword || s.name.includes(searchKeyword) || s.title.includes(searchKeyword);
    return matchRole && matchSearch;
  });

  const roleFilters = [
    { key: "all", label: "全部" }, { key: "director", label: "主任" }, { key: "vice_director", label: "副主任" },
    { key: "physician", label: "医师" }, { key: "technician", label: "技师" }, { key: "nurse", label: "护士" }, { key: "intern", label: "实习生" },
  ];

  const panelStyle = { background: C.white, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: `1px solid ${C.borderLight}`, overflow: "hidden" };
  const panelHeaderStyle = { padding: "12px 16px", borderBottom: `1px solid ${C.borderLight}`, fontSize: 14, fontWeight: 600, color: C.textDark, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f9fafb" };
  const panelBodyStyle = { padding: 16 };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 16, marginBottom: 16 }}>
      <div style={panelStyle}>
        <div style={panelHeaderStyle}><span>科室人员</span><span style={{ fontSize: 12, color: C.textLight }}>{filteredStaff.length}人</span></div>
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="text" placeholder="搜索姓名/职称..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} style={{ flex: 1, padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: "none" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {roleFilters.map((f) => (
              <button key={f.key} onClick={() => setRoleFilter(f.key)} style={{ padding: "3px 10px", border: `1px solid ${roleFilter === f.key ? C.primary : C.border}`, background: roleFilter === f.key ? C.primaryLighter : C.white, color: roleFilter === f.key ? C.primary : C.textMid, borderRadius: 4, fontSize: 12, cursor: "pointer" }}>{f.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflow: "auto" }}>
            {filteredStaff.map((staff) => (
              <StaffCard key={staff.id} staff={staff} isSelected={selectedStaff?.id === staff.id} onClick={() => setSelectedStaff(staff)} />
            ))}
          </div>
        </div>
      </div>
      <div style={panelStyle}>
        <div style={panelHeaderStyle}><span>人员详情</span><button onClick={onEdit} style={{ padding: "4px 12px", background: C.primary, color: C.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Edit3 style={{ width: 12, height: 12 }} /> 编辑</button></div>
        <div style={panelBodyStyle}>
          {selectedStaff && (
            <div>
              <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: ROLES[selectedStaff.role]?.color || C.textLight, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 32, fontWeight: 600 }}>{selectedStaff.name.charAt(0)}</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>{selectedStaff.name}</div>
                  <div style={{ fontSize: 14, color: ROLES[selectedStaff.role]?.color, marginBottom: 8 }}>{ROLES[selectedStaff.role]?.label} · {selectedStaff.title}</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, color: C.textMid }}><span>工号：{selectedStaff.id}</span><span>科室：{selectedStaff.dept}</span></div>
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 8 }}>联系信息</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ fontSize: 13 }}><span style={{ color: C.textMid }}>电话：</span>{selectedStaff.phone}</div>
                  <div style={{ fontSize: 13 }}><span style={{ color: C.textMid }}>邮箱：</span>{selectedStaff.email}</div>
                  <div style={{ fontSize: 13 }}><span style={{ color: C.textMid }}>入职日期：</span>{selectedStaff.joinDate}</div>
                  <div style={{ fontSize: 13 }}><span style={{ color: C.textMid }}>状态：</span><span style={{ color: selectedStaff.status === "online" ? C.success : selectedStaff.status === "busy" ? C.warning : C.textLight }}>{selectedStaff.status === "online" ? "在线" : selectedStaff.status === "busy" ? "工作中" : "离线"}</span></div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 12, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 8 }}>权限配置</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {(ROLES[selectedStaff.role]?.permission || []).map((p) => <PermissionTag key={p} permission={p} />)}
                  {(!ROLES[selectedStaff.role]?.permission || []).length === 0 && <span style={{ fontSize: 13, color: C.textLight, fontStyle: "italic" }}>暂无权限</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
