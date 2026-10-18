import { useState } from "react";
import {
  ArrowLeft,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  X,
} from "lucide-react";
import type { GenderFilter, PatientTypeFilter, PatientFormData } from "./types";
import { FormField, FormSubmitBar } from "../../components/common/FormField";
import { t } from "../../i18n/appI18n";
// [v3.0.6.16-0] 原生 select 改用设计系统 AppSelectField
import { AppSelectField } from "../../components/common/AppSelectField";

interface RegistrationWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: PatientFormData) => void;
}

function RegistrationWizard({
  open,
  onClose,
  onComplete,
}: RegistrationWizardProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PatientFormData>({
    name: "",
    gender: "男" as GenderFilter,
    age: "",
    idCard: "",
    phone: "",
    address: "",
    emergencyContact: "",
    emergencyPhone: "",
    patientType: "门诊" as PatientTypeFilter,
    insuranceType: "",
    allergyHistory: "",
    medicalHistory: "",
    bedNumber: "",
    attendingDoctor: "",
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const validateStep = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (step === 1) {
      if (!formData.name.trim()) e.name = t("patientForm.enterName");
      if (!formData.idCard.trim()) e.idCard = t("patientForm.enterIdCard");
      else if (formData.idCard.length !== 18)
        e.idCard = t("patientForm.idCard18");
      if (!formData.phone.trim()) e.phone = t("patientForm.enterPhone");
      else if (!/^1[3-9]\d{9}$/.test(formData.phone))
        e.phone = t("patientForm.phoneInvalid");
    } else if (step === 2) {
      if (!formData.allergyHistory.trim())
        e.allergyHistory = t("patientForm.allergyRequired");
    } else if (step === 3) {
      if (!formData.emergencyContact.trim())
        e.emergencyContact = t("patientForm.enterContact");
      if (!formData.emergencyPhone.trim())
        e.emergencyPhone = t("patientForm.enterContactPhone");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, 3));
  };
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = () => {
    if (validateStep()) {
      onComplete(formData);
      setStep(1);
      setFormData({
        name: "",
        gender: "男",
        age: "",
        idCard: "",
        phone: "",
        address: "",
        emergencyContact: "",
        emergencyPhone: "",
        patientType: "门诊",
        insuranceType: "",
        allergyHistory: "",
        medicalHistory: "",
        bedNumber: "",
        attendingDoctor: "",
      });
      setErrors({});
      onClose();
    }
  };

  const inputStyle = (field: string) => ({
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${errors[field] ? "var(--color-error-600)" : "var(--border-color)"}`,
    fontSize: 12,
    boxSizing: "border-box" as const,
  });

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 16,
          width: 560,
          maxHeight: "90vh",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-color)",
            background:
              "linear-gradient(135deg, var(--color-primary-800), var(--color-primary-500))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3, 12px)",
              }}
            >
              <UserPlus size={22} color="#fff" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                  {t("patientForm.newRecord")}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.7)",
                    marginTop: 2,
                  }}
                >
                  {t("patientForm.stepOf", { step })}
                </div>
              </div>
            </div>
            <button
              aria-label="关闭"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "none",
                background: "rgba(255,255,255,0.2)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color="#fff" />
            </button>
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-2, 8px)",
              marginTop: "var(--space-4, 16px)",
            }}
          >
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2, 8px)",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    background: step >= s ? "#fff" : "rgba(255,255,255,0.3)",
                    color:
                      step >= s
                        ? "var(--color-primary-800)"
                        : "rgba(255,255,255,0.6)",
                  }}
                >
                  {s}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: step >= s ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {s === 1
                    ? t("patientForm.stepBasic")
                    : s === 2
                      ? t("patientForm.stepMedical")
                      : t("patientForm.stepEmergency")}
                </div>
                {s < 3 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: step > s ? "#fff" : "rgba(255,255,255,0.3)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{ flex: 1, overflow: "auto", padding: "var(--space-6, 24px)" }}
        >
          {step === 1 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4, 16px)",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.name")}{" "}
                  <span style={{ color: "var(--color-error-600)" }}>*</span>
                </label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t("patientForm.namePlaceholder")}
                  style={inputStyle("name")}
                />
                {errors.name && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-error-600)",
                      marginTop: "var(--space-1, 4px)",
                    }}
                  >
                    {errors.name}
                  </div>
                )}
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.gender")}
                </label>
                <div
                  role="radiogroup"
                  aria-label={t("patientForm.gender")}
                  style={{
                    display: "flex",
                    gap: "var(--space-4, 16px)",
                    paddingTop: "var(--space-1, 4px)",
                  }}
                >
                  {(["男", "女"] as GenderFilter[]).map((g) => (
                    <label
                      key={g}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--text-primary, #334155)",
                      }}
                    >
                      <input
                        type="radio"
                        name="wizard-gender"
                        value={g}
                        checked={formData.gender === g}
                        aria-label={`性别-${g}`}
                        onChange={() => setFormData({ ...formData, gender: g })}
                        style={{
                          cursor: "pointer",
                          accentColor: "var(--color-primary-800)",
                        }}
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.age")}
                </label>
                <input
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  type="number"
                  placeholder={t("patientForm.agePlaceholder")}
                  style={inputStyle("age")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.idCard")}{" "}
                  <span style={{ color: "var(--color-error-600)" }}>*</span>
                </label>
                <input
                  value={formData.idCard}
                  onChange={(e) =>
                    setFormData({ ...formData, idCard: e.target.value })
                  }
                  placeholder={t("patientForm.idCardPlaceholder")}
                  maxLength={18}
                  style={inputStyle("idCard")}
                />
                {errors.idCard && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-error-600)",
                      marginTop: "var(--space-1, 4px)",
                    }}
                  >
                    {errors.idCard}
                  </div>
                )}
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.phone")}{" "}
                  <span style={{ color: "var(--color-error-600)" }}>*</span>
                </label>
                <input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder={t("patientForm.phonePlaceholder")}
                  maxLength={11}
                  style={inputStyle("phone")}
                />
                {errors.phone && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-error-600)",
                      marginTop: "var(--space-1, 4px)",
                    }}
                  >
                    {errors.phone}
                  </div>
                )}
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.patientType")}
                </label>
                <AppSelectField
                  value={formData.patientType}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      patientType: String(v ?? "") as PatientTypeFilter,
                    })
                  }
                  options={(
                    ["门诊", "住院", "体检", "急诊"] as PatientTypeFilter[]
                  ).map((pt) => ({ value: pt, label: pt }))}
                  style={inputStyle("patientType")}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.address")}
                </label>
                <input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder={t("patientForm.addressPlaceholder")}
                  style={inputStyle("address")}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4, 16px)",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.allergyHistory")}{" "}
                  <span
                    style={{ color: "var(--color-error-600)" }}
                    aria-label={t("patientForm.required")}
                  >
                    *
                  </span>
                </label>
                <textarea
                  aria-label={t("patientForm.allergyHistory")}
                  value={formData.allergyHistory}
                  onChange={(e) =>
                    setFormData({ ...formData, allergyHistory: e.target.value })
                  }
                  placeholder={t("patientForm.allergyPlaceholder")}
                  rows={3}
                  maxLength={500}
                  style={{
                    ...inputStyle("allergyHistory"),
                    resize: "vertical" as const,
                    fontFamily: "inherit",
                  }}
                />
                {errors.allergyHistory && (
                  <div
                    role="alert"
                    style={{
                      fontSize: 12,
                      color: "var(--color-error-600)",
                      marginTop: "var(--space-1, 4px)",
                    }}
                  >
                    {errors.allergyHistory}
                  </div>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.medicalHistory")}
                </label>
                <textarea
                  value={formData.medicalHistory}
                  onChange={(e) =>
                    setFormData({ ...formData, medicalHistory: e.target.value })
                  }
                  placeholder={t("patientForm.medicalHistoryPlaceholder")}
                  rows={3}
                  style={{
                    ...inputStyle("medicalHistory"),
                    resize: "vertical" as const,
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.insuranceType")}
                </label>
                <AppSelectField
                  value={formData.insuranceType}
                  onChange={(v) =>
                    setFormData({ ...formData, insuranceType: String(v ?? "") })
                  }
                  placeholder={t("patientForm.select")}
                  allowClear
                  options={[
                    {
                      value: "城镇职工基本医疗保险",
                      label: "城镇职工基本医疗保险",
                    },
                    {
                      value: "城乡居民基本医疗保险",
                      label: "城乡居民基本医疗保险",
                    },
                    { value: "商业医疗保险", label: "商业医疗保险" },
                    { value: "自费", label: "自费" },
                  ]}
                  style={inputStyle("insuranceType")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.bedNumber")}
                </label>
                <input
                  value={formData.bedNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, bedNumber: e.target.value })
                  }
                  placeholder={t("patientForm.bedPlaceholder")}
                  style={inputStyle("bedNumber")}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.attendingDoctor")}
                </label>
                <input
                  value={formData.attendingDoctor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendingDoctor: e.target.value,
                    })
                  }
                  placeholder={t("patientForm.doctorPlaceholder")}
                  style={inputStyle("attendingDoctor")}
                />
              </div>
              {/* [G005 W6] 结构化登记字段 */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  marginTop: "var(--space-1, 4px)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--color-primary-800)",
                    marginBottom: "var(--space-2, 8px)",
                  }}
                >
                  {t("patientForm.structuredAllergy")}
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.idType")}
                </label>
                <AppSelectField
                  value={formData.idType ?? "ID_CARD"}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      idType: String(v ?? "") as PatientFormData["idType"],
                    })
                  }
                  options={[
                    { value: "ID_CARD", label: t("patientForm.idTypeIdCard") },
                    {
                      value: "PASSPORT",
                      label: t("patientForm.idTypePassport"),
                    },
                    {
                      value: "OFFICER_CARD",
                      label: t("patientForm.idTypeOfficer"),
                    },
                    {
                      value: "BIRTH_CERT",
                      label: t("patientForm.idTypeBirth"),
                    },
                    { value: "OTHER", label: t("patientForm.idTypeOther") },
                  ]}
                  style={inputStyle("idType")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.empiId")}
                </label>
                <input
                  value={formData.empiId ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, empiId: e.target.value })
                  }
                  placeholder="EMPI-000001"
                  style={inputStyle("empiId")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.insuranceNo")}
                </label>
                <input
                  value={formData.insuranceNo ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, insuranceNo: e.target.value })
                  }
                  placeholder="YB-1101010001"
                  style={inputStyle("insuranceNo")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.pregnancyStatus")}
                </label>
                <AppSelectField
                  value={formData.pregnancyStatus ?? "NOT_APPLICABLE"}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      pregnancyStatus: String(
                        v ?? "",
                      ) as PatientFormData["pregnancyStatus"],
                    })
                  }
                  options={[
                    { value: "NONE", label: t("patientForm.pregNone") },
                    { value: "PREGNANT", label: t("patientForm.pregPregnant") },
                    { value: "UNKNOWN", label: t("patientForm.pregUnknown") },
                    {
                      value: "NOT_APPLICABLE",
                      label: t("patientForm.pregNotApplicable"),
                    },
                    {
                      value: "POSTPARTUM",
                      label: t("patientForm.pregPostpartum"),
                    },
                  ]}
                  style={inputStyle("pregnancyStatus")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.heightCm")}
                </label>
                <input
                  value={formData.heightCm ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, heightCm: e.target.value })
                  }
                  placeholder="170"
                  style={inputStyle("heightCm")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.weightKg")}
                </label>
                <input
                  value={formData.weightKg ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, weightKg: e.target.value })
                  }
                  placeholder="65"
                  style={inputStyle("weightKg")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.egfr")}
                </label>
                <input
                  value={formData.egfr ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, egfr: e.target.value })
                  }
                  placeholder="78"
                  style={inputStyle("egfr")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.creatinine")}
                </label>
                <input
                  value={formData.creatinine ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, creatinine: e.target.value })
                  }
                  placeholder="92"
                  style={inputStyle("creatinine")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.egfrSource")}
                </label>
                <AppSelectField
                  value={formData.egfrSource ?? "LIS"}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      egfrSource: String(
                        v ?? "",
                      ) as PatientFormData["egfrSource"],
                    })
                  }
                  options={[
                    { value: "LIS", label: t("patientForm.egfrLIS") },
                    { value: "MANUAL", label: t("patientForm.egfrManual") },
                    {
                      value: "CALCULATED",
                      label: t("patientForm.egfrCalculated"),
                    },
                  ]}
                  style={inputStyle("egfrSource")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.isolationFlag")}
                </label>
                <AppSelectField
                  value={formData.isolationFlag ?? "NONE"}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      isolationFlag: String(
                        v ?? "",
                      ) as PatientFormData["isolationFlag"],
                    })
                  }
                  options={[
                    { value: "NONE", label: t("patientForm.isolationNone") },
                    {
                      value: "CONTACT",
                      label: t("patientForm.isolationContact"),
                    },
                    {
                      value: "DROPLET",
                      label: t("patientForm.isolationDroplet"),
                    },
                    {
                      value: "AIRBORNE",
                      label: t("patientForm.isolationAirborne"),
                    },
                    {
                      value: "PROTECTIVE",
                      label: t("patientForm.isolationProtective"),
                    },
                  ]}
                  style={inputStyle("isolationFlag")}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary, #334155)",
                    }}
                  >
                    {t("patientForm.structuredAllergy")}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        structuredAllergyCodes: [
                          ...(formData.structuredAllergyCodes ?? []),
                          { code: "", display: "", severity: "UNKNOWN" },
                        ],
                      })
                    }
                    style={{
                      fontSize: 12,
                      color: "var(--color-primary-800)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    + {t("patientForm.addAllergy")}
                  </button>
                </div>
                {(formData.structuredAllergyCodes ?? []).map((a, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 2fr 1fr auto",
                      gap: "var(--space-2, 8px)",
                      marginBottom: 6,
                    }}
                  >
                    <input
                      value={a.code}
                      onChange={(e) => {
                        const list = [
                          ...(formData.structuredAllergyCodes ?? []),
                        ];
                        list[idx] = { ...list[idx]!, code: e.target.value };
                        setFormData({
                          ...formData,
                          structuredAllergyCodes: list,
                        });
                      }}
                      placeholder={t("patientForm.allergyCode")}
                      style={inputStyle(`allergyCode-${idx}`)}
                    />
                    <input
                      value={a.display}
                      onChange={(e) => {
                        const list = [
                          ...(formData.structuredAllergyCodes ?? []),
                        ];
                        list[idx] = { ...list[idx]!, display: e.target.value };
                        setFormData({
                          ...formData,
                          structuredAllergyCodes: list,
                        });
                      }}
                      placeholder={t("patientForm.allergyDisplay")}
                      style={inputStyle(`allergyDisplay-${idx}`)}
                    />
                    <AppSelectField
                      value={a.severity}
                      onChange={(v) => {
                        const list = [
                          ...(formData.structuredAllergyCodes ?? []),
                        ];
                        list[idx] = {
                          ...list[idx]!,
                          severity: String(v ?? "") as typeof a.severity,
                        };
                        setFormData({
                          ...formData,
                          structuredAllergyCodes: list,
                        });
                      }}
                      options={[
                        { value: "MILD", label: "MILD" },
                        { value: "MODERATE", label: "MODERATE" },
                        { value: "SEVERE", label: "SEVERE" },
                        { value: "UNKNOWN", label: "UNKNOWN" },
                      ]}
                      style={inputStyle(`allergySeverity-${idx}`)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          structuredAllergyCodes: (
                            formData.structuredAllergyCodes ?? []
                          ).filter((_, i) => i !== idx),
                        })
                      }
                      style={{
                        fontSize: 12,
                        color: "var(--color-error-600)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                      aria-label={t("patientForm.removeAllergy")}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4, 16px)",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.emergencyContact")}{" "}
                  <span style={{ color: "var(--color-error-600)" }}>*</span>
                </label>
                <input
                  value={formData.emergencyContact}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergencyContact: e.target.value,
                    })
                  }
                  placeholder={t("patientForm.contactNamePlaceholder")}
                  style={inputStyle("emergencyContact")}
                />
                {errors.emergencyContact && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-error-600)",
                      marginTop: "var(--space-1, 4px)",
                    }}
                  >
                    {errors.emergencyContact}
                  </div>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary, #334155)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t("patientForm.contactPhone")}{" "}
                  <span style={{ color: "var(--color-error-600)" }}>*</span>
                </label>
                <input
                  value={formData.emergencyPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, emergencyPhone: e.target.value })
                  }
                  placeholder={t("patientForm.contactPhonePlaceholder")}
                  maxLength={11}
                  style={inputStyle("emergencyPhone")}
                />
                {errors.emergencyPhone && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-error-600)",
                      marginTop: "var(--space-1, 4px)",
                    }}
                  >
                    {errors.emergencyPhone}
                  </div>
                )}
              </div>
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "var(--space-4, 16px)",
                  background: "var(--color-success-bg, #f0fdf4)",
                  borderRadius: 8,
                  border: "1px solid #bbf7d0",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2, 8px)",
                }}
              >
                <CheckCircle size={16} color="var(--color-success-600)" />
                <span style={{ fontSize: 12, color: "#166534" }}>
                  {t("patientForm.confirmHint")}
                </span>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            background: "var(--bg-primary)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              color: "var(--text-muted, #64748b)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("patientForm.cancel")}
          </button>
          <div style={{ display: "flex", gap: "var(--space-2, 8px)" }}>
            {step > 1 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-muted, #64748b)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ChevronLeft size={14} />
                {t("patientForm.prev")}
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={handleNext}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--color-primary-800)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {t("patientForm.next")} <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "#059669",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle size={14} />
                {t("patientForm.finish")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface PatientCreateFormProps {
  selectedPatientForEdit: import("../../types").Patient | null;
  formData: PatientFormData;
  formErrors: Partial<Record<keyof PatientFormData, string>>;
  onFormDataChange: (data: PatientFormData) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PatientCreateForm({
  selectedPatientForEdit,
  formData,
  formErrors,
  onFormDataChange,
  onSave,
  onCancel,
}: PatientCreateFormProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--border-color)",
        padding: "var(--space-6, 24px)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3, 12px)",
          marginBottom: "var(--space-6, 24px)",
        }}
      >
        <button
          aria-label="关闭"
          onClick={onCancel}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={16} color="#64748b" />
        </button>
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--color-primary-800)",
            }}
          >
            {selectedPatientForEdit
              ? t("patientForm.editRecord")
              : t("patientForm.newRecord")}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted, #64748b)",
              marginTop: 2,
            }}
          >
            {selectedPatientForEdit
              ? `患者ID: ${selectedPatientForEdit.id}`
              : t("patientForm.fillInfo")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-5, 20px)",
        }}
      >
        <FormField
          label={t("patientForm.name")}
          required
          error={formErrors.name}
        >
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              onFormDataChange({ ...formData, name: e.target.value })
            }
            placeholder={t("patientForm.namePlaceholder")}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.name ? "var(--color-error-600)" : "var(--border-color)"}`,
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </FormField>
        <FormField label={t("patientForm.gender")} required>
          <div
            role="radiogroup"
            aria-label={t("patientForm.gender")}
            style={{
              display: "flex",
              gap: "var(--space-4, 16px)",
              paddingTop: "var(--space-1, 4px)",
            }}
          >
            {(["男", "女"] as GenderFilter[]).map((g) => (
              <label
                key={g}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--text-primary, #334155)",
                }}
              >
                <input
                  type="radio"
                  name="patient-gender"
                  value={g}
                  checked={formData.gender === g}
                  aria-label={`性别-${g}`}
                  onChange={() => onFormDataChange({ ...formData, gender: g })}
                  style={{
                    cursor: "pointer",
                    accentColor: "var(--color-primary-800)",
                  }}
                />
                {g}
              </label>
            ))}
          </div>
        </FormField>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.age")}
          </label>
          <input
            type="number"
            value={formData.age}
            onChange={(e) =>
              onFormDataChange({ ...formData, age: e.target.value })
            }
            placeholder={t("patientForm.enterAge")}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </div>
        <FormField
          label={t("patientForm.idCard")}
          required
          error={formErrors.idCard}
        >
          <input
            type="text"
            value={formData.idCard}
            onChange={(e) =>
              onFormDataChange({ ...formData, idCard: e.target.value })
            }
            placeholder={t("patientForm.enterIdCard18")}
            maxLength={18}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.idCard ? "var(--color-error-600)" : "var(--border-color)"}`,
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </FormField>
        <FormField
          label={t("patientForm.phone")}
          required
          error={formErrors.phone}
        >
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              onFormDataChange({ ...formData, phone: e.target.value })
            }
            placeholder={t("patientForm.enterPhone")}
            maxLength={11}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.phone ? "var(--color-error-600)" : "var(--border-color)"}`,
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </FormField>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.patientType")}
          </label>
          <AppSelectField
            value={formData.patientType}
            onChange={(v) =>
              onFormDataChange({
                ...formData,
                patientType: String(v ?? "") as PatientTypeFilter,
              })
            }
            options={(
              ["门诊", "住院", "体检", "急诊"] as PatientTypeFilter[]
            ).map((pt) => ({ value: pt, label: pt }))}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 12,
              background: "var(--bg-card)",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.address")}
          </label>
          <textarea
            aria-label={t("patientForm.address")}
            value={formData.address}
            onChange={(e) =>
              onFormDataChange({ ...formData, address: e.target.value })
            }
            placeholder={t("patientForm.enterAddress")}
            rows={2}
            maxLength={200}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 12,
              boxSizing: "border-box",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.contactName")}{" "}
            <span style={{ color: "var(--color-error-600)" }}>*</span>
          </label>
          <input
            type="text"
            value={formData.emergencyContact}
            onChange={(e) =>
              onFormDataChange({
                ...formData,
                emergencyContact: e.target.value,
              })
            }
            placeholder={t("patientForm.enterContactName")}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.emergencyContact ? "var(--color-error-600)" : "var(--border-color)"}`,
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
          {formErrors.emergencyContact && (
            <div
              style={{
                fontSize: 12,
                color: "var(--color-error-600)",
                marginTop: "var(--space-1, 4px)",
              }}
            >
              {formErrors.emergencyContact}
            </div>
          )}
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.contactPhone")}{" "}
            <span style={{ color: "var(--color-error-600)" }}>*</span>
          </label>
          <input
            type="tel"
            value={formData.emergencyPhone}
            onChange={(e) =>
              onFormDataChange({ ...formData, emergencyPhone: e.target.value })
            }
            placeholder={t("patientForm.enterContactPhone")}
            maxLength={11}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.emergencyPhone ? "var(--color-error-600)" : "var(--border-color)"}`,
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
          {formErrors.emergencyPhone && (
            <div
              style={{
                fontSize: 12,
                color: "var(--color-error-600)",
                marginTop: "var(--space-1, 4px)",
              }}
            >
              {formErrors.emergencyPhone}
            </div>
          )}
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.insuranceType")}
          </label>
          <AppSelectField
            value={formData.insuranceType}
            onChange={(v) =>
              onFormDataChange({ ...formData, insuranceType: String(v ?? "") })
            }
            placeholder={t("patientForm.select")}
            allowClear
            options={[
              { value: "城镇职工基本医疗保险", label: "城镇职工基本医疗保险" },
              { value: "城乡居民基本医疗保险", label: "城乡居民基本医疗保险" },
              { value: "商业医疗保险", label: "商业医疗保险" },
              { value: "自费", label: "自费" },
            ]}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 12,
              background: "var(--bg-card)",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.bedNumber")}
          </label>
          <input
            type="text"
            value={formData.bedNumber}
            onChange={(e) =>
              onFormDataChange({ ...formData, bedNumber: e.target.value })
            }
            placeholder="如：3床"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.attendingDoctor")}
          </label>
          <input
            type="text"
            value={formData.attendingDoctor}
            onChange={(e) =>
              onFormDataChange({ ...formData, attendingDoctor: e.target.value })
            }
            placeholder={t("patientForm.enterDoctor")}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.allergyHistory")}
          </label>
          <textarea
            aria-label={t("patientForm.allergyHistory")}
            value={formData.allergyHistory}
            onChange={(e) =>
              onFormDataChange({ ...formData, allergyHistory: e.target.value })
            }
            placeholder={t("patientForm.enterAllergy")}
            rows={2}
            maxLength={500}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 12,
              boxSizing: "border-box",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary, #334155)",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t("patientForm.medicalHistory")}
          </label>
          <textarea
            aria-label={t("patientForm.medicalHistory")}
            value={formData.medicalHistory}
            onChange={(e) =>
              onFormDataChange({ ...formData, medicalHistory: e.target.value })
            }
            placeholder={t("patientForm.enterMedicalHistory")}
            rows={3}
            maxLength={500}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 12,
              boxSizing: "border-box",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-3, 12px)",
          marginTop: "var(--space-8, 32px)",
          paddingTop: "var(--space-6, 24px)",
          borderTop: "1px solid var(--border-color)",
        }}
      >
        <FormSubmitBar
          onCancel={onCancel}
          onSubmit={onSave}
          submitText={t("patientForm.saveInfo")}
        />
      </div>
    </div>
  );
}

export { RegistrationWizard };
