"use client";

import React, { useState, useRef } from "react";
import {
  Download,
  RotateCcw,
  Settings,
  FileBadge2,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Building2,
} from "lucide-react";
import { calculateAge } from "../lib/report-utils";
import {
  getPatient,
  listPatients,
  removePatient,
  savePatient,
} from "../lib/patient-api";
import { PatientManagement } from "../components/PatientManagement";
import { AppSidebar } from "../components/AppSidebar";
import type {
  FindingItem,
  Medication,
  PatientListItem,
  ReportData,
  ReportTheme,
  Stamp,
  StampDesigner,
  NameStampDesigner,
} from "../types/report";

// Default light blue medical cross/hands emblem as a default watermark Base64 SVG
const defaultWatermarkSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><path fill="%2322c55e" fill-opacity="0.12" d="M200,40 C130,40 100,100 100,160 C100,240 200,360 200,360 C200,360 300,240 300,160 C300,100 270,40 200,40 Z M200,220 C167,220 140,193 140,160 C140,127 167,100 200,100 C233,100 260,127 260,160 C260,193 233,220 200,220 Z"/></svg>`;

const dateForInput = (date: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

const dateForCertificate = (date: string) => {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
};

const defaultReportData: ReportData = {
  hospitalName: "Orchid Medical Centre",
  hospitalSub: "Orchid Medical Centre Pvt. Ltd.",
  hospitalAddress: "H.B. Road, Ranchi - 834001",
  cin: "U85100JH2009PTC013704",
  hospitalEmail: "info@orchidmedcentre.com",
  hospitalPhone: "911-7100-100",
  hospitalWebsite: "www.orchidmedcentre.com",
  hospitalEmergency: "911-7100-100",
  hospitalTagline: "Super Speciality Hospital",
  dischargeFooterNote:
    "NOTE: FOR BIOPSY REPORT CONTACT RECEPTION: +91-9117100100 DIET CONSULTATION BY DIETICIAN: 02:00 PM - 05:00 PM EMERGENCY HELPLINE: +91-9117100100",
  dischargeFooterBrand: "Orchid Medical Centre",
  fitnessFooterText:
    "Orchid Medical Centre Pvt. Ltd. • emergency helpline: 911-7100-100",
  radiologyStampLabel: "Orchid Medical Centre",
  radiologyStampSubtext: "Radiology Stamp",

  patientName: "Mr. Abhishek Kumar Barnwal",
  ageSex: "30 Year(s)/Male",
  uhid: "OMC.400102",
  refDoctor: "Dr. Arvind Kumar Prabhat",
  aadharCard: "490804358696",
  address:
    "S/O ANIL KUMAR BARNWAL, TEA GARDEN, VTC NAMKUM PO NAMKUM, Ranchi, Jharkhand, 0",
  companyName: "SOUTH EASTERN RAILWAY",
  ipNo: "2313",
  orderDate: "03/08/2026 08:38",
  reportDate: "03/08/2026 11:21",
  facility: "Orchid Medical Centre",
  dob: "25/03/1996",
  mobile: "7004147528",
  orderingBedWard: "503C/5TH FLOOR",
  currentBedWard: "503C/5TH FLOOR",

  reportTitle: "REPORT ON CT SCAN OF K.U.B ( PLAIN STUDY )",
  clinicalProfile: "Complain of right flank pain.",
  rightKidney:
    "Right kidney is normal in shape & size. It measures approx. 8.8 x 4.6 cm in size. Multiple small 2.2mm to 3 mm size radio-opaque calculi / concretions(3 in numbers) are seen impacted in its mid calyx. Pelvi-calyceal system is not dilated.",
  leftKidney:
    "Left kidney is normal in shape & size. It measures approx. 8.8 x 4.9 cm in size. Multiple small 2.2mm to 3 mm size radio-opaque calculi / concretions(4 in numbers) are seen impacted in its upper, mid and lower calyx. Pelvi-calyceal system is not dilated.",
  ureters: "Both ureters are not dilated.",
  urinaryBladder:
    "Normal in outline & distension. Lumen appears clear. Wall thickness normal. Perivesical fat plane is intact.",
  prostate: "Appears normal.",
  impressionHeading: "IMPRESSION: PLAIN CT OF KUB REVEALS:-",
  impression:
    "MULTIPLE SMALL BILATERAL RENAL CALCULI / CONCRETIONS WITH NO OBVIOUS BACK PRESSURE CHANGES IN THIS SCAN.",
  suggestion: "Clinico-Pathological Correlation.",
  reportSavedBy: "Shweta Singh (03/08/2026 11:15 AM)",
  printDateTime: "03/08/2026 11:24:13",
  printRunBy: "Shweta Singh",

  // Discharge Summary
  admitDate: "02/08/2026 10:14 PM",
  dischargeDateTime: "04/08/2026 02:49 PM",
  primaryConsultant:
    "Dr. ARVIND KUMAR PRABHAT : MBBS, MS, DNB, FMAS MCH (CONSULTANT UROLOGY) Fellowship in laparoscopy, Uro-oncology Robotics and Renal Transplantation from SMC in vijayawada, Andhra Pradesh. Available at Orchid Medical Centre : ON MON - SAT :10:00AM - 06:00PM",
  crossConsultants: "NA",
  finalDiagnosis: "RIGHT FLANK PAIN UNDER EVALUATION ? RIGHT URETERIC STONE.",
  dischargeResult: "Improved",
  natureOfTreatment: "Conservative",
  reasonForAdmission:
    "Right flank pain radiating to back since 3:30 PM on 02/08/2026 after onset of pain, no urine passed.",
  hopi: "Patient came with above mentioned complaints.",
  pastHistory:
    "History of fungal injection since 1.5 years (Taken Tab Itraconazole medication for 2 months ); not resolved completely. (Taken steroid since 2-3 months back).",
  familyHistory: "No significant family history.",
  allergy: "NA",
  pulse: "60 /min",
  bp: "130/90 mmHg",
  temp: "97.6 deg F",
  spo2: "98 % @ RA",
  respiration: "20 /min",
  pallor: "Absent",
  cyanosis: "Absent",
  edema: "Absent",

  // Page 2
  treatmentGiven: [
    "INJ TRAMADOL",
    "INJ PAN",
    "INJ ONDEM",
    "INJ XONE",
    "CAP ITRACONAZOLE",
    "TAB ODIMONT LC",
  ],
  investigations: "REPORTS ATTACHED",
  courseDuringStay:
    "Mr. Abhishek Kumar Barnwal, 30 Years / Male, came to Orchid Medical Centre Emergency with above mentioned complaints and was admitted under care of Dr. A.K. Prabhat on 02/08/2026 for further management and evaluation. All relevant investigations were done. Patient shifted to ward and managed conservatively on medications, close monitoring of vitals and other parameters and other supportive care modalities. Chest X-Ray report pending. CT (KUB) on 03/08/2026 -> Multiple small bilateral Renal calculi / concretions with no obvious back pressure changes in this scan. His condition has improved and he is currently hemodynamically stable and being discharged with following advice.",
  procedureDone: "Conservative",
  urgentCareInfo:
    "If patient complains of pain and any medical requirement come to Orchid Medical Centre casualty.",
  medications: [
    {
      name: "TAB CEFOREV 500 mg",
      instruction: "1 tab twice daily for 5 days.",
    },
    {
      name: "TAB PAN 40 mg",
      instruction: "1 tab once daily empty stomach for 5 days.",
    },
    { name: "TAB DROTIN M", instruction: "1 tab sos for pain." },
    {
      name: "SYP NEOLYZER",
      instruction: "10 ml in half glass of water twice daily.",
    },
  ],
  specialNeeds: "NA",
  dischargeFollowUp: "Review after 5 days.",
  conditionOnDischarge: "Hemodynamically stable",

  // Page 3
  dischargeFollowUpVisitDate: "09/08/2026",
  preparedBy: "Sushma Bhengra",
  verifiedBy: "Dr. Arvind Kumar Prabhat",
  receivedBy: "",
  receivedDate: "",
  receivedTime: "",

  customPages: [],

  // Logo & Watermark settings
  logoType: "text",
  logoImage: "",
  logoImageWidth: 100,
  logoImageHeight: 100,
  logoImageX: 50,
  logoImageY: 50,
  logoTextColor: "#0f172a",
  logoTextSize: 24,
  logoTextWeight: 800,
  headerLogos: [],
  watermarkEnabled: true,
  watermarkImageEnabled: true,
  watermarkImage: defaultWatermarkSvg,
  watermarkOpacity: 0.15,
  watermarkPages: [1, 2, 3], // Checked for page 1, 2 and 3 by default
  watermarkX: 50,
  watermarkY: 50,
  watermarkText: "",
  watermarkTextColor: "#64748b",
  watermarkTextSize: 64,
  watermarkTextWeight: 700,
  watermarkTextOpacity: 0.15,
  watermarkTextRotation: -35,
  watermarkTextSkewX: 0,
  watermarkTextSkewY: 0,
  watermarkTextX: 50,
  watermarkTextY: 50,
  watermarkTextLetterSpacing: 2,
  watermarkTextStyle: "normal",
  watermarkTextTransform: "uppercase",
  reportTheme: {
    primary: "#10b981",
    primarySoft: "#d1fae5",
    text: "#111827",
    muted: "#4b5563",
    border: "#d1d5db",
    heading: "#111827",
    background: "#ffffff",
  },

  // Fitness Certificate Defaults
  fitTitle: "FIT TO TRAVEL CERTIFICATE",
  fitStatus: "fit",
  fitStatement:
    "and found him/her physically fit to travel by air/train/road. The patient is currently asymptomatic, non-infectious, and exhibits stable vital parameters.",
  fitRemarks:
    "The patient is fit to undertake long-distance travel. Standard safety and hygiene protocols should be followed during transit.",
  fitDate: "04/08/2026",
  fitSignatory: "Dr. Arvind Kumar Prabhat (Consultant Urologist)",

  findingsList: [
    {
      id: "right_kidney",
      label: "RIGHT KIDNEY",
      value:
        "Right kidney is normal in shape & size. It measures approx. 8.8 x 4.6 cm in size. Multiple small 2.2mm to 3 mm size radio-opaque calculi / concretions(3 in numbers) are seen impacted in its mid calyx. Pelvi-calyceal system is not dilated.",
      isDefault: true,
    },
    {
      id: "left_kidney",
      label: "LEFT KIDNEY",
      value:
        "Left kidney is normal in shape & size. It measures approx. 8.8 x 4.9 cm in size. Multiple small 2.2mm to 3 mm size radio-opaque calculi / concretions(4 in numbers) are seen impacted in its upper, mid and lower calyx. Pelvi-calyceal system is not dilated.",
      isDefault: true,
    },
    {
      id: "ureters",
      label: "URETERS",
      value: "Both ureters are not dilated.",
      isDefault: true,
    },
    {
      id: "urinary_bladder",
      label: "URINARY BLADDER",
      value:
        "Normal in outline & distension. Lumen appears clear. Wall thickness normal. Perivesical fat plane is intact.",
      isDefault: true,
    },
    {
      id: "prostate",
      label: "PROSTATE",
      value: "Appears normal.",
      isDefault: true,
    },
  ],

  // Discharge Summary Stamps
  dischargeSummaryStamps: [
    {
      id: "default_stamp",
      label: "Official Stamp",
      image: "",
      size: 15,
      opacity: 0.8,
      x: 85,
      y: 85,
      rotation: -15,
      filter: "none",
      isDefault: true,
      pages: [1],
      documentTypes: ["discharge"],
    },
  ],
};

export default function Home() {
  const [workspace, setWorkspace] = useState<"editor" | "patients">("editor");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [docType, setDocType] = useState<
    "diagnostic" | "discharge" | "fitness"
  >("discharge");
  const [data, setData] = useState<ReportData>(defaultReportData);
  const [stampDesigner, setStampDesigner] = useState<StampDesigner>({
    name: "Approved Seal",
    mainText: "APPROVED",
    topText: "ORCHID MEDICAL CENTRE",
    bottomText: "AUTHORISED SIGNATORY",
    color: "#9b1c1c",
    shape: "round",
    inkOpacity: 0.82,
    distress: 3,
    inkSpread: 0.5,
    edgeSoftness: 0,
    fadeSide: "none",
    fadeStrength: 0.5,
    inkSpill: 2,
    sizeMismatch: 1,
    textOpacityVariation: 0.12,
    borderEnabled: true,
    borderWidth: 1,
  });
  const [nameStampDesigner, setNameStampDesigner] = useState<NameStampDesigner>({
    doctorName: "Dr. Arvind Kumar Prabhat",
    department: "Consultant Urology",
    degree: "MBBS, MS, DNB, MCh",
    hospitalName: "Orchid Medical Centre",
    color: "#1e3a8a",
    shape: "rectangle",
    inkOpacity: 0.82,
    distress: 3,
    inkSpread: 0.5,
    edgeSoftness: 0,
    fadeSide: "none",
    fadeStrength: 0.5,
    inkSpill: 2,
    sizeMismatch: 1,
    textOpacityVariation: 0.12,
    borderEnabled: true,
    borderWidth: 1,
  });
  const [activeTab, setActiveTab] = useState<
    | "hospital"
    | "patient"
    | "details"
    | "findings"
    | "treatment"
    | "meds"
    | "footer"
  >("patient");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [selectedPages, setSelectedPages] = useState<{
    [key: string]: boolean;
  }>({
    diagnostic: true,
    discharge_page1: true,
    discharge_page2: true,
    discharge_page3: true,
    fitness: true,
  });
  const [pdfSaveMode, setPdfSaveMode] = useState<"combined" | "separate">(
    "combined",
  );

  // References to the A4 sheets
  const diagSheetRef = useRef<HTMLDivElement>(null);
  const fitSheetRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const page3Ref = useRef<HTMLDivElement>(null);
  const customPagesRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleInputChange = <K extends keyof ReportData>(
    field: K,
    value: ReportData[K],
  ) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const loadPatients = async () => {
    setIsLoadingPatients(true);
    try {
      setPatients(await listPatients());
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load patients.");
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const openPatientManagement = () => {
    setWorkspace("patients");
    void loadPatients();
  };

  const loadPatientIntoEditor = async (patientId: string) => {
    try {
      const patient = await getPatient(patientId);

      // Images are deliberately not persisted; defaults keep the editor usable.
      setData({ ...defaultReportData, ...patient.patientDetails } as ReportData);
      setEditingPatientId(patient._id);
      setWorkspace("editor");
      setActiveTab("patient");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load patient details.");
    }
  };

  const deletePatient = async (patientId: string) => {
    if (!confirm("Delete this patient record? This cannot be undone.")) return;

    setDeletingPatientId(patientId);
    try {
      await removePatient(patientId);

      if (editingPatientId === patientId) setEditingPatientId(null);
      await loadPatients();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete patient.");
    } finally {
      setDeletingPatientId(null);
    }
  };

  const savePatientDetails = async () => {
    if (!data.uhid.trim()) {
      alert("Enter a UHID before saving patient details.");
      return;
    }

    setIsSavingPatient(true);
    try {
      const savedPatient = await savePatient(data, editingPatientId);
      setEditingPatientId(savedPatient.id);
      alert(savedPatient.message);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save patient details. Please try again.",
      );
    } finally {
      setIsSavingPatient(false);
    }
  };

  const handleFindingChange = (
    id: string,
    key: "label" | "value",
    val: string,
  ) => {
    const updated = data.findingsList.map((item) => {
      if (item.id === id) {
        // Also update the legacy state if it matches a default field for safety
        if (item.isDefault) {
          let legacyField: keyof ReportData | null = null;
          if (id === "right_kidney") legacyField = "rightKidney";
          else if (id === "left_kidney") legacyField = "leftKidney";
          else if (id === "ureters") legacyField = "ureters";
          else if (id === "urinary_bladder") legacyField = "urinaryBladder";
          else if (id === "prostate") legacyField = "prostate";

          if (legacyField && key === "value") {
            setData((prev) => ({ ...prev, [legacyField!]: val }));
          }
        }
        return { ...item, [key]: val };
      }
      return item;
    });
    handleInputChange("findingsList", updated);
  };

  const addFinding = () => {
    const newId = `custom_${Date.now()}`;
    const newItem: FindingItem = {
      id: newId,
      label: "NEW FINDING",
      value: "",
      isDefault: false,
    };
    handleInputChange("findingsList", [...data.findingsList, newItem]);
  };

  const removeFinding = (id: string) => {
    const updated = data.findingsList.filter(
      (item) => item.id !== id || item.isDefault,
    );
    handleInputChange("findingsList", updated);
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logoImage" | "watermarkImage",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleInputChange(field, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleHeaderLogoChange = (
    id: string,
    key: "x" | "y" | "size" | "width" | "height" | "opacity",
    value: number,
  ) => {
    const updated = data.headerLogos.map((logo) =>
      logo.id === id ? { ...logo, [key]: value } : logo,
    );
    handleInputChange("headerLogos", updated);
  };

  const addHeaderLogo = () => {
    handleInputChange("headerLogos", [
      ...data.headerLogos,
      {
        id: `header_logo_${Date.now()}`,
        image: "",
        size: 100,
        width: 100,
        height: 100,
        opacity: 0.8,
        x: 50,
        y: 50,
        isDefault: false,
      },
    ]);
  };

  const removeHeaderLogo = (id: string) => {
    const updated = data.headerLogos.filter((logo) => logo.id !== id);
    handleInputChange("headerLogos", updated);
  };

  const handleHeaderLogoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    logoId: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const updated = data.headerLogos.map((logo) =>
          logo.id === logoId
            ? { ...logo, image: event.target?.result as string }
            : logo,
        );
        handleInputChange("headerLogos", updated);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleWatermarkPageToggle = (pageNumber: number) => {
    let updatedPages = [...data.watermarkPages];
    if (updatedPages.includes(pageNumber)) {
      updatedPages = updatedPages.filter((p) => p !== pageNumber);
    } else {
      updatedPages.push(pageNumber);
    }
    handleInputChange("watermarkPages", updatedPages);
  };

  const handleMedicationChange = (
    index: number,
    key: keyof Medication,
    value: string,
  ) => {
    const updatedMeds = [...data.medications];
    updatedMeds[index] = { ...updatedMeds[index], [key]: value };
    handleInputChange("medications", updatedMeds);
  };

  const addMedication = () => {
    handleInputChange("medications", [
      ...data.medications,
      { name: "", instruction: "" },
    ]);
  };

  const removeMedication = (index: number) => {
    const updated = data.medications.filter((_, i) => i !== index);
    handleInputChange("medications", updated);
  };

  const addTreatment = () => {
    handleInputChange("treatmentGiven", [...data.treatmentGiven, ""]);
  };

  const handleTreatmentChange = (index: number, value: string) => {
    const updated = [...data.treatmentGiven];
    updated[index] = value;
    handleInputChange("treatmentGiven", updated);
  };

  const removeTreatment = (index: number) => {
    const updated = data.treatmentGiven.filter((_, i) => i !== index);
    handleInputChange("treatmentGiven", updated);
  };

  const addCustomPage = () => {
    handleInputChange("customPages", [
      ...data.customPages,
      "New Custom Page Content",
    ]);
  };

  const handleCustomPageChange = (index: number, value: string) => {
    const updated = [...data.customPages];
    updated[index] = value;
    handleInputChange("customPages", updated);
  };

  const removeCustomPage = (index: number) => {
    const updated = data.customPages.filter((_, i) => i !== index);
    handleInputChange("customPages", updated);
  };

  const handleReset = () => {
    if (confirm("Reset all fields to default?")) {
      setData(defaultReportData);
    }
  };

  const clearHospitalFields = () => {
    if (confirm("Clear all hospital information?")) {
      setData({
        ...data,
        hospitalName: "",
        hospitalSub: "",
        hospitalAddress: "",
        hospitalEmail: "",
        hospitalPhone: "",
        hospitalWebsite: "",
        hospitalEmergency: "",
        cin: "",
        hospitalTagline: "",
        dischargeFooterNote: "",
        dischargeFooterBrand: "",
        fitnessFooterText: "",
        radiologyStampLabel: "",
        radiologyStampSubtext: "",
      });
    }
  };

  const clearPatientFields = () => {
    if (confirm("Clear all patient information?")) {
      setData({
        ...data,
        patientName: "",
        ageSex: "",
        uhid: "",
        refDoctor: "",
        aadharCard: "",
        address: "",
        companyName: "",
        ipNo: "",
        orderDate: "",
        reportDate: "",
        facility: "",
        dob: "",
        mobile: "",
        orderingBedWard: "",
        currentBedWard: "",
      });
    }
  };

  const clearDiagnosticFields = () => {
    if (confirm("Clear all diagnostic findings?")) {
      setData({
        ...data,
        reportTitle: "",
        clinicalProfile: "",
        rightKidney: "",
        leftKidney: "",
        ureters: "",
        urinaryBladder: "",
        prostate: "",
        impressionHeading: "",
        impression: "",
        suggestion: "",
        reportSavedBy: "",
        printDateTime: "",
        printRunBy: "",
      });
    }
  };

  const clearFitnessFields = () => {
    if (confirm("Clear all fitness certificate details?")) {
      setData({
        ...data,
        fitTitle: "",
        fitStatus: "fit",
        fitStatement: "",
        fitRemarks: "",
        fitDate: "",
        fitSignatory: "",
      });
    }
  };

  const clearDischargeDetailsFields = () => {
    if (confirm("Clear all clinical details?")) {
      setData({
        ...data,
        admitDate: "",
        dischargeDateTime: "",
        primaryConsultant: "",
        crossConsultants: "",
        finalDiagnosis: "",
        dischargeResult: "",
        natureOfTreatment: "",
        reasonForAdmission: "",
        hopi: "",
        pastHistory: "",
        familyHistory: "",
        allergy: "",
        pulse: "",
        bp: "",
        temp: "",
        spo2: "",
        respiration: "",
        pallor: "",
        cyanosis: "",
        edema: "",
      });
    }
  };

  const clearDischargeTreatmentFields = () => {
    if (confirm("Clear all treatment information?")) {
      setData({
        ...data,
        treatmentGiven: [],
        investigations: "",
        courseDuringStay: "",
        procedureDone: "",
        urgentCareInfo: "",
        specialNeeds: "",
        dischargeFollowUp: "",
        conditionOnDischarge: "",
        dischargeFollowUpVisitDate: "",
        preparedBy: "",
        verifiedBy: "",
        receivedBy: "",
        receivedDate: "",
        receivedTime: "",
        customPages: [],
      });
    }
  };

  const clearDischargeMedicationsFields = () => {
    if (confirm("Clear all medications?")) {
      setData({
        ...data,
        medications: [],
      });
    }
  };

  const clearFooterFields = () => {
    if (confirm("Clear logo, watermark, theme and stamps settings?")) {
      setData({
        ...data,
        logoType: "text",
        logoImage: "",
        logoImageWidth: defaultReportData.logoImageWidth,
        logoImageHeight: defaultReportData.logoImageHeight,
        logoImageX: defaultReportData.logoImageX,
        logoImageY: defaultReportData.logoImageY,
        logoTextColor: defaultReportData.logoTextColor,
        logoTextSize: defaultReportData.logoTextSize,
        logoTextWeight: defaultReportData.logoTextWeight,
        headerLogos: [],
        watermarkEnabled: false,
        watermarkImageEnabled: false,
        watermarkImage: "",
        watermarkOpacity: 0.3,
        watermarkPages: [],
        watermarkX: 50,
        watermarkY: 50,
        watermarkText: "",
        watermarkTextColor: defaultReportData.watermarkTextColor,
        watermarkTextSize: defaultReportData.watermarkTextSize,
        watermarkTextWeight: defaultReportData.watermarkTextWeight,
        watermarkTextOpacity: defaultReportData.watermarkTextOpacity,
        watermarkTextRotation: defaultReportData.watermarkTextRotation,
        watermarkTextSkewX: defaultReportData.watermarkTextSkewX,
        watermarkTextSkewY: defaultReportData.watermarkTextSkewY,
        watermarkTextX: 50,
        watermarkTextY: 50,
        watermarkTextLetterSpacing: defaultReportData.watermarkTextLetterSpacing,
        watermarkTextStyle: defaultReportData.watermarkTextStyle,
        watermarkTextTransform: defaultReportData.watermarkTextTransform,
        reportTheme: defaultReportData.reportTheme,
        dischargeSummaryStamps: [],
      });
    }
  };

  const handlePDFPageToggle = (page: string) => {
    setSelectedPages((prev) => ({ ...prev, [page]: !prev[page] }));
  };

  const openPDFModal = () => {
    setShowPDFModal(true);
  };

  const closePDFModal = () => {
    setShowPDFModal(false);
  };

  const handleStampChange = <K extends keyof Stamp>(
    id: string,
    key: K,
    value: Stamp[K],
  ) => {
    const updated = data.dischargeSummaryStamps.map((stamp) => {
      if (stamp.id === id) {
        return { ...stamp, [key]: value };
      }
      return stamp;
    });
    handleInputChange("dischargeSummaryStamps", updated);
  };

  const toggleStampPage = (stampId: string, page: number) => {
    const updated = data.dischargeSummaryStamps.map((stamp) => {
      if (stamp.id !== stampId) return stamp;
      const pages = stamp.pages.includes(page)
        ? stamp.pages.filter((stampPage) => stampPage !== page)
        : [...stamp.pages, page];
      return { ...stamp, pages };
    });
    handleInputChange("dischargeSummaryStamps", updated);
  };

  const toggleStampDocumentType = (
    stampId: string,
    documentType: "diagnostic" | "discharge" | "fitness",
  ) => {
    const updated = data.dischargeSummaryStamps.map((stamp) => {
      if (stamp.id !== stampId) return stamp;
      const documentTypes = stamp.documentTypes.includes(documentType)
        ? stamp.documentTypes.filter((type) => type !== documentType)
        : [...stamp.documentTypes, documentType];
      return { ...stamp, documentTypes };
    });
    handleInputChange("dischargeSummaryStamps", updated);
  };

  const addStamp = () => {
    const newId = `stamp_${Date.now()}`;
    const newStamp: Stamp = {
      id: newId,
      label: "New Stamp",
      image: "",
      size: 15,
      opacity: 0.8,
      x: 85,
      y: 80,
      rotation: -15,
      filter: "none",
      isDefault: false,
      pages: [1],
      documentTypes: ["discharge"],
    };
    handleInputChange("dischargeSummaryStamps", [
      ...data.dischargeSummaryStamps,
      newStamp,
    ]);
  };

  const removeStamp = (id: string) => {
    const updated = data.dischargeSummaryStamps.filter(
      (stamp) => stamp.id !== id || stamp.isDefault,
    );
    handleInputChange("dischargeSummaryStamps", updated);
  };

  const handleStampImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    stampId: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleStampChange(stampId, "image", event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const escapeStampText = (value: string) =>
    value.replace(/[&<>'"]/g, (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&apos;",
        '"': "&quot;",
      };
      return entities[character];
    });

  const createStampSvg = (design: StampDesigner = stampDesigner) => {
    const {
      mainText,
      topText,
      bottomText,
      color,
      shape,
      inkOpacity,
      distress,
      inkSpread,
      edgeSoftness,
      fadeSide,
      fadeStrength,
      inkSpill = 0,
      sizeMismatch = 0,
      textOpacityVariation = 0,
      borderEnabled = true,
      borderWidth = 1,
    } = design;
    const isRound = shape === "round";
    const frame = !borderEnabled
      ? ""
      : isRound
        ? `<circle cx="300" cy="300" r="255" fill="none" stroke="currentColor" stroke-width="${18 * borderWidth}"/><circle cx="300" cy="300" r="220" fill="none" stroke="currentColor" stroke-width="${5 * borderWidth}" stroke-dasharray="7 5"/>`
        : `<rect x="42" y="120" width="516" height="360" rx="18" fill="none" stroke="currentColor" stroke-width="${18 * borderWidth}"/><rect x="62" y="140" width="476" height="320" rx="10" fill="none" stroke="currentColor" stroke-width="${5 * borderWidth}" stroke-dasharray="7 5"/>`;
    const titleSize = mainText.length > 12 ? 48 : 64;
    const textY = isRound ? 315 : 320;
    const fadedOpacity = Math.max(0, 1 - fadeStrength).toFixed(2);
    const fadeGradient =
      fadeSide === "top"
        ? `<linearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="white" stop-opacity="${fadedOpacity}"/><stop offset="42%" stop-color="white"/></linearGradient>`
        : fadeSide === "bottom"
          ? `<linearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="58%" stop-color="white"/><stop offset="100%" stop-color="white" stop-opacity="${fadedOpacity}"/></linearGradient>`
          : fadeSide === "left"
            ? `<linearGradient id="fadeGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="white" stop-opacity="${fadedOpacity}"/><stop offset="42%" stop-color="white"/></linearGradient>`
            : fadeSide === "right"
              ? `<linearGradient id="fadeGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="58%" stop-color="white"/><stop offset="100%" stop-color="white" stop-opacity="${fadedOpacity}"/></linearGradient>`
              : "";
    const fadeMask = fadeSide === "none" ? "" : '<mask id="edgeFade"><rect width="600" height="600" fill="url(#fadeGradient)"/></mask>';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <defs>
        <filter id="rough" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="8" result="noise"/>
          <feMorphology in="SourceGraphic" operator="dilate" radius="${inkSpread}" result="spread"/>
          <feGaussianBlur in="spread" stdDeviation="${edgeSoftness}" result="softened"/>
          <feDisplacementMap in="softened" in2="noise" scale="${distress}" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        ${fadeGradient}
        ${fadeMask}
        ${isRound ? '<path id="topArc" d="M 105,300 A 195,195 0 0,1 495,300" fill="none"/><path id="bottomArc" d="M 105,300 A 195,195 0 0,0 495,300" fill="none"/>' : ""}
      </defs>
      <g color="${color}" opacity="${inkOpacity}"${fadeSide === "none" ? "" : ' mask="url(#edgeFade)"'}>
        <g filter="url(#rough)" transform="rotate(${sizeMismatch} 300 300) scale(${1 + sizeMismatch / 250}) translate(${sizeMismatch * -2} ${sizeMismatch})">${frame}</g>
        <path d="M ${isRound ? "170 345 L 430 345" : "95 360 L 505 360"}" stroke="currentColor" stroke-width="5"/>
        <path d="M ${isRound ? "185 365 L 415 365" : "115 385 L 485 385"}" stroke="currentColor" stroke-width="2" stroke-dasharray="4 5"/>
        ${isRound ? `<text fill="currentColor" opacity="${1 - textOpacityVariation / 2}" font-family="Georgia, serif" font-size="22" font-weight="700" letter-spacing="2"><textPath href="#topArc" startOffset="50%" text-anchor="middle">${escapeStampText(topText)}</textPath></text><text fill="currentColor" opacity="${1 - textOpacityVariation}" font-family="Georgia, serif" font-size="18" font-weight="700" letter-spacing="1.5"><textPath href="#bottomArc" startOffset="50%" text-anchor="middle">${escapeStampText(bottomText)}</textPath></text>` : `<text x="300" y="195" fill="currentColor" opacity="${1 - textOpacityVariation / 2}" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" letter-spacing="2">${escapeStampText(topText)}</text><text x="300" y="438" fill="currentColor" opacity="${1 - textOpacityVariation}" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" letter-spacing="1.5">${escapeStampText(bottomText)}</text>`}
        <text x="300" y="${textY}" fill="currentColor" opacity="${1 - textOpacityVariation * 0.35}" text-anchor="middle" font-family="Georgia, serif" font-size="${titleSize}" font-weight="900" letter-spacing="2">${escapeStampText(mainText)}</text>
        <circle cx="300" cy="278" r="5" fill="currentColor"/><circle cx="300" cy="385" r="5" fill="currentColor"/>
        ${Array.from({ length: Math.round(inkSpill) }, (_, index) => `<circle cx="${80 + ((index * 137) % 440)}" cy="${110 + ((index * 83) % 390)}" r="${1.5 + (index % 3)}" fill="currentColor" opacity="${0.35 + (index % 3) * 0.12}"/>`).join("")}
      </g>
    </svg>`;
  };

  const stampSvgDataUrl = (design: StampDesigner = stampDesigner) =>
    `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(createStampSvg(design))))}`;

  const useDesignedStamp = () => {
    const newStamp: Stamp = {
      id: `stamp_${Date.now()}`,
      label: stampDesigner.name || "Designed Stamp",
      image: stampSvgDataUrl(stampDesigner),
      size: 18,
      opacity: 1,
      x: 82,
      y: 80,
      rotation: -12,
      filter: "none",
      isDefault: false,
      pages: [1],
      documentTypes: ["discharge"],
      designer: { ...stampDesigner },
    };
    handleInputChange("dischargeSummaryStamps", [
      ...data.dischargeSummaryStamps,
      newStamp,
    ]);
  };

  const handleDesignedStampChange = <K extends keyof StampDesigner>(
    stampId: string,
    key: K,
    value: StampDesigner[K],
  ) => {
    const updated = data.dischargeSummaryStamps.map((stamp) => {
      if (stamp.id !== stampId || !stamp.designer) return stamp;
      const designer = { ...stamp.designer, [key]: value };
      return { ...stamp, designer, image: stampSvgDataUrl(designer) };
    });
    handleInputChange("dischargeSummaryStamps", updated);
  };

  const createNameStampSvg = (design: NameStampDesigner = nameStampDesigner) => {
    const { doctorName, department, degree, hospitalName, color, shape, inkOpacity, distress, inkSpread, edgeSoftness, fadeSide, fadeStrength, inkSpill = 0, sizeMismatch = 0, textOpacityVariation = 0, borderEnabled = true, borderWidth = 1 } = design;
    const isRound = shape === "round";
    const unevenText = Math.max(0, Math.min(1, textOpacityVariation));
    const fadeNoiseCoefficient = (unevenText / 3).toFixed(4);
    const textureSeed = Array.from(`${doctorName}|${department}|${degree}|${hospitalName}`).reduce(
      (seed, character, index) => (seed + character.charCodeAt(0) * (index + 1)) % 89,
      11,
    );
    const fadedOpacity = Math.max(0, 1 - fadeStrength).toFixed(2);
    const fadeGradient = fadeSide === "top"
      ? `<linearGradient id="nameFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="white" stop-opacity="${fadedOpacity}"/><stop offset="42%" stop-color="white"/></linearGradient>`
      : fadeSide === "bottom"
        ? `<linearGradient id="nameFade" x1="0" y1="0" x2="0" y2="1"><stop offset="58%" stop-color="white"/><stop offset="100%" stop-color="white" stop-opacity="${fadedOpacity}"/></linearGradient>`
        : fadeSide === "left"
          ? `<linearGradient id="nameFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="white" stop-opacity="${fadedOpacity}"/><stop offset="42%" stop-color="white"/></linearGradient>`
          : fadeSide === "right"
            ? `<linearGradient id="nameFade" x1="0" y1="0" x2="1" y2="0"><stop offset="58%" stop-color="white"/><stop offset="100%" stop-color="white" stop-opacity="${fadedOpacity}"/></linearGradient>`
            : "";
    const frame = !borderEnabled
      ? ""
      : isRound
        ? `<circle cx="300" cy="300" r="255" fill="none" stroke="currentColor" stroke-width="${16 * borderWidth}"/><circle cx="300" cy="300" r="222" fill="none" stroke="currentColor" stroke-width="${4 * borderWidth}" stroke-dasharray="7 5"/>`
        : `<rect x="30" y="130" width="540" height="340" rx="15" fill="none" stroke="currentColor" stroke-width="${16 * borderWidth}"/><rect x="50" y="150" width="500" height="300" rx="8" fill="none" stroke="currentColor" stroke-width="${4 * borderWidth}" stroke-dasharray="7 5"/>`;
    const textY = isRound ? { hospital: 190, name: 270, department: 330, degree: 385 } : { hospital: 205, name: 275, department: 335, degree: 400 };
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <defs>
        <filter id="nameRough" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.11" numOctaves="3" seed="${textureSeed}" result="roughNoise"/>
          <feMorphology in="SourceGraphic" operator="dilate" radius="${inkSpread}" result="spread"/>
          <feGaussianBlur in="spread" stdDeviation="${edgeSoftness}" result="softened"/>
          <feDisplacementMap in="softened" in2="roughNoise" scale="${distress}" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <filter id="nameTextFadeTexture" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.14" numOctaves="4" seed="${textureSeed + 31}" result="fadeNoise"/>
          <feColorMatrix in="fadeNoise" type="matrix" values="
            0 0 0 0 1
            0 0 0 0 1
            0 0 0 0 1
            -${fadeNoiseCoefficient} -${fadeNoiseCoefficient} -${fadeNoiseCoefficient} 0 1
          "/>
        </filter>
        <mask id="nameTextFadeMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="600" height="600" style="mask-type:alpha">
          <rect x="0" y="0" width="600" height="600" fill="white" filter="url(#nameTextFadeTexture)"/>
        </mask>
        ${fadeGradient}
        ${fadeSide === "none" ? "" : '<mask id="nameFadeMask"><rect width="600" height="600" fill="url(#nameFade)"/></mask>'}
      </defs>
      <g color="${color}" opacity="${inkOpacity}"${fadeSide === "none" ? "" : ' mask="url(#nameFadeMask)"'}>
        <g filter="url(#nameRough)" transform="rotate(${sizeMismatch} 300 300) scale(${1 + sizeMismatch / 250}) translate(${sizeMismatch * -2} ${sizeMismatch})">${frame}</g>
        <g filter="url(#nameRough)">
          <path d="M 120 225 L 480 225" stroke="currentColor" stroke-width="3"/>
          <path d="M 120 355 L 480 355" stroke="currentColor" stroke-width="3"/>
        </g>
        <g filter="url(#nameRough)" mask="url(#nameTextFadeMask)">
          <text x="300" y="${textY.hospital}" fill="currentColor" opacity="${1 - unevenText * 0.12}" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-weight="700" letter-spacing="1.5">${escapeStampText(hospitalName)}</text>
          <text x="300" y="${textY.name}" fill="currentColor" opacity="${1 - unevenText * 0.06}" text-anchor="middle" font-family="Georgia, serif" font-size="${doctorName.length > 26 ? 30 : 36}" font-weight="900">${escapeStampText(doctorName)}</text>
          <text x="300" y="${textY.department}" fill="currentColor" opacity="${1 - unevenText * 0.18}" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700">${escapeStampText(department)}</text>
          <text x="300" y="${textY.degree}" fill="currentColor" opacity="${1 - unevenText * 0.14}" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700">${escapeStampText(degree)}</text>
        </g>
        ${Array.from({ length: Math.round(inkSpill) }, (_, index) => `<circle cx="${80 + ((index * 137) % 440)}" cy="${110 + ((index * 83) % 390)}" r="${1.5 + (index % 3)}" fill="currentColor" opacity="${0.35 + (index % 3) * 0.12}"/>`).join("")}
      </g>
    </svg>`;
  };

  const nameStampSvgDataUrl = (design: NameStampDesigner = nameStampDesigner) =>
    `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(createNameStampSvg(design))))}`;

  const useNameStamp = () => {
    const newStamp: Stamp = {
      id: `name_stamp_${Date.now()}`,
      label: nameStampDesigner.doctorName || "Doctor Name Stamp",
      image: nameStampSvgDataUrl(nameStampDesigner),
      size: 26,
      opacity: 1,
      x: 78,
      y: 82,
      rotation: -4,
      filter: "none",
      isDefault: false,
      pages: [1],
      documentTypes: ["diagnostic", "discharge", "fitness"],
      nameDesigner: { ...nameStampDesigner },
    };
    handleInputChange("dischargeSummaryStamps", [...data.dischargeSummaryStamps, newStamp]);
  };

  const handleNameStampChange = <K extends keyof NameStampDesigner>(stampId: string, key: K, value: NameStampDesigner[K]) => {
    const updated = data.dischargeSummaryStamps.map((stamp) => {
      if (stamp.id !== stampId || !stamp.nameDesigner) return stamp;
      const nameDesigner = { ...stamp.nameDesigner, [key]: value };
      return { ...stamp, label: nameDesigner.doctorName || "Doctor Name Stamp", nameDesigner, image: nameStampSvgDataUrl(nameDesigner) };
    });
    handleInputChange("dischargeSummaryStamps", updated);
  };

  const downloadDesignedStamp = (format: "svg" | "png") => {
    const svg = createStampSvg();
    const download = (href: string, extension: string) => {
      const link = document.createElement("a");
      link.href = href;
      link.download = `${(stampDesigner.name || "hospital-stamp").replace(/\s+/g, "-").toLowerCase()}.${extension}`;
      link.click();
    };

    if (format === "svg") {
      download(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), "svg");
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1200;
      canvas.getContext("2d")?.drawImage(image, 0, 0, 1200, 1200);
      download(canvas.toDataURL("image/png"), "png");
    };
    image.src = stampSvgDataUrl();
  };

  // const cloneElementForPDF = (element: HTMLDivElement): HTMLDivElement => {
  //   const clone = element.cloneNode(true) as HTMLDivElement;

  //   // Remove problematic Tailwind-generated styles
  //   const styleSheets = document.styleSheets;
  //   const newStyle = document.createElement("style");

  //   let cssText = "";
  //   try {
  //     for (let i = 0; i < styleSheets.length; i++) {
  //       try {
  //         const sheet = styleSheets[i];
  //         if (sheet.cssRules) {
  //           for (let j = 0; j < sheet.cssRules.length; j++) {
  //             const rule = sheet.cssRules[j];
  //             // Skip rules with lab() or other unsupported color functions
  //             if (rule.cssText && !rule.cssText.includes("lab(")) {
  //               cssText += rule.cssText + "\n";
  //             }
  //           }
  //         }
  //       } catch (e) {
  //         // Skip CORS errors from external stylesheets
  //       }
  //     }
  //   } catch (e) {
  //     // Fallback if stylesheet access fails
  //   }

  //   return clone;
  // };

  const cloneElementForPDF = (element: HTMLDivElement): HTMLDivElement => {
    const clone = element.cloneNode(true) as HTMLDivElement;

    clone.style.position = "absolute";
    clone.style.left = "-99999px";
    clone.style.top = "0";
    clone.style.width = `${element.offsetWidth}px`;
    clone.style.height = `${element.offsetHeight}px`;

    document.body.appendChild(clone);

    // Remove stylesheets from the clone because html2canvas
    // can fail parsing unsupported CSS color functions such as lab().
    clone.querySelectorAll("style").forEach((style) => {
      style.remove();
    });

    return clone;
  };

  const generatePDF = async () => {
    closePDFModal();
    setIsGenerating(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const pagesToRender: {
        element: HTMLDivElement;
        label: string;
        type: string;
      }[] = [];

      // Collect selected pages
      if (docType === "diagnostic" && selectedPages.diagnostic) {
        if (diagSheetRef.current)
          pagesToRender.push({
            element: diagSheetRef.current,
            label: "Diagnostic Report",
            type: "diagnostic",
          });
      } else if (docType === "fitness" && selectedPages.fitness) {
        if (fitSheetRef.current)
          pagesToRender.push({
            element: fitSheetRef.current,
            label: "Fitness Certificate",
            type: "fitness",
          });
      } else if (docType === "discharge") {
        if (selectedPages.discharge_page1 && page1Ref.current)
          pagesToRender.push({
            element: page1Ref.current,
            label: "Discharge Summary - Page 1",
            type: "discharge_1",
          });
        if (selectedPages.discharge_page2 && page2Ref.current)
          pagesToRender.push({
            element: page2Ref.current,
            label: "Discharge Summary - Page 2",
            type: "discharge_2",
          });
        if (selectedPages.discharge_page3 && page3Ref.current)
          pagesToRender.push({
            element: page3Ref.current,
            label: "Discharge Summary - Page 3",
            type: "discharge_3",
          });

        customPagesRefs.current.forEach((el, idx) => {
          if (el)
            pagesToRender.push({
              element: el,
              label: `Discharge Summary - Custom Page ${idx + 1}`,
              type: `custom_${idx}`,
            });
        });
      }

      if (pagesToRender.length === 0) {
        alert("Please select at least one page to save!");
        setIsGenerating(false);
        return;
      }

      if (pdfSaveMode === "separate" && pagesToRender.length > 1) {
        // Save each page separately
        for (const pageData of pagesToRender) {
          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
          });

          try {
            const canvas = await html2canvas(pageData.element, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff",
              allowTaint: true,
            });

            const imgData = canvas.toDataURL("image/png");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

            const width = imgWidth * ratio;
            const height = imgHeight * ratio;
            const x = (pdfWidth - width) / 2;
            const y = 0;

            pdf.addImage(imgData, "PNG", x, y, width, height);
            pdf.save(
              `${pageData.label.replace(/\s+/g, "_")}_${data.patientName.replace(/\s+/g, "_")}.pdf`,
            );
          } catch (pageError) {
            console.error(`Error rendering ${pageData.label}:`, pageError);
            alert(`Error generating PDF for ${pageData.label}`);
          }
        }
      } else {
        // Save all selected pages in one PDF
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        for (let i = 0; i < pagesToRender.length; i++) {
          try {
            const element = pagesToRender[i].element;
            const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff",
              allowTaint: true,
            });

            const imgData = canvas.toDataURL("image/png");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

            const width = imgWidth * ratio;
            const height = imgHeight * ratio;
            const x = (pdfWidth - width) / 2;
            const y = 0;

            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, "PNG", x, y, width, height);
          } catch (pageError) {
            console.error(`Error rendering page ${i + 1}:`, pageError);
            alert(`Error generating PDF for page ${i + 1}`);
          }
        }

        pdf.save(
          `${
            docType === "diagnostic"
              ? "Diagnostic_Report"
              : docType === "fitness"
                ? "Fitness_Certificate"
                : "Discharge_Summary"
          }_${data.patientName.replace(/\s+/g, "_")}.pdf`,
        );
      }
    } catch (e) {
      console.error("PDF Generation Error:", e);
      alert(
        `Error generating PDF: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const totalPages =
    docType === "diagnostic"
      ? 1
      : docType === "fitness"
        ? 1
        : 3 + data.customPages.length;

  const renderDocumentStamps = (
    documentType: "diagnostic" | "discharge" | "fitness",
    page: number,
  ) =>
    data.dischargeSummaryStamps.map((stamp) => {
      // Treat stamps created before document selection was added as discharge stamps.
      const appliesToDocument = (stamp.documentTypes ?? ["discharge"]).includes(
        documentType,
      );
      const appliesToPage = stamp.pages.includes(page);

      const stampImage = stamp.image || (stamp.nameDesigner ? nameStampSvgDataUrl(stamp.nameDesigner) : "");
      if (!stampImage || !appliesToDocument || !appliesToPage) return null;

      return (
        <div
          key={stamp.id}
          className="absolute pointer-events-none z-20"
          style={{
            left: `${stamp.x}%`,
            top: `${stamp.y}%`,
            transform: `translate(-50%, -50%) rotate(${stamp.rotation}deg)`,
            width: `${stamp.size}%`,
            opacity: stamp.opacity,
            filter:
              stamp.filter === "grayscale"
                ? "grayscale(100%)"
                : stamp.filter === "sepia"
                  ? "sepia(100%)"
                  : stamp.filter === "brightness"
                    ? "brightness(1.2)"
                    : "none",
          }}
        >
          <img
            src={stampImage}
            alt={stamp.label}
            className="w-full h-full object-contain select-none"
          />
        </div>
      );
    });

  const renderHeaderBrand = (compact = false) => {
    const textSize = compact
      ? `${data.logoTextSize * 0.8}px`
      : `${data.logoTextSize}px`;
    const textWeight = data.logoTextWeight;

    return (
      <div
        className="relative flex items-center justify-start min-w-0 w-full"
        style={{ minHeight: compact ? "32px" : "44px", overflow: "visible" }}
      >
        {data.headerLogos.map(
          (logo) =>
            logo.image && (
              <div
                key={logo.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${logo.x}%`,
                  top: `${logo.y}%`,
                  width: `${logo.width ?? 100}%`,
                  height: `${logo.height ?? 100}%`,
                  maxWidth: "none",
                  maxHeight: "100%",
                  opacity: logo.opacity,
                  transform: `translate(-50%, -50%) scale(${logo.size / 100})`,
                  zIndex: 20,
                }}
              >
                <img
                  src={logo.image}
                  alt="Extra header logo"
                  className="w-full h-full object-contain"
                />
              </div>
            ),
        )}

        {data.logoType === "image" && data.logoImage ? (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: `${data.logoImageX}%`,
              top: `${data.logoImageY}%`,
              width: `${data.logoImageWidth}%`,
              height: `${data.logoImageHeight}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <img
              src={data.logoImage}
              alt="Hospital Logo"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center min-w-0">
            <span
              style={{
                color: data.logoTextColor,
                fontSize: textSize,
                fontWeight: textWeight,
                lineHeight: 1,
              }}
            >
              {data.hospitalName.split(" ")[0] || "Orchid"}
            </span>
            <span
              className="ml-1 block leading-tight border-l pl-2"
              style={{
                color: data.reportTheme.muted,
                borderColor: data.reportTheme.border,
                fontSize: compact ? "12px" : "16px",
                fontWeight: 400,
              }}
            >
              {data.hospitalName.split(" ").slice(1).join(" ") ||
                "Medical Centre"}
              <span
                className="block uppercase tracking-widest font-bold"
                style={{
                  color: data.reportTheme.muted,
                  fontSize: compact ? "7px" : "8px",
                  letterSpacing: "0.14em",
                }}
              >
                {data.hospitalTagline}
              </span>
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderWatermark = (pageNumber: number) => {
    if (!data.watermarkEnabled || !data.watermarkPages.includes(pageNumber)) {
      return null;
    }

    return (
      <>
        {data.watermarkImageEnabled && data.watermarkImage && (
          <div
            className="absolute pointer-events-none z-0"
            style={{
              opacity: data.watermarkOpacity,
              left: `${data.watermarkX}%`,
              top: `${data.watermarkY}%`,
              transform: "translate(-50%, -50%)",
              width: "70%",
              maxWidth: "450px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={data.watermarkImage}
              alt="watermark"
              className="w-full h-full object-contain select-none"
            />
          </div>
        )}
        {data.watermarkText && (
          <div
            className="absolute pointer-events-none z-0 select-none whitespace-pre-wrap text-center"
            style={{
              left: `${data.watermarkTextX}%`,
              top: `${data.watermarkTextY}%`,
              transform: `translate(-50%, -50%) rotate(${data.watermarkTextRotation}deg) skew(${data.watermarkTextSkewX}deg, ${data.watermarkTextSkewY}deg)`,
              color: data.watermarkTextColor,
              fontSize: `${data.watermarkTextSize}px`,
              fontWeight: data.watermarkTextWeight,
              fontStyle: data.watermarkTextStyle,
              letterSpacing: `${data.watermarkTextLetterSpacing}px`,
              textTransform: data.watermarkTextTransform,
              opacity: data.watermarkTextOpacity,
              lineHeight: 1.1,
              maxWidth: "90%",
            }}
          >
            {data.watermarkText}
          </div>
        )}
      </>
    );
  };

  const reportPageStyle = (fontSize: string, lineHeight: string) => ({
    boxSizing: "border-box" as const,
    fontSize,
    lineHeight,
    backgroundColor: data.reportTheme.background,
    color: data.reportTheme.text,
  });

  const reportSectionStyle = () => ({
    backgroundColor: data.reportTheme.primarySoft,
    color: data.reportTheme.heading,
    borderLeft: `3px solid ${data.reportTheme.primary}`,
  });

  const renderLogoWatermarkSettings = () => (
    <>
      {/* Logo Section */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4" />
          Logo Settings
        </h4>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1.5 font-semibold">
            Logo Style
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleInputChange("logoType", "text")}
              className={`flex-1 py-1.5 text-xs font-bold rounded ${
                data.logoType === "text"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              Default Text Logo
            </button>
            <button
              onClick={() => handleInputChange("logoType", "image")}
              className={`flex-1 py-1.5 text-xs font-bold rounded ${
                data.logoType === "image"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              Upload Custom Logo
            </button>
          </div>
        </div>

        {data.logoType === "text" && (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold">
                Hospital Name (Text Logo)
              </label>
              <input
                type="text"
                value={data.hospitalName}
                onChange={(e) =>
                  handleInputChange("hospitalName", e.target.value)
                }
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Orchid Medical Centre"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  Text Color
                </label>
                <input
                  type="color"
                  value={data.logoTextColor}
                  onChange={(e) =>
                    handleInputChange("logoTextColor", e.target.value)
                  }
                  className="w-full h-9 rounded border border-slate-700 bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  Text Size ({data.logoTextSize}px)
                </label>
                <input
                  type="range"
                  min="14"
                  max="40"
                  value={data.logoTextSize}
                  onChange={(e) =>
                    handleInputChange("logoTextSize", Number(e.target.value))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                Font Weight ({data.logoTextWeight})
              </label>
              <input
                type="range"
                min="400"
                max="900"
                step="100"
                value={data.logoTextWeight}
                onChange={(e) =>
                  handleInputChange("logoTextWeight", Number(e.target.value))
                }
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        )}

        {data.logoType === "image" && (
          <div className="space-y-3">
            <label className="block text-[10px] text-slate-500 font-semibold">
              Hospital Logo Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, "logoImage")}
              className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
            />
            {data.logoImage && (
              <div className="bg-white p-2 rounded flex justify-center max-h-16 overflow-hidden mt-1">
                <img
                  src={data.logoImage}
                  alt="Logo preview"
                  className="object-contain"
                />
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400">
                Use any values for size or position; values above 100% can extend across the page.
              </span>
              <button
                type="button"
                onClick={() =>
                  setData((previous) => ({
                    ...previous,
                    logoImageWidth: 100,
                    logoImageHeight: 100,
                    logoImageX: 50,
                    logoImageY: 50,
                  }))
                }
                className="shrink-0 ml-2 px-2 py-1 text-[10px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Full Width
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
              {[
                ["Width (%)", "logoImageWidth"],
                ["Height (%)", "logoImageHeight"],
                ["X Position (%)", "logoImageX"],
                ["Y Position (%)", "logoImageY"],
              ].map(([label, field]) => (
                <label key={field} className="space-y-1">
                  <span>{label}</span>
                  <input
                    type="number"
                    value={data[field as "logoImageWidth" | "logoImageHeight" | "logoImageX" | "logoImageY"]}
                    onChange={(event) =>
                      handleInputChange(
                        field as "logoImageWidth" | "logoImageHeight" | "logoImageX" | "logoImageY",
                        Number(event.target.value),
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Extra Header Logos
            </h5>
            <button
              type="button"
              onClick={addHeaderLogo}
              className="bg-emerald-500 text-slate-950 px-2.5 py-1 rounded text-[10px] font-bold"
            >
              + Add Logo
            </button>
          </div>

          {data.headerLogos.map((logo) => (
            <div
              key={logo.id}
              className="bg-slate-900 border border-slate-800 rounded p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-300">
                  Logo {data.headerLogos.indexOf(logo) + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeHeaderLogo(logo.id)}
                  className="text-red-400 text-[10px] font-semibold"
                >
                  Remove
                </button>
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleHeaderLogoUpload(e, logo.id)}
                className="w-full text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
              />

              {logo.image && (
                <div className="bg-white rounded p-2 flex justify-center max-h-12 overflow-hidden">
                  <img
                    src={logo.image}
                    alt="Header logo preview"
                    className="object-contain max-h-10"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
                <div className="col-span-2">
                  <label>Scale ({logo.size}%)</label>
                  <input
                    type="range"
                    min="1"
                    max="150"
                    value={logo.size}
                    onChange={(e) =>
                      handleHeaderLogoChange(
                        logo.id,
                        "size",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label>Opacity ({Math.round(logo.opacity * 100)}%)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={logo.opacity}
                    onChange={(e) =>
                      handleHeaderLogoChange(
                        logo.id,
                        "opacity",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label>Width (% of header)</label>
                  <input
                    type="number"
                    value={logo.width ?? 100}
                    onChange={(e) =>
                      handleHeaderLogoChange(
                        logo.id,
                        "width",
                        Number(e.target.value),
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label>Height (% of header)</label>
                  <input
                    type="number"
                    value={logo.height ?? 100}
                    onChange={(e) =>
                      handleHeaderLogoChange(
                        logo.id,
                        "height",
                        Number(e.target.value),
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label>X Position (%)</label>
                  <input
                    type="number"
                    value={logo.x}
                    onChange={(e) =>
                      handleHeaderLogoChange(logo.id, "x", Number(e.target.value))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label>Y Position (%)</label>
                  <input
                    type="number"
                    value={logo.y}
                    onChange={(e) =>
                      handleHeaderLogoChange(logo.id, "y", Number(e.target.value))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
          Report Theme
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "primary", label: "Primary Accent" },
            { key: "primarySoft", label: "Soft Accent" },
            { key: "text", label: "Text" },
            { key: "muted", label: "Muted" },
            { key: "border", label: "Border" },
            { key: "heading", label: "Heading" },
          ].map((colorField) => (
            <div key={colorField.key}>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                {colorField.label}
              </label>
              <input
                type="color"
                value={data.reportTheme[colorField.key as keyof ReportTheme]}
                onChange={(e) =>
                  handleInputChange("reportTheme", {
                    ...data.reportTheme,
                    [colorField.key]: e.target.value,
                  })
                }
                className="w-full h-9 rounded border border-slate-700 bg-slate-900"
              />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-semibold mb-1">
            Page Background
          </label>
          <input
            type="color"
            value={data.reportTheme.background}
            onChange={(e) =>
              handleInputChange("reportTheme", {
                ...data.reportTheme,
                background: e.target.value,
              })
            }
            className="w-full h-9 rounded border border-slate-700 bg-slate-900"
          />
        </div>
      </div>

      {/* Watermark Section */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
          <span>Watermark Configuration</span>
          <button
            onClick={() =>
              handleInputChange("watermarkEnabled", !data.watermarkEnabled)
            }
            className={`px-3 py-1 rounded text-[10px] font-bold ${
              data.watermarkEnabled
                ? "bg-emerald-500 text-slate-950"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {data.watermarkEnabled ? "ENABLED" : "DISABLED"}
          </button>
        </h4>

        {data.watermarkEnabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] text-slate-400 font-semibold">
                  Image Watermark (optional)
                </label>
                <button
                  onClick={() =>
                    handleInputChange(
                      "watermarkImageEnabled",
                      !data.watermarkImageEnabled,
                    )
                  }
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    data.watermarkImageEnabled
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {data.watermarkImageEnabled ? "IMAGE ON" : "IMAGE OFF"}
                </button>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, "watermarkImage")}
                className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
              />
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <label className="block text-[11px] text-emerald-400 font-semibold">
                Text Watermark (optional — works with or without an image)
              </label>
              <textarea
                value={data.watermarkText}
                onChange={(e) => handleInputChange("watermarkText", e.target.value)}
                placeholder="e.g. CONFIDENTIAL"
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
              />

              {data.watermarkText && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Text Color</label>
                      <input
                        type="color"
                        value={data.watermarkTextColor}
                        onChange={(e) => handleInputChange("watermarkTextColor", e.target.value)}
                        className="w-full h-9 rounded border border-slate-700 bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Style</label>
                      <select
                        value={data.watermarkTextStyle}
                        onChange={(e) => handleInputChange("watermarkTextStyle", e.target.value as ReportData["watermarkTextStyle"])}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                      >
                        <option value="normal">Normal</option>
                        <option value="italic">Italic</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Case</label>
                      <select
                        value={data.watermarkTextTransform}
                        onChange={(e) => handleInputChange("watermarkTextTransform", e.target.value as ReportData["watermarkTextTransform"])}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                      >
                        <option value="uppercase">UPPERCASE</option>
                        <option value="normal">As typed</option>
                        <option value="lowercase">lowercase</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Weight ({data.watermarkTextWeight})</label>
                      <input type="range" min="100" max="900" step="100" value={data.watermarkTextWeight} onChange={(e) => handleInputChange("watermarkTextWeight", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Size ({data.watermarkTextSize}px)</label>
                      <input type="range" min="12" max="160" value={data.watermarkTextSize} onChange={(e) => handleInputChange("watermarkTextSize", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Opacity ({Math.round(data.watermarkTextOpacity * 100)}%)</label>
                      <input type="range" min="0.05" max="1" step="0.01" value={data.watermarkTextOpacity} onChange={(e) => handleInputChange("watermarkTextOpacity", parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Text X-Axis ({data.watermarkTextX}%)</label>
                      <input type="range" min="0" max="100" value={data.watermarkTextX} onChange={(e) => handleInputChange("watermarkTextX", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Text Y-Axis ({data.watermarkTextY}%)</label>
                      <input type="range" min="0" max="100" value={data.watermarkTextY} onChange={(e) => handleInputChange("watermarkTextY", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Rotate ({data.watermarkTextRotation}°)</label>
                      <input type="range" min="-180" max="180" value={data.watermarkTextRotation} onChange={(e) => handleInputChange("watermarkTextRotation", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Skew X ({data.watermarkTextSkewX}°)</label>
                      <input type="range" min="-45" max="45" value={data.watermarkTextSkewX} onChange={(e) => handleInputChange("watermarkTextSkewX", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Skew Y ({data.watermarkTextSkewY}°)</label>
                      <input type="range" min="-45" max="45" value={data.watermarkTextSkewY} onChange={(e) => handleInputChange("watermarkTextSkewY", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Letter Spacing ({data.watermarkTextLetterSpacing}px)</label>
                    <input type="range" min="-2" max="20" value={data.watermarkTextLetterSpacing} onChange={(e) => handleInputChange("watermarkTextLetterSpacing", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                Watermark Opacity ({Math.round(data.watermarkOpacity * 100)}%)
              </label>
              <input
                type="range"
                min="0.05"
                max="0.4"
                step="0.01"
                value={data.watermarkOpacity}
                onChange={(e) =>
                  handleInputChange(
                    "watermarkOpacity",
                    parseFloat(e.target.value),
                  )
                }
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Horizontal X-Axis ({data.watermarkX}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={data.watermarkX}
                  onChange={(e) =>
                    handleInputChange("watermarkX", parseInt(e.target.value))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Vertical Y-Axis ({data.watermarkY}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={data.watermarkY}
                  onChange={(e) =>
                    handleInputChange("watermarkY", parseInt(e.target.value))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-2 font-semibold">
                Apply Watermark on Pages:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  const isChecked = data.watermarkPages.includes(pNum);
                  return (
                    <button
                      key={pNum}
                      onClick={() => handleWatermarkPageToggle(pNum)}
                      className={`flex items-center space-x-2 p-2 rounded text-xs border text-left transition-all ${
                        isChecked
                          ? "bg-emerald-950/40 border-emerald-500 text-emerald-400"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>Page {pNum}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const renderDischargeSummaryStamps = () => (
    <>
      {/* Discharge Summary Stamps Section */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" />
            Shared Document Stamps
          </h4>
          <button
            onClick={addStamp}
            className="text-xs bg-slate-800 text-emerald-400 hover:bg-slate-700 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Stamp
          </button>
        </div>

        <div className="bg-slate-900 p-3.5 rounded-lg border border-emerald-900/60 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-emerald-300">Stamp Designer</h5>
              <p className="text-[10px] text-slate-500">Create a distressed ink-style seal, export it, or add it directly to the document.</p>
            </div>
            <div className="w-20 h-20 rounded bg-white/95 p-1 shrink-0">
              <img src={stampSvgDataUrl()} alt="Designed stamp preview" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              value={stampDesigner.name}
              onChange={(e) => setStampDesigner({ ...stampDesigner, name: e.target.value })}
              placeholder="Saved stamp name"
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100"
            />
            <select
              value={stampDesigner.shape}
              onChange={(e) => setStampDesigner({ ...stampDesigner, shape: e.target.value as StampDesigner["shape"] })}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="round">Round seal</option>
              <option value="rectangle">Rectangle seal</option>
            </select>
          </div>
          <input value={stampDesigner.mainText} onChange={(e) => setStampDesigner({ ...stampDesigner, mainText: e.target.value })} placeholder="Main stamp text" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 font-bold" />
          <div className="grid grid-cols-2 gap-3">
            <input value={stampDesigner.topText} onChange={(e) => setStampDesigner({ ...stampDesigner, topText: e.target.value })} placeholder="Top ring text" className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100" />
            <input value={stampDesigner.bottomText} onChange={(e) => setStampDesigner({ ...stampDesigner, bottomText: e.target.value })} placeholder="Bottom ring text" className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Ink color</label>
              <input type="color" value={stampDesigner.color} onChange={(e) => setStampDesigner({ ...stampDesigner, color: e.target.value })} className="w-full h-8 rounded border border-slate-700 bg-slate-800" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Ink ({Math.round(stampDesigner.inkOpacity * 100)}%)</label>
              <input type="range" min="0.35" max="1" step="0.05" value={stampDesigner.inkOpacity} onChange={(e) => setStampDesigner({ ...stampDesigner, inkOpacity: parseFloat(e.target.value) })} className="w-full accent-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Distress ({stampDesigner.distress})</label>
              <input type="range" min="0" max="12" value={stampDesigner.distress} onChange={(e) => setStampDesigner({ ...stampDesigner, distress: parseInt(e.target.value) })} className="w-full accent-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Ink spread ({stampDesigner.inkSpread.toFixed(1)})</label>
              <input type="range" min="0" max="3" step="0.1" value={stampDesigner.inkSpread} onChange={(e) => setStampDesigner({ ...stampDesigner, inkSpread: parseFloat(e.target.value) })} className="w-full accent-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Edge softness ({stampDesigner.edgeSoftness.toFixed(1)})</label>
              <input type="range" min="0" max="1.5" step="0.1" value={stampDesigner.edgeSoftness} onChange={(e) => setStampDesigner({ ...stampDesigner, edgeSoftness: parseFloat(e.target.value) })} className="w-full accent-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Fade ink on side</label>
              <select value={stampDesigner.fadeSide} onChange={(e) => setStampDesigner({ ...stampDesigner, fadeSide: e.target.value as StampDesigner["fadeSide"] })} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100">
                <option value="none">No edge fade</option>
                <option value="top">Top edge</option>
                <option value="right">Right edge</option>
                <option value="bottom">Bottom edge</option>
                <option value="left">Left edge</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Fade strength ({Math.round(stampDesigner.fadeStrength * 100)}%)</label>
              <input type="range" min="0.1" max="1" step="0.05" value={stampDesigner.fadeStrength} onChange={(e) => setStampDesigner({ ...stampDesigner, fadeStrength: parseFloat(e.target.value) })} className="w-full accent-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[10px] text-slate-400">
            <div>Ink spill ({stampDesigner.inkSpill})<input type="range" min="0" max="16" value={stampDesigner.inkSpill} onChange={(e) => setStampDesigner({ ...stampDesigner, inkSpill: parseInt(e.target.value) })} className="w-full accent-emerald-500" /></div>
            <div>Border <input type="checkbox" checked={stampDesigner.borderEnabled} onChange={(e) => setStampDesigner({ ...stampDesigner, borderEnabled: e.target.checked })} className="ml-1 accent-emerald-500" /><input type="range" min="0.5" max="2.5" step="0.1" value={stampDesigner.borderWidth} onChange={(e) => setStampDesigner({ ...stampDesigner, borderWidth: parseFloat(e.target.value) })} className="w-full accent-emerald-500" /></div>
            <div>Uneven text ({Math.round(stampDesigner.textOpacityVariation * 100)}%)<input type="range" min="0" max="0.6" step="0.05" value={stampDesigner.textOpacityVariation} onChange={(e) => setStampDesigner({ ...stampDesigner, textOpacityVariation: parseFloat(e.target.value) })} className="w-full accent-emerald-500" /></div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={useDesignedStamp} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 px-3 py-1.5 rounded text-xs font-bold">Use in stamp area</button>
            <button onClick={() => downloadDesignedStamp("png")} className="bg-slate-800 text-slate-200 hover:bg-slate-700 px-3 py-1.5 rounded text-xs font-semibold">Save PNG</button>
            <button onClick={() => downloadDesignedStamp("svg")} className="bg-slate-800 text-slate-200 hover:bg-slate-700 px-3 py-1.5 rounded text-xs font-semibold">Save SVG</button>
          </div>
        </div>

        <div className="bg-slate-900 p-3.5 rounded-lg border border-blue-900/60 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-blue-300">Doctor Name Stamp</h5>
              <p className="text-[10px] text-slate-500">A realistic ink-style doctor stamp. It can be placed anywhere on every diagnostic, discharge, or fitness page.</p>
            </div>
            <div className="w-20 h-20 rounded bg-white/95 p-1 shrink-0"><img src={nameStampSvgDataUrl()} alt="Doctor name stamp preview" className="w-full h-full object-contain" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={nameStampDesigner.doctorName} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, doctorName: e.target.value })} placeholder="Doctor name" className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 font-semibold" />
            <input value={nameStampDesigner.department} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, department: e.target.value })} placeholder="Department" className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100" />
            <input value={nameStampDesigner.degree} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, degree: e.target.value })} placeholder="Degree / qualification" className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100" />
            <input value={nameStampDesigner.hospitalName} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, hospitalName: e.target.value })} placeholder="Hospital name" className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-[10px] text-slate-500 font-semibold mb-1">Ink color</label><input type="color" value={nameStampDesigner.color} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, color: e.target.value })} className="w-full h-8 rounded border border-slate-700 bg-slate-800" /></div>
            <div><label className="block text-[10px] text-slate-500 font-semibold mb-1">Shape</label><select value={nameStampDesigner.shape} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, shape: e.target.value as NameStampDesigner["shape"] })} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100"><option value="rectangle">Rectangle</option><option value="round">Round</option></select></div>
            <div><label className="block text-[10px] text-slate-500 font-semibold mb-1">Ink ({Math.round(nameStampDesigner.inkOpacity * 100)}%)</label><input type="range" min="0.35" max="1" step="0.05" value={nameStampDesigner.inkOpacity} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, inkOpacity: parseFloat(e.target.value) })} className="w-full accent-blue-500" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[10px] text-slate-400">
            <div>Distress ({nameStampDesigner.distress})<input type="range" min="0" max="12" value={nameStampDesigner.distress} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, distress: parseInt(e.target.value) })} className="w-full accent-blue-500" /></div>
            <div>Ink spread ({nameStampDesigner.inkSpread.toFixed(1)})<input type="range" min="0" max="3" step="0.1" value={nameStampDesigner.inkSpread} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, inkSpread: parseFloat(e.target.value) })} className="w-full accent-blue-500" /></div>
            <div>Edge softness ({nameStampDesigner.edgeSoftness.toFixed(1)})<input type="range" min="0" max="1.5" step="0.1" value={nameStampDesigner.edgeSoftness} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, edgeSoftness: parseFloat(e.target.value) })} className="w-full accent-blue-500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-400"><div>Fade ink on side<select value={nameStampDesigner.fadeSide} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, fadeSide: e.target.value as NameStampDesigner["fadeSide"] })} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100"><option value="none">No fade</option><option value="top">Top</option><option value="right">Right</option><option value="bottom">Bottom</option><option value="left">Left</option></select></div><div>Fade strength ({Math.round(nameStampDesigner.fadeStrength * 100)}%)<input type="range" min="0.1" max="1" step="0.05" value={nameStampDesigner.fadeStrength} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, fadeStrength: parseFloat(e.target.value) })} className="mt-2 w-full accent-blue-500" /></div></div>
          <div className="grid grid-cols-3 gap-3 text-[10px] text-slate-400"><div>Ink spill ({nameStampDesigner.inkSpill})<input type="range" min="0" max="16" value={nameStampDesigner.inkSpill} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, inkSpill: parseInt(e.target.value) })} className="w-full accent-blue-500" /></div><div>Border <input type="checkbox" checked={nameStampDesigner.borderEnabled} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, borderEnabled: e.target.checked })} className="ml-1 accent-blue-500" /><input type="range" min="0.5" max="2.5" step="0.1" value={nameStampDesigner.borderWidth} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, borderWidth: parseFloat(e.target.value) })} className="w-full accent-blue-500" /></div><div>Uneven text / random fade ({Math.round(nameStampDesigner.textOpacityVariation * 100)}%)<input type="range" min="0" max="1" step="0.05" value={nameStampDesigner.textOpacityVariation} onChange={(e) => setNameStampDesigner({ ...nameStampDesigner, textOpacityVariation: parseFloat(e.target.value) })} className="w-full accent-blue-500" /></div></div>
          <button onClick={useNameStamp} className="bg-blue-500 text-white hover:bg-blue-400 px-3 py-1.5 rounded text-xs font-bold">Add doctor name stamp</button>
        </div>

        <div className="space-y-4">
          {data.dischargeSummaryStamps.map((stamp) => (
            <div
              key={stamp.id}
              className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3"
            >
              <div className="flex justify-between items-center gap-2">
                <input
                  type="text"
                  value={stamp.label}
                  onChange={(e) =>
                    handleStampChange(stamp.id, "label", e.target.value)
                  }
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none flex-1 font-semibold"
                  placeholder="Stamp Label"
                />
                {!stamp.isDefault && (
                  <button
                    onClick={() => removeStamp(stamp.id)}
                    className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                    title="Delete stamp"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Stamp Image Upload */}
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  Stamp Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleStampImageUpload(e, stamp.id)}
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                />
                {stamp.image && (
                  <div className="bg-slate-800 p-2 rounded flex justify-center max-h-16 overflow-hidden mt-1">
                    <img
                      src={stamp.image}
                      alt="Stamp preview"
                      className="object-contain max-w-full"
                    />
                  </div>
                )}
              </div>

              {stamp.designer && (
                <div className="border border-emerald-900/60 bg-emerald-950/10 rounded p-2.5 space-y-2.5">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Editable stamp content</p>
                    <p className="text-[10px] text-slate-500">Changes regenerate this designed stamp. Uploaded image stamps remain image-only.</p>
                  </div>
                  <input
                    value={stamp.designer.mainText}
                    onChange={(e) => handleDesignedStampChange(stamp.id, "mainText", e.target.value)}
                    placeholder="Main stamp text"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 font-bold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={stamp.designer.topText}
                      onChange={(e) => handleDesignedStampChange(stamp.id, "topText", e.target.value)}
                      placeholder="Top text"
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100"
                    />
                    <input
                      value={stamp.designer.bottomText}
                      onChange={(e) => handleDesignedStampChange(stamp.id, "bottomText", e.target.value)}
                      placeholder="Bottom text"
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="color"
                      value={stamp.designer.color}
                      onChange={(e) => handleDesignedStampChange(stamp.id, "color", e.target.value)}
                      className="w-full h-8 rounded border border-slate-700 bg-slate-800"
                      title="Ink color"
                    />
                    <select
                      value={stamp.designer.shape}
                      onChange={(e) => handleDesignedStampChange(stamp.id, "shape", e.target.value as StampDesigner["shape"])}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                    >
                      <option value="round">Round</option>
                      <option value="rectangle">Rectangle</option>
                    </select>
                    <div className="text-[10px] text-slate-400">
                      Ink {Math.round(stamp.designer.inkOpacity * 100)}%
                      <input type="range" min="0.35" max="1" step="0.05" value={stamp.designer.inkOpacity} onChange={(e) => handleDesignedStampChange(stamp.id, "inkOpacity", parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Distress / ink imperfection ({stamp.designer.distress})
                    <input type="range" min="0" max="12" value={stamp.designer.distress} onChange={(e) => handleDesignedStampChange(stamp.id, "distress", parseInt(e.target.value))} className="w-full accent-emerald-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>
                      Ink spread ({stamp.designer.inkSpread.toFixed(1)})
                      <input type="range" min="0" max="3" step="0.1" value={stamp.designer.inkSpread} onChange={(e) => handleDesignedStampChange(stamp.id, "inkSpread", parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                    <div>
                      Edge softness ({stamp.designer.edgeSoftness.toFixed(1)})
                      <input type="range" min="0" max="1.5" step="0.1" value={stamp.designer.edgeSoftness} onChange={(e) => handleDesignedStampChange(stamp.id, "edgeSoftness", parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>
                      Fade ink on side
                      <select value={stamp.designer.fadeSide} onChange={(e) => handleDesignedStampChange(stamp.id, "fadeSide", e.target.value as StampDesigner["fadeSide"])} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100">
                        <option value="none">No fade</option>
                        <option value="top">Top</option>
                        <option value="right">Right</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                      </select>
                    </div>
                    <div>
                      Fade strength ({Math.round(stamp.designer.fadeStrength * 100)}%)
                      <input type="range" min="0.1" max="1" step="0.05" value={stamp.designer.fadeStrength} onChange={(e) => handleDesignedStampChange(stamp.id, "fadeStrength", parseFloat(e.target.value))} className="mt-2 w-full accent-emerald-500" />
                    </div>
                  </div>
                </div>
              )}

              {stamp.nameDesigner && (
                <div className="border border-blue-900/60 bg-blue-950/10 rounded p-2.5 space-y-2.5">
                  <div><p className="text-[10px] font-bold text-blue-300 uppercase tracking-wide">Editable doctor name stamp</p><p className="text-[10px] text-slate-500">Every change regenerates the stamp in the preview immediately.</p></div>
                  <div className="grid grid-cols-2 gap-2">
                    {([ ["doctorName", "Doctor name"], ["department", "Department"], ["degree", "Degree / qualification"], ["hospitalName", "Hospital name"] ] as const).map(([key, placeholder]) => <input key={key} value={stamp.nameDesigner![key]} onChange={(e) => handleNameStampChange(stamp.id, key, e.target.value)} placeholder={placeholder} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100" />)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                    <div>Ink color<input type="color" value={stamp.nameDesigner.color} onChange={(e) => handleNameStampChange(stamp.id, "color", e.target.value)} className="mt-1 w-full h-7 rounded border border-slate-700 bg-slate-800" /></div>
                    <div>Shape<select value={stamp.nameDesigner.shape} onChange={(e) => handleNameStampChange(stamp.id, "shape", e.target.value as NameStampDesigner["shape"])} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-xs text-slate-100"><option value="rectangle">Rectangle</option><option value="round">Round</option></select></div>
                    <div>Border<input type="checkbox" checked={stamp.nameDesigner.borderEnabled} onChange={(e) => handleNameStampChange(stamp.id, "borderEnabled", e.target.checked)} className="ml-2 accent-blue-500" /><input type="range" min="0.5" max="2.5" step="0.1" value={stamp.nameDesigner.borderWidth} onChange={(e) => handleNameStampChange(stamp.id, "borderWidth", parseFloat(e.target.value))} className="mt-1 w-full accent-blue-500" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                    <div>Spill ({stamp.nameDesigner.inkSpill})<input type="range" min="0" max="16" value={stamp.nameDesigner.inkSpill} onChange={(e) => handleNameStampChange(stamp.id, "inkSpill", parseInt(e.target.value))} className="w-full accent-blue-500" /></div>
                    <div>Irregularity ({stamp.nameDesigner.sizeMismatch})<input type="range" min="0" max="8" value={stamp.nameDesigner.sizeMismatch} onChange={(e) => handleNameStampChange(stamp.id, "sizeMismatch", parseInt(e.target.value))} className="w-full accent-blue-500" /></div>
                    <div>Uneven text / random fade ({Math.round(stamp.nameDesigner.textOpacityVariation * 100)}%)<input type="range" min="0" max="1" step="0.05" value={stamp.nameDesigner.textOpacityVariation} onChange={(e) => handleNameStampChange(stamp.id, "textOpacityVariation", parseFloat(e.target.value))} className="w-full accent-blue-500" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                    <div>Distress ({stamp.nameDesigner.distress})<input type="range" min="0" max="12" value={stamp.nameDesigner.distress} onChange={(e) => handleNameStampChange(stamp.id, "distress", parseInt(e.target.value))} className="w-full accent-blue-500" /></div>
                    <div>Ink spread ({stamp.nameDesigner.inkSpread.toFixed(1)})<input type="range" min="0" max="3" step="0.1" value={stamp.nameDesigner.inkSpread} onChange={(e) => handleNameStampChange(stamp.id, "inkSpread", parseFloat(e.target.value))} className="w-full accent-blue-500" /></div>
                    <div>Edge softness ({stamp.nameDesigner.edgeSoftness.toFixed(1)})<input type="range" min="0" max="1.5" step="0.1" value={stamp.nameDesigner.edgeSoftness} onChange={(e) => handleNameStampChange(stamp.id, "edgeSoftness", parseFloat(e.target.value))} className="w-full accent-blue-500" /></div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">Use this shared stamp in</label>
                <div className="flex gap-1.5">
                  {(["diagnostic", "discharge", "fitness"] as const).map((documentType) => {
                    const selected = stamp.documentTypes.includes(documentType);
                    return (
                      <button
                        key={documentType}
                        onClick={() => toggleStampDocumentType(stamp.id, documentType)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border ${selected ? "bg-emerald-950/50 border-emerald-500 text-emerald-300" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                      >
                        {documentType === "diagnostic" ? "Diagnostic Report" : documentType === "discharge" ? "Discharge Summary" : "Fitness Certificate"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">Apply stamp on page(s)</label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: totalPages }).map((_, index) => {
                    const page = index + 1;
                    const selected = stamp.pages.includes(page);
                    return (
                      <button
                        key={page}
                        onClick={() => toggleStampPage(stamp.id, page)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border ${selected ? "bg-emerald-950/50 border-emerald-500 text-emerald-300" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                      >
                        Page {page}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stamp Size */}
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  Size ({stamp.size}% of page width)
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={stamp.size}
                  onChange={(e) =>
                    handleStampChange(
                      stamp.id,
                      "size",
                      parseInt(e.target.value),
                    )
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Stamp Opacity */}
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  Opacity ({Math.round(stamp.opacity * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={stamp.opacity}
                  onChange={(e) =>
                    handleStampChange(
                      stamp.id,
                      "opacity",
                      parseFloat(e.target.value),
                    )
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Position Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                    X Position ({stamp.x}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={stamp.x}
                    onChange={(e) =>
                      handleStampChange(stamp.id, "x", parseInt(e.target.value))
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                    Y Position ({stamp.y}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={stamp.y}
                    onChange={(e) =>
                      handleStampChange(stamp.id, "y", parseInt(e.target.value))
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  Rotation ({stamp.rotation}°)
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={stamp.rotation}
                  onChange={(e) =>
                    handleStampChange(
                      stamp.id,
                      "rotation",
                      parseInt(e.target.value),
                    )
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Filter */}
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  Filter Effect
                </label>
                <select
                  value={stamp.filter}
                  onChange={(e) =>
                    handleStampChange(
                      stamp.id,
                      "filter",
                      e.target.value as
                        | "none"
                        | "grayscale"
                        | "sepia"
                        | "brightness",
                    )
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="none">None</option>
                  <option value="grayscale">Grayscale</option>
                  <option value="sepia">Sepia</option>
                  <option value="brightness">Brightness</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Workspace Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-xl font-black text-2xl shadow-lg shadow-emerald-500/20">
            HMS
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
              HMS
              <span className="bg-slate-800 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-normal">
                Active
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Generate professional, print-ready healthcare documentation
            </p>
          </div>
        </div>

        {/* Document Type Selector Toggle */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setDocType("diagnostic");
              setActiveTab("patient");
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${
              docType === "diagnostic"
                ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Diagnostic Report
          </button>
          <button
            onClick={() => {
              setDocType("discharge");
              setActiveTab("patient");
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${
              docType === "discharge"
                ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Discharge Summary (
            {docType === "discharge" ? totalPages : 3 + data.customPages.length}{" "}
            Pages)
          </button>
          <button
            onClick={() => {
              setDocType("fitness");
              setActiveTab("patient");
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${
              docType === "fitness"
                ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Fitness Certificate
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={savePatientDetails}
            disabled={isSavingPatient}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-lg border border-sky-400 disabled:opacity-50 transition-all cursor-pointer"
          >
            <span>{isSavingPatient ? "Saving..." : "Save Details"}</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={openPDFModal}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-5 py-2.5 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-lg shadow-emerald-500/10 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isGenerating ? "Building PDF..." : "Generate PDF"}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <AppSidebar
          workspace={workspace}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          onOpenEditor={() => setWorkspace("editor")}
          onOpenPatients={openPatientManagement}
        />

        {workspace === "patients" ? (
          <PatientManagement
            patients={patients}
            search={patientSearch}
            isLoading={isLoadingPatients}
            deletingPatientId={deletingPatientId}
            onSearchChange={setPatientSearch}
            onRefresh={() => void loadPatients()}
            onCreatePatient={() => {
              setEditingPatientId(null);
              setWorkspace("editor");
              setActiveTab("patient");
            }}
            onOpenPatient={(patientId) => void loadPatientIntoEditor(patientId)}
            onDeletePatient={(patientId) => void deletePatient(patientId)}
          />
        ) : (
          /* Workspace Panel Split */
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Form Settings Panel */}
        <div className="w-full lg:w-5/12 flex flex-col border-r border-slate-800 bg-slate-900/50 overflow-hidden min-h-0">
          {/* Settings Tabs */}
          <div className="flex flex-shrink-0 border-b border-slate-800 bg-slate-950 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("hospital")}
              className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "hospital"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Hospital Details
            </button>
            <button
              onClick={() => setActiveTab("patient")}
              className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "patient"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Patient Info
            </button>

            {docType === "diagnostic" && (
              <button
                onClick={() => setActiveTab("findings")}
                className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "findings"
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Findings & Study
              </button>
            )}

            {docType === "fitness" && (
              <button
                onClick={() => setActiveTab("findings")}
                className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "findings"
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Certificate Details
              </button>
            )}

            {docType === "discharge" && (
              <>
                <button
                  onClick={() => setActiveTab("details")}
                  className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === "details"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Clinical Details
                </button>
                <button
                  onClick={() => setActiveTab("treatment")}
                  className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === "treatment"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Stay & Treatment
                </button>
                <button
                  onClick={() => setActiveTab("meds")}
                  className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === "meds"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Medications
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab("footer")}
              className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "footer"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Logo & Watermark
            </button>
          </div>

          {/* Form Settings Content */}
          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
            {activeTab === "hospital" && (
              <div className="space-y-6">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      Hospital Information
                    </h4>
                    <button
                      onClick={clearHospitalFields}
                      className="text-[10px] font-semibold px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded border border-red-500/50"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Hospital Name
                      </label>
                      <input
                        type="text"
                        value={data.hospitalName}
                        onChange={(e) =>
                          handleInputChange("hospitalName", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Legal / Sub Name
                      </label>
                      <input
                        type="text"
                        value={data.hospitalSub}
                        onChange={(e) =>
                          handleInputChange("hospitalSub", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        value={data.hospitalAddress}
                        onChange={(e) =>
                          handleInputChange("hospitalAddress", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        CIN
                      </label>
                      <input
                        type="text"
                        value={data.cin}
                        onChange={(e) =>
                          handleInputChange("cin", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Email
                      </label>
                      <input
                        type="text"
                        value={data.hospitalEmail}
                        onChange={(e) =>
                          handleInputChange("hospitalEmail", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={data.hospitalPhone}
                        onChange={(e) =>
                          handleInputChange("hospitalPhone", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Website
                      </label>
                      <input
                        type="text"
                        value={data.hospitalWebsite}
                        onChange={(e) =>
                          handleInputChange("hospitalWebsite", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Emergency Helpline
                      </label>
                      <input
                        type="text"
                        value={data.hospitalEmergency}
                        onChange={(e) =>
                          handleInputChange("hospitalEmergency", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Header Settings
                  </h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Hospital Tagline (under logo)
                    </label>
                    <input
                      type="text"
                      value={data.hospitalTagline}
                      onChange={(e) =>
                        handleInputChange("hospitalTagline", e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. Super Speciality Hospital"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Footer Settings
                  </h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Discharge Summary Footer Note
                    </label>
                    <textarea
                      value={data.dischargeFooterNote}
                      onChange={(e) =>
                        handleInputChange("dischargeFooterNote", e.target.value)
                      }
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Discharge Footer Brand Name
                      </label>
                      <input
                        type="text"
                        value={data.dischargeFooterBrand}
                        onChange={(e) =>
                          handleInputChange(
                            "dischargeFooterBrand",
                            e.target.value,
                          )
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Fitness Certificate Footer Line
                      </label>
                      <input
                        type="text"
                        value={data.fitnessFooterText}
                        onChange={(e) =>
                          handleInputChange("fitnessFooterText", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Radiology Stamp Label
                      </label>
                      <input
                        type="text"
                        value={data.radiologyStampLabel}
                        onChange={(e) =>
                          handleInputChange(
                            "radiologyStampLabel",
                            e.target.value,
                          )
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Radiology Stamp Subtext
                      </label>
                      <input
                        type="text"
                        value={data.radiologyStampSubtext}
                        onChange={(e) =>
                          handleInputChange(
                            "radiologyStampSubtext",
                            e.target.value,
                          )
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {renderLogoWatermarkSettings()}
              </div>
            )}

            {activeTab === "patient" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={data.patientName}
                      onChange={(e) =>
                        handleInputChange("patientName", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Date of Birth (DD/MM/YYYY)
                    </label>
                    <input
                      type="text"
                      value={data.dob}
                      onChange={(e) => handleInputChange("dob", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      placeholder="25/03/1996"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Age / Sex (Auto-calculated)
                    </label>
                    <div className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-400 font-semibold flex items-center">
                      {calculateAge(data.dob, data.admitDate)} Year(s) /{" "}
                      {data.ageSex.split("/")[1]?.trim() || "Male"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Gender
                    </label>
                    <select
                      value={data.ageSex.split("/")[1]?.trim() || "Male"}
                      onChange={(e) =>
                        handleInputChange(
                          "ageSex",
                          `${calculateAge(data.dob, data.admitDate)} Year(s)/${e.target.value}`,
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      UHID
                    </label>
                    <input
                      type="text"
                      value={data.uhid}
                      onChange={(e) =>
                        handleInputChange("uhid", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      IP No / OP No
                    </label>
                    <input
                      type="text"
                      value={data.ipNo}
                      onChange={(e) =>
                        handleInputChange("ipNo", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  {docType === "diagnostic" && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Order Date
                        </label>
                        <input
                          type="text"
                          value={data.orderDate}
                          onChange={(e) =>
                            handleInputChange("orderDate", e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Report Date
                        </label>
                        <input
                          type="text"
                          value={data.reportDate}
                          onChange={(e) =>
                            handleInputChange("reportDate", e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Admit Date
                    </label>
                    <input
                      type="text"
                      value={data.admitDate}
                      onChange={(e) =>
                        handleInputChange("admitDate", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Discharge Date
                    </label>
                    <input
                      type="text"
                      value={data.dischargeDateTime}
                      onChange={(e) =>
                        handleInputChange("dischargeDateTime", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Doctor Name
                    </label>
                    <input
                      type="text"
                      value={data.refDoctor}
                      onChange={(e) =>
                        handleInputChange("refDoctor", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Aadhar Card
                    </label>
                    <input
                      type="text"
                      value={data.aadharCard}
                      onChange={(e) =>
                        handleInputChange("aadharCard", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Mobile
                    </label>
                    <input
                      type="text"
                      value={data.mobile}
                      onChange={(e) =>
                        handleInputChange("mobile", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Facility
                    </label>
                    <input
                      type="text"
                      value={data.facility}
                      onChange={(e) =>
                        handleInputChange("facility", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Ordering Ward
                    </label>
                    <input
                      type="text"
                      value={data.orderingBedWard}
                      onChange={(e) =>
                        handleInputChange("orderingBedWard", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Current Ward
                    </label>
                    <input
                      type="text"
                      value={data.currentBedWard}
                      onChange={(e) =>
                        handleInputChange("currentBedWard", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Company / Insurance Name
                    </label>
                    <input
                      type="text"
                      value={data.companyName}
                      onChange={(e) =>
                        handleInputChange("companyName", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Address
                    </label>
                    <textarea
                      value={data.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "findings" && docType === "fitness" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Certificate Header Title
                  </label>
                  <input
                    type="text"
                    value={data.fitTitle}
                    onChange={(e) =>
                      handleInputChange("fitTitle", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none font-bold"
                    placeholder="e.g. FIT TO TRAVEL CERTIFICATE"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Fitness Status
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInputChange("fitStatus", "fit")}
                      className={`flex-1 py-2 text-xs font-bold rounded ${
                        data.fitStatus === "fit"
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-950 text-slate-400 border border-slate-800"
                      }`}
                    >
                      FIT
                    </button>
                    <button
                      onClick={() => handleInputChange("fitStatus", "unfit")}
                      className={`flex-1 py-2 text-xs font-bold rounded ${
                        data.fitStatus === "unfit"
                          ? "bg-red-500 text-slate-950"
                          : "bg-slate-950 text-slate-400 border border-slate-800"
                      }`}
                    >
                      UNFIT
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Fitness Statement Text
                  </label>
                  <textarea
                    value={data.fitStatement}
                    onChange={(e) =>
                      handleInputChange("fitStatement", e.target.value)
                    }
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                    placeholder="This is to certify that I have conducted..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Clinical Remarks / Recommendation
                  </label>
                  <textarea
                    value={data.fitRemarks}
                    onChange={(e) =>
                      handleInputChange("fitRemarks", e.target.value)
                    }
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                    placeholder="Standard safety precautions should be followed..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Certificate Footer Text
                  </label>
                  <input
                    type="text"
                    value={data.fitnessFooterText}
                    onChange={(e) =>
                      handleInputChange("fitnessFooterText", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    placeholder="e.g. Orchid Medical Centre Pvt. Ltd. • emergency helpline: 911-7100-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Date of Issue
                    </label>
                    <input
                      type="date"
                      value={dateForInput(data.fitDate)}
                      onChange={(e) =>
                        handleInputChange(
                          "fitDate",
                          dateForCertificate(e.target.value),
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Designated Signatory
                    </label>
                    <input
                      type="text"
                      value={data.fitSignatory}
                      onChange={(e) =>
                        handleInputChange("fitSignatory", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "findings" && docType === "diagnostic" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Report Study Title
                  </label>
                  <input
                    type="text"
                    value={data.reportTitle}
                    onChange={(e) =>
                      handleInputChange("reportTitle", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Clinical Indications
                  </label>
                  <input
                    type="text"
                    value={data.clinicalProfile}
                    onChange={(e) =>
                      handleInputChange("clinicalProfile", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Findings List
                    </h4>
                    <button
                      onClick={addFinding}
                      className="text-xs bg-slate-800 text-emerald-400 hover:bg-slate-700 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Finding
                    </button>
                  </div>

                  <div className="space-y-4">
                    {data.findingsList.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-955 p-3.5 rounded-lg border border-slate-800 space-y-2.5 relative"
                      >
                        <div className="flex justify-between items-center gap-2">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) =>
                              handleFindingChange(
                                item.id,
                                "label",
                                e.target.value.toUpperCase(),
                              )
                            }
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-emerald-400 font-bold focus:outline-none w-2/3"
                            placeholder="FINDING LABEL"
                          />
                          {!item.isDefault && (
                            <button
                              onClick={() => removeFinding(item.id)}
                              className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                              title="Delete finding"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <textarea
                          value={item.value}
                          onChange={(e) =>
                            handleFindingChange(
                              item.id,
                              "value",
                              e.target.value,
                            )
                          }
                          rows={3}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none resize-none"
                          placeholder="Enter details..."
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Impression Heading
                  </label>
                  <input
                    type="text"
                    value={data.impressionHeading}
                    onChange={(e) =>
                      handleInputChange("impressionHeading", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    placeholder="e.g. IMPRESSION: PLAIN CT OF KUB REVEALS:-"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    IMPRESSION
                  </label>
                  <textarea
                    value={data.impression}
                    onChange={(e) =>
                      handleInputChange("impression", e.target.value)
                    }
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    SUGGESTION
                  </label>
                  <input
                    type="text"
                    value={data.suggestion}
                    onChange={(e) =>
                      handleInputChange("suggestion", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Report Saved By
                  </label>
                  <input
                    type="text"
                    value={data.reportSavedBy}
                    onChange={(e) =>
                      handleInputChange("reportSavedBy", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    placeholder="Name (date and time)"
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Print Date
                    </label>
                    <input
                      type="text"
                      value={data.printDateTime}
                      onChange={(e) =>
                        handleInputChange("printDateTime", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                      placeholder="DD/MM/YYYY HH:MM:SS"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "details" && docType === "discharge" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Primary Consultant
                  </label>
                  <textarea
                    value={data.primaryConsultant}
                    onChange={(e) =>
                      handleInputChange("primaryConsultant", e.target.value)
                    }
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Cross Consultants
                  </label>
                  <input
                    type="text"
                    value={data.crossConsultants}
                    onChange={(e) =>
                      handleInputChange("crossConsultants", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Final/Provisional Diagnosis
                  </label>
                  <textarea
                    value={data.finalDiagnosis}
                    onChange={(e) =>
                      handleInputChange("finalDiagnosis", e.target.value)
                    }
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Result (Discharge)
                    </label>
                    <input
                      type="text"
                      value={data.dischargeResult}
                      onChange={(e) =>
                        handleInputChange("dischargeResult", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Nature of Treatment
                    </label>
                    <input
                      type="text"
                      value={data.natureOfTreatment}
                      onChange={(e) =>
                        handleInputChange("natureOfTreatment", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Follow-Up Visit Date
                    </label>
                    <input
                      type="date"
                      value={dateForInput(data.dischargeFollowUpVisitDate)}
                      onChange={(e) =>
                        handleInputChange(
                          "dischargeFollowUpVisitDate",
                          dateForCertificate(e.target.value),
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Prepared By
                    </label>
                    <input
                      type="text"
                      value={data.preparedBy}
                      onChange={(e) =>
                        handleInputChange("preparedBy", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Verified By
                    </label>
                    <input
                      type="text"
                      value={data.verifiedBy}
                      onChange={(e) =>
                        handleInputChange("verifiedBy", e.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                    History & Admission Indications
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Reason for Admission
                      </label>
                      <textarea
                        value={data.reasonForAdmission}
                        onChange={(e) =>
                          handleInputChange(
                            "reasonForAdmission",
                            e.target.value,
                          )
                        }
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        HOPI
                      </label>
                      <textarea
                        value={data.hopi}
                        onChange={(e) =>
                          handleInputChange("hopi", e.target.value)
                        }
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Past History
                      </label>
                      <textarea
                        value={data.pastHistory}
                        onChange={(e) =>
                          handleInputChange("pastHistory", e.target.value)
                        }
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Family History
                      </label>
                      <input
                        type="text"
                        value={data.familyHistory}
                        onChange={(e) =>
                          handleInputChange("familyHistory", e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Allergy
                      </label>
                      <input
                        type="text"
                        value={data.allergy}
                        onChange={(e) =>
                          handleInputChange("allergy", e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                    O/E (At Admission) Vitals
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                        Pulse
                      </label>
                      <input
                        type="text"
                        value={data.pulse}
                        onChange={(e) =>
                          handleInputChange("pulse", e.target.value)
                        }
                        className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                        BP
                      </label>
                      <input
                        type="text"
                        value={data.bp}
                        onChange={(e) =>
                          handleInputChange("bp", e.target.value)
                        }
                        className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                        Temp
                      </label>
                      <input
                        type="text"
                        value={data.temp}
                        onChange={(e) =>
                          handleInputChange("temp", e.target.value)
                        }
                        className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                        Spo2
                      </label>
                      <input
                        type="text"
                        value={data.spo2}
                        onChange={(e) =>
                          handleInputChange("spo2", e.target.value)
                        }
                        className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "treatment" && docType === "discharge" && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-400">
                      Treatment Given List
                    </label>
                    <button
                      onClick={addTreatment}
                      className="text-xs bg-slate-800 text-emerald-400 hover:bg-slate-700 px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add item
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {data.treatmentGiven.map((t, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="text-xs text-slate-500 font-bold">
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          value={t}
                          onChange={(e) =>
                            handleTreatmentChange(idx, e.target.value)
                          }
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none"
                        />
                        <button
                          onClick={() => removeTreatment(idx)}
                          className="text-red-400 hover:text-red-300 p-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Investigations
                  </label>
                  <input
                    type="text"
                    value={data.investigations}
                    onChange={(e) =>
                      handleInputChange("investigations", e.target.value)
                    }
                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Course During Stay (Summary)
                  </label>
                  <textarea
                    value={data.courseDuringStay}
                    onChange={(e) =>
                      handleInputChange("courseDuringStay", e.target.value)
                    }
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === "meds" && docType === "discharge" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold text-slate-400">
                    Discharge Medications
                  </label>
                  <button
                    onClick={addMedication}
                    className="text-xs bg-slate-800 text-emerald-400 hover:bg-slate-700 px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Med
                  </button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {data.medications.map((m, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-955 p-3 rounded-lg border border-slate-800 space-y-2 relative"
                    >
                      <button
                        onClick={() => removeMedication(idx)}
                        className="absolute right-2 top-2 text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">
                          Medicine Name
                        </label>
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) =>
                            handleMedicationChange(idx, "name", e.target.value)
                          }
                          className="w-11/12 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">
                          Instructions
                        </label>
                        <input
                          type="text"
                          value={m.instruction}
                          onChange={(e) =>
                            handleMedicationChange(
                              idx,
                              "instruction",
                              e.target.value,
                            )
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "footer" && (
              <div className="space-y-6">
                {renderLogoWatermarkSettings()}
                {(docType === "diagnostic" || docType === "discharge" || docType === "fitness") &&
                  renderDischargeSummaryStamps()}
              </div>
            )}
          </div>
        </div>

        {/* Right Preview Panel (A4 layout sheets with watermarks overlay) */}
        <div className="w-full lg:w-7/12 bg-slate-955 p-6 overflow-y-auto space-y-8 flex flex-col items-center">
          {docType === "fitness" ? (
            /* Fitness Certificate Preview (1 Page) */
            <div className="w-full max-w-[210mm] shadow-2xl rounded-sm relative">
              <div className="text-center text-xs text-slate-400 mb-2">
                A4 Fitness Certificate
              </div>
              <div
                ref={fitSheetRef}
                className="bg-white text-black p-[18mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                style={reportPageStyle("11.5px", "1.5")}
              >
                {renderWatermark(1)}
                {renderDocumentStamps("fitness", 1)}

                <div className="relative z-10">
                  {/* Header */}
                  <div
                    className="flex justify-between items-start border-b pb-3 mb-5"
                    style={{ borderColor: data.reportTheme.border }}
                  >
                    <div
                      className="relative flex items-center min-w-0 flex-1"
                      style={{ color: data.reportTheme.text }}
                    >
                      {renderHeaderBrand(false)}
                    </div>
                    <div
                      className="text-[9px] text-right space-y-0.5"
                      style={{ color: data.reportTheme.muted }}
                    >
                      <p
                        className="font-bold"
                        style={{ color: data.reportTheme.heading }}
                      >
                        {data.hospitalSub}
                      </p>
                      <p>{data.hospitalAddress}</p>
                      {data.cin && <p>CIN : {data.cin}</p>}
                      {(data.hospitalEmail || data.hospitalPhone) && (
                        <p>
                          {data.hospitalEmail && `E: ${data.hospitalEmail}`}
                          {data.hospitalEmail && data.hospitalPhone && " | "}
                          {data.hospitalPhone && `T: ${data.hospitalPhone}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex justify-between items-center px-3 py-1.5 mb-8 font-bold"
                    style={reportSectionStyle()}
                  >
                    <span>FITNESS / MEDICAL CERTIFICATE</span>
                    <span className="text-[9px] text-gray-500">
                      (OFFICIAL RECORD)
                    </span>
                  </div>

                  {/* Document Title */}
                  <div className="text-center mb-8">
                    <h3 className="text-[14px] font-black text-gray-900 underline tracking-wide uppercase">
                      {data.fitTitle}
                    </h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">
                      TO WHOMSOEVER IT MAY CONCERN
                    </p>
                  </div>

                  {/* Patient Details Grid (Simplified) */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-gray-200 rounded-sm p-4 mb-6 bg-gray-50/50">
                    <div>
                      <span className="font-semibold text-gray-700">
                        Patient Name:
                      </span>{" "}
                      <span className="font-bold text-gray-900">
                        {data.patientName}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">UHID:</span>{" "}
                      <span className="font-bold text-gray-900">
                        {data.uhid}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">
                        Age / Sex:
                      </span>{" "}
                      <span className="font-bold text-gray-900">
                        {calculateAge(data.dob, data.admitDate)} Year(s) /{" "}
                        {data.ageSex.split("/")[1]?.trim() || "Male"}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">
                        Mobile:
                      </span>{" "}
                      <span className="font-bold text-gray-900">
                        {data.mobile}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold text-gray-700">
                        Address:
                      </span>{" "}
                      <span className="font-bold text-gray-900 leading-normal">
                        {data.address}
                      </span>
                    </div>
                  </div>

                  {/* Certificate Statement */}
                  <div className="space-y-4 text-justify leading-relaxed text-[12px] text-gray-800">
                    <p>
                      This is to certify that I have conducted a clinical
                      examination and medical evaluation of
                      <strong> {data.patientName}</strong>, aged{" "}
                      <strong>{calculateAge(data.dob, data.admitDate)} Year(s)</strong>, who has
                      been registered under UHID
                      <strong> {data.uhid}</strong>.
                    </p>
                    <p>
                      Based on my assessment, clinical history, and physical
                      measurements, I hereby declare that the patient is
                      <span
                        className={`inline-block mx-1.5 px-2 py-0.5 rounded font-black text-[11px] ${
                          data.fitStatus === "fit"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {data.fitStatus === "fit" ? "FIT" : "UNFIT"}
                      </span>
                      {data.fitStatement}
                    </p>
                    {data.fitRemarks && (
                      <p className="border-l-4 border-gray-300 pl-3 italic text-gray-600">
                        <strong>Remarks:</strong> {data.fitRemarks}
                      </p>
                    )}
                  </div>
                </div>

                {/* Signatures & Footer */}
                <div className="relative z-10">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-gray-500">
                        Date of Issue:
                      </p>
                      <p className="text-sm font-bold text-gray-800">
                        {data.fitDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="w-48 border-b border-gray-400 mb-1.5"></div>
                      <p className="text-[11px] font-bold text-gray-800">
                        {data.fitSignatory}
                      </p>
                      <p className="text-[9px] text-gray-400">
                        Authorized Signatory
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-300 mt-5 pt-4">
                    <div className="text-center text-[8px] text-gray-400">
                      {data.fitnessFooterText}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : docType === "diagnostic" ? (
            /* Diagnostic Report Preview (1 Page) */
            <div className="w-full max-w-[210mm] shadow-2xl rounded-sm relative">
              <div className="text-center text-xs text-slate-400 mb-2">
                A4 Diagnostic Sheet
              </div>
              <div
                ref={diagSheetRef}
                className="bg-white text-black p-[15mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                style={reportPageStyle("11px", "1.4")}
              >
                {renderWatermark(1)}
                {renderDocumentStamps("diagnostic", 1)}

                <div className="relative z-10">
                  {/* Header */}
                  <div
                    className="flex justify-between items-start border-b pb-3 mb-4"
                    style={{ borderColor: data.reportTheme.border }}
                  >
                    <div
                      className="relative flex items-center min-w-0 flex-1"
                      style={{ color: data.reportTheme.text }}
                    >
                      {renderHeaderBrand(false)}
                    </div>
                    <div
                      className="text-[9px] text-right space-y-0.5"
                      style={{ color: data.reportTheme.muted }}
                    >
                      <p
                        className="font-bold"
                        style={{ color: data.reportTheme.heading }}
                      >
                        {data.hospitalSub}
                      </p>
                      <p>{data.hospitalAddress}</p>
                      {data.cin && <p>CIN : {data.cin}</p>}
                      {(data.hospitalEmail || data.hospitalPhone) && (
                        <p>
                          {data.hospitalEmail && `E: ${data.hospitalEmail}`}
                          {data.hospitalEmail && data.hospitalPhone && " | "}
                          {data.hospitalPhone && `T: ${data.hospitalPhone}`}
                        </p>
                      )}
                      {data.hospitalWebsite && (
                        <p>W: {data.hospitalWebsite}</p>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex justify-between items-center px-3 py-1 mb-4 font-bold"
                    style={reportSectionStyle()}
                  >
                    <span>DIAGNOSTIC REPORTS</span>
                    <span className="text-[9px] text-gray-500">
                      (FOR DIAGNOSTIC REPORTS ONLY)
                    </span>
                  </div>

                  {/* Patient Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-gray-300 rounded-sm p-3 mb-4 text-[10px]">
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Patient Name
                      </span>
                      <span className="col-span-2 font-bold break-words">
                        : {data.patientName}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">IP No</span>
                      <span className="col-span-2 font-bold">
                        : {data.ipNo}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Age/Sex
                      </span>
                      <span className="col-span-2 font-bold">
                        : {calculateAge(data.dob, data.admitDate)} Year(s) /{" "}
                        {data.ageSex.split("/")[1]?.trim() || "Male"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Order Date
                      </span>
                      <span className="col-span-2 font-bold">
                        : {data.orderDate}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">UHID</span>
                      <span className="col-span-2 font-bold">
                        : {data.uhid}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Report Date
                      </span>
                      <span className="col-span-2 font-bold">
                        : {data.reportDate}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Ref. Doctor
                      </span>
                      <span className="col-span-2 font-bold break-words">
                        : {data.refDoctor}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Facility
                      </span>
                      <span className="col-span-2 font-bold">
                        : {data.facility}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Aadhar Card
                      </span>
                      <span className="col-span-2 font-bold">
                        : {data.aadharCard}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">DOB</span>
                      <span className="col-span-2 font-bold">: {data.dob}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Address
                      </span>
                      <span className="col-span-2 font-bold break-words leading-tight">
                        : {data.address}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Mobile
                      </span>
                      <span className="col-span-2 font-bold">
                        : {data.mobile}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Company Name
                      </span>
                      <span className="col-span-2 font-bold break-words">
                        : {data.companyName}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Ordering Bed/Ward
                      </span>
                      <span className="col-span-2 font-bold break-words">
                        : {data.orderingBedWard}
                      </span>
                    </div>

                    <div></div>
                    <div className="grid grid-cols-3 gap-x-2 items-start">
                      <span className="font-semibold text-gray-700">
                        Current Bed/Ward
                      </span>
                      <span className="col-span-2 font-bold break-words">
                        : {data.currentBedWard}
                      </span>
                    </div>
                  </div>

                  {/* Title & Findings */}
                  <div className="mb-4">
                    <h4 className="font-bold underline text-center uppercase mb-3">
                      {data.reportTitle}
                    </h4>
                    <p className="mb-3 font-semibold">
                      Clinical profile:{" "}
                      <span className="font-normal">
                        {data.clinicalProfile}
                      </span>
                    </p>

                    <div className="space-y-3 mt-4 text-justify">
                      <h5 className="font-bold underline">Findings:</h5>
                      {data.findingsList.map(
                        (item) =>
                          item.value && (
                            <div key={item.id}>
                              <span className="font-bold">{item.label} : </span>
                              <span>{item.value}</span>
                            </div>
                          ),
                      )}
                    </div>

                    {data.impression && (
                      <div className="mt-5">
                        <p className="font-bold underline">
                          {data.impressionHeading}
                        </p>
                        <p className="font-bold pl-4 mt-1 uppercase">
                          - {data.impression}
                        </p>
                      </div>
                    )}

                    {data.suggestion && (
                      <div className="mt-5">
                        <p className="font-bold underline">SUGGESTION:</p>
                        <p className="pl-4 mt-1">- {data.suggestion}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="relative z-10">
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] text-gray-500">
                      Report Saved By: {data.reportSavedBy}
                    </p>
                    <div className="text-right">
                      <div className="w-28 border-b border-gray-400 mb-1"></div>
                      <p className="text-[9px] font-bold text-gray-700">
                        Authorized Signatory
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-300 mt-5 pt-4">
                    <div className="flex justify-between text-[8px] text-gray-400">
                      {data.printDateTime.trim() && (
                        <p>Print Date: {data.printDateTime}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Discharge Summary Preview (3+ Pages) */
            <div className="space-y-8 w-full max-w-[210mm]">
              {/* PAGE 1 */}
              <div className="shadow-2xl rounded-sm relative">
                <div className="text-center text-xs text-slate-400 mb-2">
                  A4 Discharge Summary
                </div>
                <div
                  ref={page1Ref}
                  className="bg-white text-black p-[12mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                  style={reportPageStyle("10.5px", "1.35")}
                >
                  {renderWatermark(1)}
                  {renderDocumentStamps("discharge", 1)}

                  <div className="relative z-10">
                    {/* Header */}
                    <div
                      className="flex justify-between items-start border-b pb-2 mb-3"
                      style={{ borderColor: data.reportTheme.border }}
                    >
                      <div
                        className="relative flex items-center min-w-0 flex-1"
                        style={{ color: data.reportTheme.text }}
                      >
                        {renderHeaderBrand(true)}
                      </div>
                      <div
                        className="text-[8px] text-right leading-tight"
                        style={{ color: data.reportTheme.muted }}
                      >
                        <p
                          className="font-bold"
                          style={{ color: data.reportTheme.heading }}
                        >
                          {data.hospitalSub}
                        </p>
                        <p>{data.hospitalAddress}</p>
                        {(data.hospitalEmail || data.hospitalPhone) && (
                          <p>
                            {data.hospitalEmail && `E: ${data.hospitalEmail}`}
                            {data.hospitalEmail && data.hospitalPhone && " | "}
                            {data.hospitalPhone && `T: ${data.hospitalPhone}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex justify-between items-center px-2.5 py-0.5 rounded-sm mb-3 font-bold text-[11px]"
                      style={reportSectionStyle()}
                    >
                      <span>DISCHARGE SUMMARY</span>
                    </div>

                    {/* Patient detail block */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-gray-350 p-2.5 rounded-sm mb-4 text-[9.5px]">
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Patient Name
                        </span>
                        <span className="col-span-2 font-bold break-words">
                          : {data.patientName}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          IP No
                        </span>
                        <span className="col-span-2 font-bold">
                          : {data.ipNo}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Age/Sex
                        </span>
                        <span className="col-span-2 font-bold">
                          : {calculateAge(data.dob, data.admitDate)} Year(s) /{" "}
                          {data.ageSex.split("/")[1]?.trim() || "Male"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Admit Date
                        </span>
                        <span className="col-span-2 font-bold">
                          : {data.admitDate}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Discharge Date
                        </span>
                        <span className="col-span-2 font-bold">
                          : {data.dischargeDateTime}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          UHID
                        </span>
                        <span className="col-span-2 font-bold">
                          : {data.uhid}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Doctor Name
                        </span>
                        <span className="col-span-2 font-bold break-words">
                          : {data.refDoctor}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Facility
                        </span>
                        <span className="col-span-2 font-bold">
                          : {data.facility}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Aadhar Card
                        </span>
                        <span className="col-span-2 font-bold">
                          : {data.aadharCard}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">DOB</span>
                        <span className="col-span-2 font-bold">
                          : {data.dob}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Address
                        </span>
                        <span className="col-span-2 font-bold break-words leading-tight">
                          : {data.address}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Mobile
                        </span>
                        <span className="col-span-2 font-bold">
                          : {data.mobile}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Company Name
                        </span>
                        <span className="col-span-2 font-bold break-words">
                          : {data.companyName}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Ordering Bed/Ward
                        </span>
                        <span className="col-span-2 font-bold break-words">
                          : {data.orderingBedWard}
                        </span>
                      </div>

                      <div></div>
                      <div className="grid grid-cols-3 gap-x-2 items-start">
                        <span className="font-semibold text-gray-700">
                          Current Bed/Ward
                        </span>
                        <span className="col-span-2 font-bold break-words">
                          : {data.currentBedWard}
                        </span>
                      </div>
                    </div>

                    {/* Primary & Cross Consultants */}
                    <div className="space-y-2 mb-3">
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Primary Consultant
                        </p>
                        <p className="text-justify font-medium leading-relaxed mt-0.5">
                          {data.primaryConsultant}
                        </p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Cross Consultants
                        </p>
                        <p className="mt-0.5">{data.crossConsultants}</p>
                      </div>
                    </div>

                    {/* Diagnosis & clinical details */}
                    <div className="space-y-2.5">
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Final / Provisional Diagnosis
                        </p>
                        <p className="font-bold text-gray-900 mt-0.5">
                          {data.finalDiagnosis}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-bold underline text-gray-800">
                            Result
                          </p>
                          <p className="mt-0.5">{data.dischargeResult}</p>
                        </div>
                        <div>
                          <p className="font-bold underline text-gray-800">
                            Nature of Treatment
                          </p>
                          <p className="mt-0.5">{data.natureOfTreatment}</p>
                        </div>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Reason for admission
                        </p>
                        <p className="mt-0.5">{data.reasonForAdmission}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">
                          HOPI
                        </p>
                        <p className="mt-0.5">{data.hopi}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Past History
                        </p>
                        <p className="mt-0.5">{data.pastHistory}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Family History
                        </p>
                        <p className="mt-0.5">{data.familyHistory}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Allergy
                        </p>
                        <p className="mt-0.5">{data.allergy}</p>
                      </div>
                    </div>

                    {/* Vitals Table */}
                    <div className="mt-3">
                      <p className="font-bold underline text-gray-800 mb-1.5">
                        O/E (At admission)
                      </p>
                      <div className="grid grid-cols-2 border border-gray-300 rounded-sm text-[9.5px]">
                        <div className="p-1.5 border-r border-b border-gray-300 grid grid-cols-2">
                          <span className="text-gray-500">Pulse:</span>
                          <span className="font-bold">{data.pulse}</span>
                        </div>
                        <div className="p-1.5 border-b border-gray-300 grid grid-cols-2">
                          <span className="text-gray-500">Pallor:</span>
                          <span className="font-bold">{data.pallor}</span>
                        </div>
                        <div className="p-1.5 border-r border-b border-gray-300 grid grid-cols-2">
                          <span className="text-gray-500">Blood Pressure:</span>
                          <span className="font-bold">{data.bp}</span>
                        </div>
                        <div className="p-1.5 border-b border-gray-300 grid grid-cols-2">
                          <span className="text-gray-500">Cyanosis:</span>
                          <span className="font-bold">{data.cyanosis}</span>
                        </div>
                        <div className="p-1.5 border-r border-gray-300 grid grid-cols-2">
                          <span className="text-gray-500">Temp:</span>
                          <span className="font-bold">{data.temp}</span>
                        </div>
                        <div className="p-1.5 grid grid-cols-2">
                          <span className="text-gray-500">Edema:</span>
                          <span className="font-bold">{data.edema}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Note Footer */}
                  <div className="border-t border-gray-300 pt-2 text-[7.5px] text-gray-400 text-center leading-tight relative z-10">
                    <p className="font-semibold text-gray-500">
                      {data.dischargeFooterNote}
                    </p>
                    <div className="flex justify-between mt-1">
                      <span>{data.dischargeFooterBrand}</span>
                      <span className="font-bold">1/{totalPages}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAGE 2 */}
              <div className="shadow-2xl rounded-sm relative">
                <div className="text-center text-xs text-slate-400 mb-2">
                  A4 Discharge Summary
                </div>
                <div
                  ref={page2Ref}
                  className="bg-white text-black p-[12mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                  style={reportPageStyle("10.5px", "1.35")}
                >
                  {renderWatermark(2)}
                  {renderDocumentStamps("discharge", 2)}

                  <div className="relative z-10">
                    <div className="grid grid-cols-3 border border-gray-300 rounded p-2 mb-3 text-[9px]">
                      <div>
                        <span className="text-gray-500">Patient Name:</span>{" "}
                        <span className="font-bold">{data.patientName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">UHID:</span>{" "}
                        <span className="font-bold">{data.uhid}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">IP No:</span>{" "}
                        <span className="font-bold">{data.ipNo}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Treatment Given:
                        </p>
                        <div className="grid grid-cols-3 gap-y-1.5 mt-1 font-semibold text-gray-700">
                          {data.treatmentGiven.map((t, i) => (
                            <p key={i}>
                              {i + 1}. {t}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">
                          Investigations:
                        </p>
                        <p className="mt-0.5 text-gray-700">
                          {data.investigations}
                        </p>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">
                          COURSE DURING STAY (SUMMARY)
                        </p>
                        <p className="mt-0.5 text-justify leading-relaxed">
                          {data.courseDuringStay}
                        </p>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">
                          Procedure done:
                        </p>
                        <p className="mt-0.5 text-gray-700">
                          {data.procedureDone}
                        </p>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">
                          When and how to obtain urgent care:
                        </p>
                        <p className="mt-0.5 text-gray-700 leading-normal">
                          {data.urgentCareInfo}
                        </p>
                      </div>

                      {/* Discharge Medications list */}
                      <div>
                        <p className="font-bold underline text-gray-800 mb-1">
                          DISCHARGE MEDICATION
                        </p>
                        <div className="border border-gray-300 rounded-sm overflow-hidden">
                          <table className="w-full text-left text-[9.5px]">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-300 font-bold text-gray-700">
                                <th className="p-1.5 w-10">S.No.</th>
                                <th className="p-1.5">Medicine Name</th>
                                <th className="p-1.5">Instructions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.medications.map((m, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-gray-200"
                                >
                                  <td className="p-1.5 font-bold">{i + 1}</td>
                                  <td className="p-1.5 font-bold text-gray-800">
                                    {m.name}
                                  </td>
                                  <td className="p-1.5 text-gray-700">
                                    {m.instruction}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-bold underline text-gray-800">
                            Special needs:
                          </p>
                          <p className="mt-0.5">{data.specialNeeds}</p>
                        </div>
                        <div>
                          <p className="font-bold underline text-gray-800">
                            Follow up:
                          </p>
                          <p className="mt-0.5">{data.dischargeFollowUp}</p>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">
                          Condition on Discharge:
                        </p>
                        <p className="mt-0.5 font-bold text-emerald-700">
                          {data.conditionOnDischarge}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Signatures & Footer */}
                  <div className="relative z-10">
                    <div className="flex justify-between items-end mb-4 pt-4">
                      <div>
                        <div className="w-32 border-b border-gray-300 mb-1"></div>
                        <p className="text-[9px] font-bold text-gray-700">
                          Doctor Signature
                        </p>
                      </div>
                      <div className="text-center bg-gray-50 p-2 border border-gray-200 rounded text-[8px] max-w-[120px]">
                        <p className="font-bold">{data.radiologyStampLabel}</p>
                        <p className="text-gray-400">
                          {data.radiologyStampSubtext}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="w-32 border-b border-gray-300 mb-1"></div>
                        <p className="text-[9px] font-bold text-gray-700">
                          Consultant signature
                        </p>
                        <p className="text-[8px] text-gray-500">
                          {data.verifiedBy}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-gray-300 pt-2 text-[7.5px] text-gray-400 text-center leading-tight">
                      <p className="font-semibold text-gray-500">
                        {data.dischargeFooterNote}
                      </p>
                      <div className="flex justify-between mt-1">
                        <span>{data.dischargeFooterBrand}</span>
                        <span className="font-bold">2/{totalPages}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAGE 3 */}
              <div className="shadow-2xl rounded-sm relative">
                <div className="text-center text-xs text-slate-400 mb-2">
                  A4 Discharge Summary
                </div>
                <div
                  ref={page3Ref}
                  className="bg-white text-black p-[12mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                  style={reportPageStyle("10.5px", "1.35")}
                >
                  {renderWatermark(3)}
                  {renderDocumentStamps("discharge", 3)}

                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-gray-300 pb-2 mb-3">
                      <div className="relative min-w-0 flex-1">
                        {renderHeaderBrand(true)}
                      </div>
                      <div className="text-[8px] text-right text-gray-600 leading-tight">
                        <p className="font-bold text-gray-700">
                          {data.hospitalSub}
                        </p>
                        <p>{data.hospitalAddress}</p>
                      </div>
                    </div>

                    <div
                      className="flex justify-between items-center px-2.5 py-0.5 rounded-sm mb-4 font-bold text-[11px]"
                      style={reportSectionStyle()}
                    >
                      <span>DISCHARGE SUMMARY (FOLLOW-UP)</span>
                    </div>

                    {/* Patient info repetition block */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 border border-gray-350 p-2.5 rounded-sm mb-4 text-[9.5px]">
                      <div>
                        <span className="text-gray-500">Patient Name:</span>{" "}
                        <span className="font-bold">{data.patientName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">UHID:</span>{" "}
                        <span className="font-bold">{data.uhid}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Age/Sex:</span>{" "}
                        <span className="font-bold">{data.ageSex}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Admit Dt:</span>{" "}
                        <span className="font-bold">{data.admitDate}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="font-bold underline text-gray-800">
                          Primary Consultant Details:
                        </p>
                        <p className="mt-1 font-semibold leading-relaxed">
                          {data.primaryConsultant}
                        </p>
                      </div>

                      <div className="border border-gray-300 p-3 rounded-sm space-y-3 bg-gray-50 text-[10px]">
                        <p className="font-bold text-gray-800">
                          Acknowledgment & Received by (Patient / NOK):
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-gray-500">Received By:</span>
                            <div className="border-b border-gray-400 h-6 mt-1 font-bold">
                              {data.receivedBy || "___________________"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Date:</span>
                            <div className="border-b border-gray-400 h-6 mt-1 font-bold">
                              {data.receivedDate || "____/____/________"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Time:</span>
                            <div className="border-b border-gray-400 h-6 mt-1 font-bold">
                              {data.receivedTime || "____:____"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-emerald-55 border border-emerald-200 p-3 rounded-sm">
                          <p className="font-bold text-emerald-800">
                            Discharge Follow Up Visit Date:
                          </p>
                          <p className="text-lg font-black text-emerald-950 mt-1">
                            {data.dischargeFollowUpVisitDate}
                          </p>
                        </div>
                        <div className="border border-gray-300 p-3 rounded-sm text-[9.5px] space-y-1">
                          <p>
                            <span className="text-gray-500">Prepared By:</span>{" "}
                            <span className="font-bold text-gray-800">
                              {data.preparedBy}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500">Verified By:</span>{" "}
                            <span className="font-bold text-gray-800">
                              {data.verifiedBy}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Note Footer */}
                  <div className="border-t border-gray-300 pt-2 text-[7.5px] text-gray-400 text-center leading-tight relative z-10">
                    <p className="font-semibold text-gray-500">
                      {data.dischargeFooterNote}
                    </p>
                    <div className="flex justify-between mt-1">
                      <span>{data.dischargeFooterBrand}</span>
                      <span className="font-bold">3/{totalPages}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CUSTOM PAGES */}
              {data.customPages.map((cp, idx) => {
                const pageNum = idx + 4;
                return (
                  <div key={idx} className="shadow-2xl rounded-sm relative">
                    <div className="text-center text-xs text-slate-400 mb-2">
                      A4 Discharge Summary
                    </div>
                    <div
                      ref={(el) => {
                        customPagesRefs.current[idx] = el;
                      }}
                      className="bg-white text-black p-[12mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                      style={reportPageStyle("10.5px", "1.35")}
                    >
                      {renderWatermark(pageNum)}
                      {renderDocumentStamps("discharge", pageNum)}

                      <div className="relative z-10">
                        {/* Header */}
                        <div
                          className="flex justify-between items-start border-b pb-2 mb-3"
                          style={{ borderColor: data.reportTheme.border }}
                        >
                          <div className="relative min-w-0 flex-1">
                            {renderHeaderBrand(true)}
                          </div>
                          <div className="text-[8px] text-right text-gray-600 leading-tight">
                            <p className="font-bold text-gray-700">
                              {data.hospitalSub}
                            </p>
                            <p>{data.hospitalAddress}</p>
                          </div>
                        </div>

                        <div
                          className="flex justify-between items-center px-2.5 py-0.5 rounded-sm mb-4 font-bold text-[11px]"
                          style={reportSectionStyle()}
                        >
                          <span>
                            DISCHARGE SUMMARY (ADDITIONAL DOCUMENTATION)
                          </span>
                        </div>

                        <div className="whitespace-pre-wrap text-justify text-gray-800 leading-relaxed font-medium">
                          {cp}
                        </div>
                      </div>

                      {/* Note Footer */}
                      <div className="border-t border-gray-300 pt-2 text-[7.5px] text-gray-400 text-center leading-tight relative z-10">
                        <p className="font-semibold text-gray-500">
                          {data.dischargeFooterNote}
                        </p>
                        <div className="flex justify-between mt-1">
                          <span>{data.dischargeFooterBrand}</span>
                          <span className="font-bold">
                            {pageNum}/{totalPages}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </div>
        )}
      </div>

      {/* PDF Generation Modal */}
      {showPDFModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-slate-950 border-b border-slate-800 p-4">
              <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <Download className="w-5 h-5" />
                PDF Export Settings
              </h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Page Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Select Pages to Include
                </h4>

                {docType === "diagnostic" && (
                  <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-900/50 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedPages.diagnostic}
                      onChange={() => handlePDFPageToggle("diagnostic")}
                      className="w-4 h-4 rounded accent-emerald-500"
                    />
                    <span className="text-sm text-slate-300">
                      Diagnostic Report
                    </span>
                  </label>
                )}

                {docType === "fitness" && (
                  <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-900/50 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedPages.fitness}
                      onChange={() => handlePDFPageToggle("fitness")}
                      className="w-4 h-4 rounded accent-emerald-500"
                    />
                    <span className="text-sm text-slate-300">
                      Fitness Certificate
                    </span>
                  </label>
                )}

                {docType === "discharge" && (
                  <>
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-900/50 p-2 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedPages.discharge_page1}
                        onChange={() => handlePDFPageToggle("discharge_page1")}
                        className="w-4 h-4 rounded accent-emerald-500"
                      />
                      <span className="text-sm text-slate-300">
                        Discharge Summary - Page 1
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-900/50 p-2 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedPages.discharge_page2}
                        onChange={() => handlePDFPageToggle("discharge_page2")}
                        className="w-4 h-4 rounded accent-emerald-500"
                      />
                      <span className="text-sm text-slate-300">
                        Discharge Summary - Page 2
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-900/50 p-2 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedPages.discharge_page3}
                        onChange={() => handlePDFPageToggle("discharge_page3")}
                        className="w-4 h-4 rounded accent-emerald-500"
                      />
                      <span className="text-sm text-slate-300">
                        Discharge Summary - Page 3
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* Save Mode Selection */}
              <div className="space-y-3 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Save Mode
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-900/50 p-2 rounded transition-colors">
                    <input
                      type="radio"
                      name="saveMode"
                      value="combined"
                      checked={pdfSaveMode === "combined"}
                      onChange={(e) =>
                        setPdfSaveMode(
                          e.target.value as "combined" | "separate",
                        )
                      }
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <span className="text-sm text-slate-300">
                      Combined (All pages in one PDF)
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-900/50 p-2 rounded transition-colors">
                    <input
                      type="radio"
                      name="saveMode"
                      value="separate"
                      checked={pdfSaveMode === "separate"}
                      onChange={(e) =>
                        setPdfSaveMode(
                          e.target.value as "combined" | "separate",
                        )
                      }
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <span className="text-sm text-slate-300">
                      Separate (Each page as individual PDF)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 p-4 flex gap-3">
              <button
                onClick={closePDFModal}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generatePDF}
                disabled={isGenerating}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isGenerating ? "Generating..." : "Generate PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
