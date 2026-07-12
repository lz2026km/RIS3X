# 发布说明 v3.0.6.11-18

> 发布日期: 2026-07-12  
> 审查模式: 20 agent 全栈严格审查 + P0 自动修复

## 审查范围
- 20 个专项 agent 并行审查全部代码
- Phase A: 前端 (FE 代码质量/状态管理/a11y/i18n/安全/性能)
- Phase B: 后端 (BE 架构/安全/数据层/API/错误处理/测试)
- Phase C: 医疗协议 (HL7 v2.x/DICOM DIMSE/FHIR R4/IHE 集成)
- Phase D: 部署文档 (K8s/监控/三甲评审/运维文档)

## 关键变更
- 185+ P0 问题自动修复
- 89 新增后端单元测试
- HL7 段分隔符/段偏移纠正 (HL7 v2.5.1 标准)
- DICOM C-ECHO/C-FIND/C-STORE/C-MOVE 标准符合
- FHIR R4 Resource 必填字段 + $export 参数 + NDJSON
- IHE PAM 五态机/A13/A11 状态纠正 + PIX 真实映射
- K8s Ingress TLS + Service 5173 + ConfigMap/Secret
- Prometheus 8 条告警规则 + Grafana 仪表盘
- 三甲评审 11/11 条款覆盖，72 项报告矩阵
- 版本号统一 v3.0.6.11-18（前端 + 后端同步）

## 验证
- pnpm build: 39.74s ✅
- E2E: 0 JS errors ✅
- APP 版本: 3.0.6.11-18 ✅
