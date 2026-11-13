import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import { Button, Empty, Input, Segmented, Spin, Tree, Typography } from "antd";
import type { TreeDataNode } from "antd";
import { Check, Copy, RefreshCw, Search } from "lucide-react";
import { t } from "../../i18n/appI18n";
import { dicomWebApi } from "../../services/api/dicomApi";

interface DicomTagPanelProps {
  studyUid?: string;
  seriesUid?: string;
  sopUid?: string;
}

interface DicomTagValue {
  vr?: string;
  Value?: unknown[];
  InlineBinary?: string;
  BulkDataURI?: string;
}

interface ParsedTag {
  tag: string;
  group: string;
  element: string;
  vr: string;
  keyword: string;
  value: string;
  copyText: string;
  searchText: string;
}

type DisplayMode = "tag" | "name";

const GROUP_NAMES: Record<string, string> = {
  "0000": "Command",
  "0002": "File Meta",
  "0004": "Directory",
  "0008": "Identifying",
  "0010": "Patient",
  "0012": "Clinical Trial",
  "0018": "Acquisition",
  "0020": "Relationship",
  "0022": "Ophthalmic",
  "0028": "Image Pixel",
  "0032": "Study",
  "0038": "Visit",
  "0040": "Procedure",
  "0042": "Encapsulated Document",
  "0054": "Nuclear Medicine",
  "0060": "Histogram",
  "0062": "Segmentation",
  "0064": "Deidentification",
  "0070": "Presentation State",
  "0088": "Spatial Registration",
  "0100": "Authorization",
  "0400": "Digital Signatures",
  "2000": "Print",
  "2010": "Film",
  "2020": "Film Session",
  "2100": "Print Job",
  "3002": "RT Image",
  "3004": "Dose",
  "3006": "RT Structure Set",
  "4008": "Results",
  "4D72": "Unified Procedure Step",
  "5200": "Functional Groups",
  "5400": "Waveform",
  "7FE0": "Pixel Data",
};

const TAG_KEYWORDS: Record<string, string> = {
  "00020002": "MediaStorageSOPClassUID",
  "00020003": "MediaStorageSOPInstanceUID",
  "00020010": "TransferSyntaxUID",
  "00020012": "ImplementationClassUID",
  "00020013": "ImplementationVersionName",
  "00080005": "SpecificCharacterSet",
  "00080008": "ImageType",
  "00080012": "InstanceCreationDate",
  "00080013": "InstanceCreationTime",
  "00080016": "SOPClassUID",
  "00080018": "SOPInstanceUID",
  "00080020": "StudyDate",
  "00080021": "SeriesDate",
  "00080022": "AcquisitionDate",
  "00080023": "ContentDate",
  "00080030": "StudyTime",
  "00080031": "SeriesTime",
  "00080032": "AcquisitionTime",
  "00080033": "ContentTime",
  "00080050": "AccessionNumber",
  "00080054": "RetrieveAETitle",
  "00080056": "InstanceAvailability",
  "00080060": "Modality",
  "00080061": "ModalitiesInStudy",
  "00080064": "ConversionType",
  "00080070": "Manufacturer",
  "00080080": "InstitutionName",
  "00080081": "InstitutionAddress",
  "00080090": "ReferringPhysicianName",
  "00081010": "StationName",
  "00081030": "StudyDescription",
  "0008103E": "SeriesDescription",
  "00081040": "InstitutionalDepartmentName",
  "00081090": "ManufacturerModelName",
  "00081115": "ReferencedSeriesSequence",
  "00081140": "ReferencedImageSequence",
  "00100010": "PatientName",
  "00100020": "PatientID",
  "00100030": "PatientBirthDate",
  "00100032": "PatientBirthTime",
  "00100040": "PatientSex",
  "00101010": "PatientAge",
  "00101020": "PatientSize",
  "00101030": "PatientWeight",
  "00180015": "BodyPartExamined",
  "00180020": "ScanningSequence",
  "00180021": "SequenceVariant",
  "00180022": "ScanOptions",
  "00180023": "MRAcquisitionType",
  "00180050": "SliceThickness",
  "00180060": "KVP",
  "00180088": "SpacingBetweenSlices",
  "00181000": "DeviceSerialNumber",
  "00181020": "SoftwareVersions",
  "00181100": "ReconstructionDiameter",
  "00185100": "PatientPosition",
  "0020000D": "StudyInstanceUID",
  "0020000E": "SeriesInstanceUID",
  "00200010": "StudyID",
  "00200011": "SeriesNumber",
  "00200012": "AcquisitionNumber",
  "00200013": "InstanceNumber",
  "00200020": "PatientOrientation",
  "00200032": "ImagePositionPatient",
  "00200037": "ImageOrientationPatient",
  "00200052": "FrameOfReferenceUID",
  "00200100": "TemporalPositionIdentifier",
  "00200105": "NumberOfTemporalPositions",
  "00201040": "PositionReferenceIndicator",
  "00201041": "SliceLocation",
  "00280002": "SamplesPerPixel",
  "00280004": "PhotometricInterpretation",
  "00280006": "PlanarConfiguration",
  "00280008": "NumberOfFrames",
  "00280009": "FrameIncrementPointer",
  "00280010": "Rows",
  "00280011": "Columns",
  "00280030": "PixelSpacing",
  "00280034": "PixelAspectRatio",
  "00280100": "BitsAllocated",
  "00280101": "BitsStored",
  "00280102": "HighBit",
  "00280103": "PixelRepresentation",
  "00280106": "SmallestImagePixelValue",
  "00280107": "LargestImagePixelValue",
  "00281040": "PixelIntensityRelationship",
  "00281050": "WindowCenter",
  "00281051": "WindowWidth",
  "00281052": "RescaleIntercept",
  "00281053": "RescaleSlope",
  "00281054": "RescaleType",
  "00283006": "LUTData",
  "00400275": "RequestAttributesSequence",
  "00400555": "AcquisitionContextSequence",
  "00540081": "NumberOfSlices",
  "7FE00010": "PixelData",
};

const BINARY_VR = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "UN"]);

function base64Bytes(value: string): number {
  const clean = value.replace(/=+$/, "");
  return Math.floor((clean.length * 3) / 4);
}

function formatValueItem(item: unknown): string {
  if (item === null || item === undefined) return "";
  if (typeof item === "string") return item;
  if (typeof item === "number" || typeof item === "boolean")
    return String(item);
  if (typeof item === "object") {
    const record = item as Record<string, unknown>;
    const alphabetic = record["Alphabetic"];
    if (typeof alphabetic === "string") {
      const ideographic = record["Ideographic"];
      const phonetic = record["Phonetic"];
      return [
        alphabetic,
        typeof ideographic === "string" ? ideographic : "",
        typeof phonetic === "string" ? phonetic : "",
      ]
        .filter((part) => part.length > 0)
        .join("=");
    }
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }
  return String(item);
}

function formatTagValue(tag: string, input: DicomTagValue): string {
  const vr = String(input.vr ?? "").toUpperCase();
  if (typeof input.InlineBinary === "string") {
    return t("dcmTags.binaryBytes", { bytes: base64Bytes(input.InlineBinary) });
  }
  if (typeof input.BulkDataURI === "string") {
    return t("dcmTags.bulkData");
  }
  const values = input.Value;
  if (!Array.isArray(values)) return "";
  if (BINARY_VR.has(vr) || tag === "7FE00010" || values.length > 256) {
    const numeric = typeof values[0] === "number";
    const bytes = numeric
      ? values.length * (vr === "OB" || vr === "UN" ? 1 : 2)
      : values.length;
    return t("dcmTags.binaryBytes", { bytes });
  }
  return values
    .map((item) => formatValueItem(item))
    .filter((part) => part.length > 0)
    .join("\\");
}

function mergeDatasets(raw: unknown): Record<string, DicomTagValue> {
  const datasets: unknown[] = Array.isArray(raw) ? raw : [raw];
  const merged: Record<string, DicomTagValue> = {};
  for (const dataset of datasets) {
    if (!dataset || typeof dataset !== "object") continue;
    for (const [key, value] of Object.entries(
      dataset as Record<string, unknown>,
    )) {
      if (!/^[0-9a-fA-F]{8}$/.test(key)) continue;
      if (!value || typeof value !== "object") continue;
      merged[key.toUpperCase()] = value as DicomTagValue;
    }
  }
  return merged;
}

function buildRows(merged: Record<string, DicomTagValue>): ParsedTag[] {
  return Object.keys(merged)
    .sort()
    .map((tag) => {
      const value = merged[tag] ?? {};
      const group = tag.slice(0, 4);
      const element = tag.slice(4, 8);
      const vr = String(value.vr ?? "").toUpperCase();
      const keyword = TAG_KEYWORDS[tag] ?? "";
      const text = formatTagValue(tag, value);
      const groupName = GROUP_NAMES[group] ?? "";
      return {
        tag,
        group,
        element,
        vr,
        keyword,
        value: text,
        copyText: `(${group},${element}) ${keyword || t("dcmTags.unknownTag")} [${vr}] = ${text}`,
        searchText:
          `${tag} ${group} ${element} ${keyword} ${groupName} ${text}`.toLowerCase(),
      };
    });
}

function sortRows(rows: ParsedTag[], mode: DisplayMode): ParsedTag[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (mode === "name") {
      const byName = (a.keyword || a.tag).localeCompare(b.keyword || b.tag);
      if (byName !== 0) return byName;
    }
    return a.tag.localeCompare(b.tag);
  });
  return sorted;
}

export default function DicomTagPanel({
  studyUid,
  seriesUid,
  sopUid,
}: DicomTagPanelProps) {
  const [merged, setMerged] = useState<Record<string, DicomTagValue> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<DisplayMode>("tag");
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const hasUids = Boolean(studyUid && seriesUid && sopUid);

  useEffect(() => {
    if (!studyUid || !seriesUid || !sopUid) {
      setMerged(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await dicomWebApi.retrieveMetadata(
          studyUid,
          seriesUid,
          sopUid,
        );
        if (cancelled) return;
        if (res.success) {
          const parsed = mergeDatasets(res.data);
          if (Object.keys(parsed).length > 0) {
            setMerged(parsed);
            setError(null);
          } else {
            setMerged(null);
            setError(t("dcmTags.emptyResponse"));
          }
        } else {
          setMerged(null);
          setError(res.error?.message ?? t("dcmTags.loadFailed"));
        }
      } catch (e) {
        if (cancelled) return;
        setMerged(null);
        setError(e instanceof Error ? e.message : t("dcmTags.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studyUid, seriesUid, sopUid, reloadKey]);

  const rows = useMemo(() => (merged ? buildRows(merged) : []), [merged]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.searchText.includes(query));
  }, [rows, search]);

  const displayRows = useMemo(() => sortRows(filtered, mode), [filtered, mode]);

  const groups = useMemo(() => {
    const map = new Map<string, ParsedTag[]>();
    for (const row of displayRows) {
      const list = map.get(row.group);
      if (list) list.push(row);
      else map.set(row.group, [row]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [displayRows]);

  const groupKeys = useMemo(
    () => groups.map(([group]) => `group-${group}`),
    [groups],
  );

  useEffect(() => {
    setExpandedKeys(groupKeys);
  }, [groupKeys]);

  const treeData = useMemo<TreeDataNode[]>(
    () =>
      groups.map(([group, groupRows]) => {
        const groupName = GROUP_NAMES[group] ?? t("dcmTags.unknownGroup");
        return {
          key: `group-${group}`,
          title: (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1, 4px)",
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "var(--text-primary)",
                }}
              >
                {`(${group},xxxx)`}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {groupName}
              </span>
              <span
                style={{ fontSize: 12, color: "var(--text-muted)" }}
              >{`(${groupRows.length})`}</span>
            </span>
          ),
          selectable: false,
          children: groupRows.map((row) => ({
            key: row.tag,
            selectable: false,
            title: (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-1, 4px)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                >
                  {`(${row.group},${row.element})`}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {row.keyword || t("dcmTags.unknownTag")}
                </span>
                {row.vr && (
                  <span
                    style={{ fontSize: 12, color: "var(--text-muted)" }}
                  >{`[${row.vr}]`}</span>
                )}
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    wordBreak: "break-all",
                  }}
                >
                  {row.value}
                </span>
                <Button
                  size="small"
                  type="text"
                  icon={
                    copiedTag === row.tag ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )
                  }
                  aria-label={`${t("dcmTags.copy")} ${row.tag}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (
                      typeof navigator !== "undefined" &&
                      navigator.clipboard
                    ) {
                      void navigator.clipboard
                        .writeText(row.copyText)
                        .then(() => {
                          setCopiedTag(row.tag);
                          window.setTimeout(
                            () =>
                              setCopiedTag((current) =>
                                current === row.tag ? null : current,
                              ),
                            1500,
                          );
                        })
                        .catch(() => undefined);
                    }
                  }}
                />
              </span>
            ),
          })),
        };
      }),
    [groups, copiedTag],
  );

  if (!hasUids) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("dcmTags.emptySelection")}
        style={{ marginTop: "var(--space-6, 32px)" }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2, 8px)",
      }}
    >
      <Input
        allowClear
        size="small"
        prefix={<Search size={12} />}
        placeholder={t("dcmTags.searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-1, 4px)",
        }}
      >
        <Segmented
          size="small"
          value={mode}
          onChange={(value) => setMode(value === "name" ? "name" : "tag")}
          options={[
            { label: t("dcmTags.modeTag"), value: "tag" },
            { label: t("dcmTags.modeName"), value: "name" },
          ]}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t("dcmTags.tagCount", { count: filtered.length })}
        </Typography.Text>
      </div>
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "var(--space-4, 16px)",
          }}
        >
          <Spin />
        </div>
      ) : error ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-2, 8px)",
            padding: "var(--space-3, 12px)",
          }}
        >
          <Typography.Text type="danger">
            {t("dcmTags.loadFailed")}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {error}
          </Typography.Text>
          <Button
            size="small"
            icon={<RefreshCw size={12} />}
            onClick={() => setReloadKey((value) => value + 1)}
          >
            {t("dcmTags.retry")}
          </Button>
        </div>
      ) : displayRows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("dcmTags.noResults")}
        />
      ) : (
        <Tree
          blockNode
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          style={{ fontSize: 12 }}
        />
      )}
    </div>
  );
}
