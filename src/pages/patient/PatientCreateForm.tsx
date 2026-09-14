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
      if (!formData.name.trim()) e.name = t('patientForm.enterName');
      if (!formData.idCard.trim()) e.idCard = t('patientForm.enterIdCard');
      else if (formData.idCard.length !== 18) e.idCard = t('patientForm.idCard18');
      if (!formData.phone.trim()) e.phone = t('patientForm.enterPhone');
      else if (!/^1[3-9]\d{9}$/.test(formData.phone))
        e.phone = t('patientForm.phoneInvalid');
    } else if (step === 2) {
      if (!formData.allergyHistory.trim())
        e.allergyHistory = t('patientForm.allergyRequired');
    } else if (step === 3) {
      if (!formData.emergencyContact.trim())
        e.emergencyContact = t('patientForm.enterContact');
      if (!formData.emergencyPhone.trim())
        e.emergencyPhone = t('patientForm.enterContactPhone');
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
    border: `1px solid ${errors[field] ? "#dc2626" : "var(--border-color)"}`,
    fontSize: 13,
    outline: "none",
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
            background: "linear-gradient(135deg, #1e40af, #3b82f6)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <UserPlus size={22} color="#fff" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                  {t('patientForm.newRecord')}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.7)",
                    marginTop: 2,
                  }}
                >
                  {t('patientForm.stepOf', { step })}
                </div>
              </div>
            </div>
            <button
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
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
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
                    color: step >= s ? "#1e40af" : "rgba(255,255,255,0.6)",
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
                  {s === 1 ? t('patientForm.stepBasic') : s === 2 ? t('patientForm.stepMedical') : t('patientForm.stepEmergency')}
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

        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {step === 1 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.name')} <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t('patientForm.namePlaceholder')}
                  style={inputStyle("name")}
                />
                {errors.name && (
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                    {errors.name}
                  </div>
                )}
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.gender')}
                </label>
                <div
                  role="radiogroup"
                  aria-label={t('patientForm.gender')}
                  style={{ display: "flex", gap: 16, paddingTop: 4 }}
                >
                  {(["男", "女"] as GenderFilter[]).map((g) => (
                    <label
                      key={g}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#334155",
                      }}
                    >
                      <input
                        type="radio"
                        name="wizard-gender"
                        value={g}
                        checked={formData.gender === g}
                        aria-label={`性别-${g}`}
                        onChange={() => setFormData({ ...formData, gender: g })}
                        style={{ cursor: "pointer", accentColor: "#1e40af" }}
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
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.age')}
                </label>
                <input
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  type="number"
                  placeholder={t('patientForm.agePlaceholder')}
                  style={inputStyle("age")}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.idCard')} <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  value={formData.idCard}
                  onChange={(e) =>
                    setFormData({ ...formData, idCard: e.target.value })
                  }
                  placeholder={t('patientForm.idCardPlaceholder')}
                  maxLength={18}
                  style={inputStyle("idCard")}
                />
                {errors.idCard && (
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                    {errors.idCard}
                  </div>
                )}
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.phone')} <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder={t('patientForm.phonePlaceholder')}
                  maxLength={11}
                  style={inputStyle("phone")}
                />
                {errors.phone && (
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                    {errors.phone}
                  </div>
                )}
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.patientType')}
                </label>
                <select
                  value={formData.patientType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      patientType: e.target.value as PatientTypeFilter,
                    })
                  }
                  style={inputStyle("patientType")}
                >
                  {(
                    ["门诊", "住院", "体检", "急诊"] as PatientTypeFilter[]
                  ).map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.address')}
                </label>
                <input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder={t('patientForm.addressPlaceholder')}
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
                gap: 16,
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.allergyHistory')}{" "}
                  <span style={{ color: "#dc2626" }} aria-label={t('patientForm.required')}>
                    *
                  </span>
                </label>
                <textarea
                  aria-label={t('patientForm.allergyHistory')}
                  value={formData.allergyHistory}
                  onChange={(e) =>
                    setFormData({ ...formData, allergyHistory: e.target.value })
                  }
                  placeholder={t('patientForm.allergyPlaceholder')}
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
                    style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}
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
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.medicalHistory')}
                </label>
                <textarea
                  value={formData.medicalHistory}
                  onChange={(e) =>
                    setFormData({ ...formData, medicalHistory: e.target.value })
                  }
                  placeholder={t('patientForm.medicalHistoryPlaceholder')}
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
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.insuranceType')}
                </label>
                <select
                  value={formData.insuranceType}
                  onChange={(e) =>
                    setFormData({ ...formData, insuranceType: e.target.value })
                  }
                  style={inputStyle("insuranceType")}
                >
                  <option value="">{t('patientForm.select')}</option>
                  <option value="城镇职工基本医疗保险">
                    城镇职工基本医疗保险
                  </option>
                  <option value="城乡居民基本医疗保险">
                    城乡居民基本医疗保险
                  </option>
                  <option value="商业医疗保险">商业医疗保险</option>
                  <option value="自费">自费</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.bedNumber')}
                </label>
                <input
                  value={formData.bedNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, bedNumber: e.target.value })
                  }
                  placeholder={t('patientForm.bedPlaceholder')}
                  style={inputStyle("bedNumber")}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.attendingDoctor')}
                </label>
                <input
                  value={formData.attendingDoctor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendingDoctor: e.target.value,
                    })
                  }
                  placeholder={t('patientForm.doctorPlaceholder')}
                  style={inputStyle("attendingDoctor")}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.emergencyContact')} <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  value={formData.emergencyContact}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergencyContact: e.target.value,
                    })
                  }
                  placeholder={t('patientForm.contactNamePlaceholder')}
                  style={inputStyle("emergencyContact")}
                />
                {errors.emergencyContact && (
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                    {errors.emergencyContact}
                  </div>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  {t('patientForm.contactPhone')} <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  value={formData.emergencyPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, emergencyPhone: e.target.value })
                  }
                  placeholder={t('patientForm.contactPhonePlaceholder')}
                  maxLength={11}
                  style={inputStyle("emergencyPhone")}
                />
                {errors.emergencyPhone && (
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                    {errors.emergencyPhone}
                  </div>
                )}
              </div>
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: 16,
                  background: "#f0fdf4",
                  borderRadius: 8,
                  border: "1px solid #bbf7d0",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CheckCircle size={16} color="#16a34a" />
                <span style={{ fontSize: 12, color: "#166534" }}>
                  {t('patientForm.confirmHint')}
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
              color: "#64748b",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t('patientForm.cancel')}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 1 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "#64748b",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ChevronLeft size={14} />
                {t('patientForm.prev')}
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={handleNext}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "#1e40af",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {t('patientForm.next')} <ChevronRight size={14} />
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
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle size={14} />
                {t('patientForm.finish')}
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
        padding: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
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
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e40af" }}>
            {selectedPatientForEdit ? t('patientForm.editRecord') : t('patientForm.newRecord')}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {selectedPatientForEdit
              ? `患者ID: ${selectedPatientForEdit.id}`
              : t('patientForm.fillInfo')}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <FormField label={t('patientForm.name')} required error={formErrors.name}>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              onFormDataChange({ ...formData, name: e.target.value })
            }
            placeholder={t('patientForm.namePlaceholder')}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.name ? "#dc2626" : "var(--border-color)"}`,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </FormField>
        <FormField label={t('patientForm.gender')} required>
          <div
            role="radiogroup"
            aria-label={t('patientForm.gender')}
            style={{ display: "flex", gap: 16, paddingTop: 4 }}
          >
            {(["男", "女"] as GenderFilter[]).map((g) => (
              <label
                key={g}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#334155",
                }}
              >
                <input
                  type="radio"
                  name="patient-gender"
                  value={g}
                  checked={formData.gender === g}
                  aria-label={`性别-${g}`}
                  onChange={() => onFormDataChange({ ...formData, gender: g })}
                  style={{ cursor: "pointer", accentColor: "#1e40af" }}
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
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.age')}
          </label>
          <input
            type="number"
            value={formData.age}
            onChange={(e) =>
              onFormDataChange({ ...formData, age: e.target.value })
            }
            placeholder={t('patientForm.enterAge')}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <FormField label={t('patientForm.idCard')} required error={formErrors.idCard}>
          <input
            type="text"
            value={formData.idCard}
            onChange={(e) =>
              onFormDataChange({ ...formData, idCard: e.target.value })
            }
            placeholder={t('patientForm.enterIdCard18')}
            maxLength={18}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.idCard ? "#dc2626" : "var(--border-color)"}`,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </FormField>
        <FormField label={t('patientForm.phone')} required error={formErrors.phone}>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              onFormDataChange({ ...formData, phone: e.target.value })
            }
            placeholder={t('patientForm.enterPhone')}
            maxLength={11}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.phone ? "#dc2626" : "var(--border-color)"}`,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </FormField>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.patientType')}
          </label>
          <select
            value={formData.patientType}
            onChange={(e) =>
              onFormDataChange({
                ...formData,
                patientType: e.target.value as PatientTypeFilter,
              })
            }
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              background: "var(--bg-card)",
              boxSizing: "border-box",
            }}
          >
            {(["门诊", "住院", "体检", "急诊"] as PatientTypeFilter[]).map(
              (pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ),
            )}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.address')}
          </label>
          <textarea
            aria-label={t('patientForm.address')}
            value={formData.address}
            onChange={(e) =>
              onFormDataChange({ ...formData, address: e.target.value })
            }
            placeholder={t('patientForm.enterAddress')}
            rows={2}
            maxLength={200}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
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
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.contactName')} <span style={{ color: "#dc2626" }}>*</span>
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
            placeholder={t('patientForm.enterContactName')}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.emergencyContact ? "#dc2626" : "var(--border-color)"}`,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {formErrors.emergencyContact && (
            <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
              {formErrors.emergencyContact}
            </div>
          )}
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.contactPhone')} <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="tel"
            value={formData.emergencyPhone}
            onChange={(e) =>
              onFormDataChange({ ...formData, emergencyPhone: e.target.value })
            }
            placeholder={t('patientForm.enterContactPhone')}
            maxLength={11}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${formErrors.emergencyPhone ? "#dc2626" : "var(--border-color)"}`,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {formErrors.emergencyPhone && (
            <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
              {formErrors.emergencyPhone}
            </div>
          )}
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.insuranceType')}
          </label>
          <select
            value={formData.insuranceType}
            onChange={(e) =>
              onFormDataChange({ ...formData, insuranceType: e.target.value })
            }
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              background: "var(--bg-card)",
              boxSizing: "border-box",
            }}
          >
            <option value="">{t('patientForm.select')}</option>
            <option value="城镇职工基本医疗保险">城镇职工基本医疗保险</option>
            <option value="城乡居民基本医疗保险">城乡居民基本医疗保险</option>
            <option value="商业医疗保险">商业医疗保险</option>
            <option value="自费">自费</option>
          </select>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.bedNumber')}
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
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.attendingDoctor')}
          </label>
          <input
            type="text"
            value={formData.attendingDoctor}
            onChange={(e) =>
              onFormDataChange({ ...formData, attendingDoctor: e.target.value })
            }
            placeholder={t('patientForm.enterDoctor')}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.allergyHistory')}
          </label>
          <textarea
            aria-label={t('patientForm.allergyHistory')}
            value={formData.allergyHistory}
            onChange={(e) =>
              onFormDataChange({ ...formData, allergyHistory: e.target.value })
            }
            placeholder={t('patientForm.enterAllergy')}
            rows={2}
            maxLength={500}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
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
              color: "#334155",
              marginBottom: 6,
              display: "block",
            }}
          >
            {t('patientForm.medicalHistory')}
          </label>
          <textarea
            aria-label={t('patientForm.medicalHistory')}
            value={formData.medicalHistory}
            onChange={(e) =>
              onFormDataChange({ ...formData, medicalHistory: e.target.value })
            }
            placeholder={t('patientForm.enterMedicalHistory')}
            rows={3}
            maxLength={500}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              outline: "none",
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
          gap: 12,
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid var(--border-color)",
        }}
      >
        <FormSubmitBar
          onCancel={onCancel}
          onSubmit={onSave}
          submitText={t('patientForm.saveInfo')}
        />
      </div>
    </div>
  );
}

export { RegistrationWizard };
