"use client";

import React, { useState, useRef } from "react";
import {
  Download,
  RotateCcw,
  User,
  ClipboardList,
  Settings,
  FileBadge2,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckSquare,
  Square
} from "lucide-react";

interface Medication {
  name: string;
  instruction: string;
}

interface FindingItem {
  id: string;
  label: string;
  value: string;
  isDefault: boolean;
}

interface ReportData {
  // Hospital Info
  hospitalName: string;
  hospitalSub: string;
  hospitalAddress: string;
  hospitalEmail: string;
  hospitalPhone: string;
  hospitalWebsite: string;
  hospitalEmergency: string;
  cin: string;

  // Patient Info (shared)
  patientName: string;
  ageSex: string;
  uhid: string;
  refDoctor: string;
  aadharCard: string;
  address: string;
  companyName: string;
  ipNo: string;
  orderDate: string;
  reportDate: string;
  facility: string;
  dob: string;
  mobile: string;
  orderingBedWard: string;
  currentBedWard: string;

  // Diagnostic Report Specific Findings
  reportTitle: string;
  clinicalProfile: string;
  rightKidney: string;
  leftKidney: string;
  ureters: string;
  urinaryBladder: string;
  prostate: string;
  impression: string;
  suggestion: string;
  reportSavedBy: string;
  printDateTime: string;
  printRunBy: string;

  // Fitness Certificate Specific Fields
  fitTitle: string;
  fitStatus: "fit" | "unfit";
  fitStatement: string;
  fitRemarks: string;
  fitDate: string;
  fitSignatory: string;

  // Discharge Summary Specific Fields
  admitDate: string;
  dischargeDateTime: string;
  primaryConsultant: string;
  crossConsultants: string;
  finalDiagnosis: string;
  dischargeResult: string;
  natureOfTreatment: string;
  reasonForAdmission: string;
  hopi: string;
  pastHistory: string;
  familyHistory: string;
  allergy: string;

  // O/E (At Admission)
  pulse: string;
  bp: string;
  temp: string;
  spo2: string;
  respiration: string;
  pallor: string;
  cyanosis: string;
  edema: string;

  // Discharge Summary Page 2
  treatmentGiven: string[];
  investigations: string;
  courseDuringStay: string;
  procedureDone: string;
  urgentCareInfo: string;
  medications: Medication[];
  specialNeeds: string;
  dischargeFollowUp: string;
  conditionOnDischarge: string;

  // Discharge Summary Page 3
  dischargeFollowUpVisitDate: string;
  preparedBy: string;
  verifiedBy: string;
  receivedBy: string;
  receivedDate: string;
  receivedTime: string;

  customPages: string[];

  // Custom Logo and Watermarks
  logoType: "text" | "image";
  logoImage: string; // Base64
  watermarkEnabled: boolean;
  watermarkImage: string; // Base64
  watermarkOpacity: number;
  watermarkPages: number[]; // 1-indexed page list
  watermarkX: number; // horizontal position in %
  watermarkY: number; // vertical position in %
  findingsList: FindingItem[];
}

// Default light blue medical cross/hands emblem as a default watermark Base64 SVG
const defaultWatermarkSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><path fill="%2322c55e" fill-opacity="0.12" d="M200,40 C130,40 100,100 100,160 C100,240 200,360 200,360 C200,360 300,240 300,160 C300,100 270,40 200,40 Z M200,220 C167,220 140,193 140,160 C140,127 167,100 200,100 C233,100 260,127 260,160 C260,193 233,220 200,220 Z"/></svg>`;

const defaultReportData: ReportData = {
  hospitalName: "Orchid Medical Centre",
  hospitalSub: "Orchid Medical Centre Pvt. Ltd.",
  hospitalAddress: "H.B. Road, Ranchi - 834001",
  cin: "U85100JH2009PTC013704",
  hospitalEmail: "info@orchidmedcentre.com",
  hospitalPhone: "911-7100-100",
  hospitalWebsite: "www.orchidmedcentre.com",
  hospitalEmergency: "911-7100-100",

  patientName: "Mr. Abhishek Kumar Barnwal",
  ageSex: "30 Year(s)/Male",
  uhid: "OMC.400102",
  refDoctor: "Dr. Arvind Kumar Prabhat",
  aadharCard: "490804358696",
  address: "S/O ANIL KUMAR BARNWAL, TEA GARDEN, VTC NAMKUM PO NAMKUM, Ranchi, Jharkhand, 0",
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
  rightKidney: "Right kidney is normal in shape & size. It measures approx. 8.8 x 4.6 cm in size. Multiple small 2.2mm to 3 mm size radio-opaque calculi / concretions(3 in numbers) are seen impacted in its mid calyx. Pelvi-calyceal system is not dilated.",
  leftKidney: "Left kidney is normal in shape & size. It measures approx. 8.8 x 4.9 cm in size. Multiple small 2.2mm to 3 mm size radio-opaque calculi / concretions(4 in numbers) are seen impacted in its upper, mid and lower calyx. Pelvi-calyceal system is not dilated.",
  ureters: "Both ureters are not dilated.",
  urinaryBladder: "Normal in outline & distension. Lumen appears clear. Wall thickness normal. Perivesical fat plane is intact.",
  prostate: "Appears normal.",
  impression: "MULTIPLE SMALL BILATERAL RENAL CALCULI / CONCRETIONS WITH NO OBVIOUS BACK PRESSURE CHANGES IN THIS SCAN.",
  suggestion: "Clinico-Pathological Correlation.",
  reportSavedBy: "Shweta Singh (03/08/2026 11:15 AM)",
  printDateTime: "03/08/2026 11:24:13",
  printRunBy: "Shweta Singh",

  // Discharge Summary
  admitDate: "02/08/2026 10:14 PM",
  dischargeDateTime: "04/08/2026 02:49 PM",
  primaryConsultant: "Dr. ARVIND KUMAR PRABHAT : MBBS, MS, DNB, FMAS MCH (CONSULTANT UROLOGY) Fellowship in laparoscopy, Uro-oncology Robotics and Renal Transplantation from SMC in vijayawada, Andhra Pradesh. Available at Orchid Medical Centre : ON MON - SAT :10:00AM - 06:00PM",
  crossConsultants: "NA",
  finalDiagnosis: "RIGHT FLANK PAIN UNDER EVALUATION ? RIGHT URETERIC STONE.",
  dischargeResult: "Improved",
  natureOfTreatment: "Conservative",
  reasonForAdmission: "Right flank pain radiating to back since 3:30 PM on 02/08/2026 after onset of pain, no urine passed.",
  hopi: "Patient came with above mentioned complaints.",
  pastHistory: "History of fungal injection since 1.5 years (Taken Tab Itraconazole medication for 2 months ); not resolved completely. (Taken steroid since 2-3 months back).",
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
    "TAB ODIMONT LC"
  ],
  investigations: "REPORTS ATTACHED",
  courseDuringStay: "Mr. Abhishek Kumar Barnwal, 30 Years / Male, came to Orchid Medical Centre Emergency with above mentioned complaints and was admitted under care of Dr. A.K. Prabhat on 02/08/2026 for further management and evaluation. All relevant investigations were done. Patient shifted to ward and managed conservatively on medications, close monitoring of vitals and other parameters and other supportive care modalities. Chest X-Ray report pending. CT (KUB) on 03/08/2026 -> Multiple small bilateral Renal calculi / concretions with no obvious back pressure changes in this scan. His condition has improved and he is currently hemodynamically stable and being discharged with following advice.",
  procedureDone: "Conservative",
  urgentCareInfo: "If patient complains of pain and any medical requirement come to Orchid Medical Centre casualty.",
  medications: [
    { name: "TAB CEFOREV 500 mg", instruction: "1 tab twice daily for 5 days." },
    { name: "TAB PAN 40 mg", instruction: "1 tab once daily empty stomach for 5 days." },
    { name: "TAB DROTIN M", instruction: "1 tab sos for pain." },
    { name: "SYP NEOLYZER", instruction: "10 ml in half glass of water twice daily." }
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
  watermarkEnabled: true,
  watermarkImage: defaultWatermarkSvg,
  watermarkOpacity: 0.15,
  watermarkPages: [1, 2, 3], // Checked for page 1, 2 and 3 by default
  watermarkX: 50,
  watermarkY: 50,

  // Fitness Certificate Defaults
  fitTitle: "FIT TO TRAVEL CERTIFICATE",
  fitStatus: "fit",
  fitStatement: "and found him/her physically fit to travel by air/train/road. The patient is currently asymptomatic, non-infectious, and exhibits stable vital parameters.",
  fitRemarks: "The patient is fit to undertake long-distance travel. Standard safety and hygiene protocols should be followed during transit.",
  fitDate: "04/08/2026",
  fitSignatory: "Dr. Arvind Kumar Prabhat (Consultant Urologist)",

  findingsList: [
    { id: "right_kidney", label: "RIGHT KIDNEY", value: "Right kidney is normal in shape & size. It measures approx. 8.8 x 4.6 cm in size. Multiple small 2.2mm to 3 mm size radio-opaque calculi / concretions(3 in numbers) are seen impacted in its mid calyx. Pelvi-calyceal system is not dilated.", isDefault: true },
    { id: "left_kidney", label: "LEFT KIDNEY", value: "Left kidney is normal in shape & size. It measures approx. 8.8 x 4.9 cm in size. Multiple small 2.2mm to 3 mm size radio-opaque calculi / concretions(4 in numbers) are seen impacted in its upper, mid and lower calyx. Pelvi-calyceal system is not dilated.", isDefault: true },
    { id: "ureters", label: "URETERS", value: "Both ureters are not dilated.", isDefault: true },
    { id: "urinary_bladder", label: "URINARY BLADDER", value: "Normal in outline & distension. Lumen appears clear. Wall thickness normal. Perivesical fat plane is intact.", isDefault: true },
    { id: "prostate", label: "PROSTATE", value: "Appears normal.", isDefault: true }
  ]
};

export default function Home() {
  const [docType, setDocType] = useState<"diagnostic" | "discharge" | "fitness">("discharge");
  const [data, setData] = useState<ReportData>(defaultReportData);
  const [activeTab, setActiveTab] = useState<"patient" | "details" | "findings" | "treatment" | "meds" | "footer">("patient");
  const [isGenerating, setIsGenerating] = useState(false);

  // References to the A4 sheets
  const diagSheetRef = useRef<HTMLDivElement>(null);
  const fitSheetRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const page3Ref = useRef<HTMLDivElement>(null);
  const customPagesRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleInputChange = (field: keyof ReportData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFindingChange = (id: string, key: "label" | "value", val: string) => {
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
      isDefault: false
    };
    handleInputChange("findingsList", [...data.findingsList, newItem]);
  };

  const removeFinding = (id: string) => {
    const updated = data.findingsList.filter((item) => item.id !== id || item.isDefault);
    handleInputChange("findingsList", updated);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "logoImage" | "watermarkImage") => {
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

  const handleWatermarkPageToggle = (pageNumber: number) => {
    let updatedPages = [...data.watermarkPages];
    if (updatedPages.includes(pageNumber)) {
      updatedPages = updatedPages.filter((p) => p !== pageNumber);
    } else {
      updatedPages.push(pageNumber);
    }
    handleInputChange("watermarkPages", updatedPages);
  };

  const handleMedicationChange = (index: number, key: keyof Medication, value: string) => {
    const updatedMeds = [...data.medications];
    updatedMeds[index] = { ...updatedMeds[index], [key]: value };
    handleInputChange("medications", updatedMeds);
  };

  const addMedication = () => {
    handleInputChange("medications", [...data.medications, { name: "", instruction: "" }]);
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
    handleInputChange("customPages", [...data.customPages, "New Custom Page Content"]);
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
    if (confirm("Reset all fields?")) {
      setData(defaultReportData);
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pagesToRender: HTMLDivElement[] = [];

      if (docType === "diagnostic") {
        if (diagSheetRef.current) pagesToRender.push(diagSheetRef.current);
      } else if (docType === "fitness") {
        if (fitSheetRef.current) pagesToRender.push(fitSheetRef.current);
      } else {
        if (page1Ref.current) pagesToRender.push(page1Ref.current);
        if (page2Ref.current) pagesToRender.push(page2Ref.current);
        if (page3Ref.current) pagesToRender.push(page3Ref.current);

        customPagesRefs.current.forEach((el) => {
          if (el) pagesToRender.push(el);
        });
      }

      for (let i = 0; i < pagesToRender.length; i++) {
        const element = pagesToRender[i];
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false
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
      }

      pdf.save(`${docType === "diagnostic" ? "Diagnostic_Report" : docType === "fitness" ? "Fitness_Certificate" : "Discharge_Summary"}_${data.patientName.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Error generating PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const totalPages = docType === "diagnostic" ? 1 : docType === "fitness" ? 1 : 3 + data.customPages.length;

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Workspace Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-xl font-black text-2xl shadow-lg shadow-emerald-500/20">
            O
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
              Orchid Medical Workspace
              <span className="bg-slate-800 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-normal">Active</span>
            </h1>
            <p className="text-xs text-slate-400">Generate professional, print-ready healthcare documentation</p>
          </div>
        </div>

        {/* Document Type Selector Toggle */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setDocType("diagnostic");
              setActiveTab("patient");
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${docType === "diagnostic"
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
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${docType === "discharge"
                ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
              }`}
          >
            Discharge Summary ({docType === "discharge" ? totalPages : 3 + data.customPages.length} Pages)
          </button>
          <button
            onClick={() => {
              setDocType("fitness");
              setActiveTab("patient");
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${docType === "fitness"
                ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
              }`}
          >
            Fitness Certificate
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={generatePDF}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-5 py-2.5 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-lg shadow-emerald-500/10 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isGenerating ? "Building PDF..." : "Generate PDF"}</span>
          </button>
        </div>
      </header>

      {/* Workspace Panel Split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Form Settings Panel */}
        <div className="w-full lg:w-5/12 flex flex-col border-r border-slate-800 bg-slate-900/50 overflow-y-auto">
          {/* Settings Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950 sticky top-0 z-25 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("patient")}
              className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "patient" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              Patient Info
            </button>

            {docType === "diagnostic" && (
              <button
                onClick={() => setActiveTab("findings")}
                className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "findings" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                Findings & Study
              </button>
            )}

            {docType === "fitness" && (
              <button
                onClick={() => setActiveTab("findings")}
                className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "findings" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                Certificate Details
              </button>
            )}

            {docType === "discharge" && (
              <>
                <button
                  onClick={() => setActiveTab("details")}
                  className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "details" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                  Clinical Details
                </button>
                <button
                  onClick={() => setActiveTab("treatment")}
                  className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "treatment" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                  Stay & Treatment
                </button>
                <button
                  onClick={() => setActiveTab("meds")}
                  className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "meds" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                  Medications
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab("footer")}
              className={`flex-shrink-0 px-5 py-3.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "footer" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              Logo & Watermark
            </button>
          </div>

          {/* Form Settings Content */}
          <div className="p-6 space-y-6">
            {activeTab === "patient" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Patient Name</label>
                    <input
                      type="text"
                      value={data.patientName}
                      onChange={(e) => handleInputChange("patientName", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Age / Sex</label>
                    <input
                      type="text"
                      value={data.ageSex}
                      onChange={(e) => handleInputChange("ageSex", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">UHID</label>
                    <input
                      type="text"
                      value={data.uhid}
                      onChange={(e) => handleInputChange("uhid", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">IP No / OP No</label>
                    <input
                      type="text"
                      value={data.ipNo}
                      onChange={(e) => handleInputChange("ipNo", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Admit Date</label>
                    <input
                      type="text"
                      value={data.admitDate}
                      onChange={(e) => handleInputChange("admitDate", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Discharge Date</label>
                    <input
                      type="text"
                      value={data.dischargeDateTime}
                      onChange={(e) => handleInputChange("dischargeDateTime", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Doctor Name</label>
                    <input
                      type="text"
                      value={data.refDoctor}
                      onChange={(e) => handleInputChange("refDoctor", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Aadhar Card</label>
                    <input
                      type="text"
                      value={data.aadharCard}
                      onChange={(e) => handleInputChange("aadharCard", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Mobile</label>
                    <input
                      type="text"
                      value={data.mobile}
                      onChange={(e) => handleInputChange("mobile", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Facility</label>
                    <input
                      type="text"
                      value={data.facility}
                      onChange={(e) => handleInputChange("facility", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Ordering Ward</label>
                    <input
                      type="text"
                      value={data.orderingBedWard}
                      onChange={(e) => handleInputChange("orderingBedWard", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Current Ward</label>
                    <input
                      type="text"
                      value={data.currentBedWard}
                      onChange={(e) => handleInputChange("currentBedWard", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Company / Insurance Name</label>
                    <input
                      type="text"
                      value={data.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Address</label>
                    <textarea
                      value={data.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Certificate Header Title</label>
                  <input
                    type="text"
                    value={data.fitTitle}
                    onChange={(e) => handleInputChange("fitTitle", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none font-bold"
                    placeholder="e.g. FIT TO TRAVEL CERTIFICATE"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fitness Status</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInputChange("fitStatus", "fit")}
                      className={`flex-1 py-2 text-xs font-bold rounded ${data.fitStatus === "fit" ? "bg-emerald-500 text-slate-950" : "bg-slate-950 text-slate-400 border border-slate-800"
                        }`}
                    >
                      FIT
                    </button>
                    <button
                      onClick={() => handleInputChange("fitStatus", "unfit")}
                      className={`flex-1 py-2 text-xs font-bold rounded ${data.fitStatus === "unfit" ? "bg-red-500 text-slate-950" : "bg-slate-950 text-slate-400 border border-slate-800"
                        }`}
                    >
                      UNFIT
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fitness Statement Text</label>
                  <textarea
                    value={data.fitStatement}
                    onChange={(e) => handleInputChange("fitStatement", e.target.value)}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                    placeholder="This is to certify that I have conducted..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Clinical Remarks / Recommendation</label>
                  <textarea
                    value={data.fitRemarks}
                    onChange={(e) => handleInputChange("fitRemarks", e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                    placeholder="Standard safety precautions should be followed..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Certificate Date</label>
                    <input
                      type="text"
                      value={data.fitDate}
                      onChange={(e) => handleInputChange("fitDate", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Designated Signatory</label>
                    <input
                      type="text"
                      value={data.fitSignatory}
                      onChange={(e) => handleInputChange("fitSignatory", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "findings" && docType === "diagnostic" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Report Study Title</label>
                  <input
                    type="text"
                    value={data.reportTitle}
                    onChange={(e) => handleInputChange("reportTitle", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Clinical Indications</label>
                  <input
                    type="text"
                    value={data.clinicalProfile}
                    onChange={(e) => handleInputChange("clinicalProfile", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Findings List</h4>
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
                      <div key={item.id} className="bg-slate-955 p-3.5 rounded-lg border border-slate-800 space-y-2.5 relative">
                        <div className="flex justify-between items-center gap-2">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => handleFindingChange(item.id, "label", e.target.value.toUpperCase())}
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
                          onChange={(e) => handleFindingChange(item.id, "value", e.target.value)}
                          rows={3}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none resize-none"
                          placeholder="Enter details..."
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">IMPRESSION</label>
                  <textarea
                    value={data.impression}
                    onChange={(e) => handleInputChange("impression", e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">SUGGESTION</label>
                  <input
                    type="text"
                    value={data.suggestion}
                    onChange={(e) => handleInputChange("suggestion", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {activeTab === "details" && docType === "discharge" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Primary Consultant</label>
                  <textarea
                    value={data.primaryConsultant}
                    onChange={(e) => handleInputChange("primaryConsultant", e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Cross Consultants</label>
                  <input
                    type="text"
                    value={data.crossConsultants}
                    onChange={(e) => handleInputChange("crossConsultants", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Final/Provisional Diagnosis</label>
                  <textarea
                    value={data.finalDiagnosis}
                    onChange={(e) => handleInputChange("finalDiagnosis", e.target.value)}
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Result (Discharge)</label>
                    <input
                      type="text"
                      value={data.dischargeResult}
                      onChange={(e) => handleInputChange("dischargeResult", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nature of Treatment</label>
                    <input
                      type="text"
                      value={data.natureOfTreatment}
                      onChange={(e) => handleInputChange("natureOfTreatment", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">History & Admission Indications</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Reason for Admission</label>
                      <textarea
                        value={data.reasonForAdmission}
                        onChange={(e) => handleInputChange("reasonForAdmission", e.target.value)}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">HOPI</label>
                      <textarea
                        value={data.hopi}
                        onChange={(e) => handleInputChange("hopi", e.target.value)}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Past History</label>
                      <textarea
                        value={data.pastHistory}
                        onChange={(e) => handleInputChange("pastHistory", e.target.value)}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Family History</label>
                      <input
                        type="text"
                        value={data.familyHistory}
                        onChange={(e) => handleInputChange("familyHistory", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Allergy</label>
                      <input
                        type="text"
                        value={data.allergy}
                        onChange={(e) => handleInputChange("allergy", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">O/E (At Admission) Vitals</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Pulse</label>
                      <input
                        type="text"
                        value={data.pulse}
                        onChange={(e) => handleInputChange("pulse", e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">BP</label>
                      <input
                        type="text"
                        value={data.bp}
                        onChange={(e) => handleInputChange("bp", e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Temp</label>
                      <input
                        type="text"
                        value={data.temp}
                        onChange={(e) => handleInputChange("temp", e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Spo2</label>
                      <input
                        type="text"
                        value={data.spo2}
                        onChange={(e) => handleInputChange("spo2", e.target.value)}
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
                    <label className="block text-xs font-semibold text-slate-400">Treatment Given List</label>
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
                        <span className="text-xs text-slate-500 font-bold">{idx + 1}.</span>
                        <input
                          type="text"
                          value={t}
                          onChange={(e) => handleTreatmentChange(idx, e.target.value)}
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Investigations</label>
                  <input
                    type="text"
                    value={data.investigations}
                    onChange={(e) => handleInputChange("investigations", e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Course During Stay (Summary)</label>
                  <textarea
                    value={data.courseDuringStay}
                    onChange={(e) => handleInputChange("courseDuringStay", e.target.value)}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === "meds" && docType === "discharge" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold text-slate-400">Discharge Medications</label>
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
                    <div key={idx} className="bg-slate-955 p-3 rounded-lg border border-slate-800 space-y-2 relative">
                      <button
                        onClick={() => removeMedication(idx)}
                        className="absolute right-2 top-2 text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Medicine Name</label>
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => handleMedicationChange(idx, "name", e.target.value)}
                          className="w-11/12 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Instructions</label>
                        <input
                          type="text"
                          value={m.instruction}
                          onChange={(e) => handleMedicationChange(idx, "instruction", e.target.value)}
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
                {/* Logo Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" />
                    Logo Settings
                  </h4>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5 font-semibold">Logo Style</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleInputChange("logoType", "text")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded ${data.logoType === "text" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 text-slate-400"
                          }`}
                      >
                        Default Text Logo
                      </button>
                      <button
                        onClick={() => handleInputChange("logoType", "image")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded ${data.logoType === "image" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 text-slate-400"
                          }`}
                      >
                        Upload Custom Logo
                      </button>
                    </div>
                  </div>

                  {data.logoType === "text" && (
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-500 font-semibold">Hospital Name (Text Logo)</label>
                      <input
                        type="text"
                        value={data.hospitalName}
                        onChange={(e) => handleInputChange("hospitalName", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. Orchid Medical Centre"
                      />
                    </div>
                  )}

                  {data.logoType === "image" && (
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-500 font-semibold">Hospital Logo Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "logoImage")}
                        className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                      />
                      {data.logoImage && (
                        <div className="bg-white p-2 rounded flex justify-center max-h-16 overflow-hidden mt-1">
                          <img src={data.logoImage} alt="Logo preview" className="object-contain" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Watermark Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Watermark Configuration</span>
                    <button
                      onClick={() => handleInputChange("watermarkEnabled", !data.watermarkEnabled)}
                      className={`px-3 py-1 rounded text-[10px] font-bold ${data.watermarkEnabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                        }`}
                    >
                      {data.watermarkEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                  </h4>

                  {data.watermarkEnabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Upload Watermark Image</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, "watermarkImage")}
                          className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                        />
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
                          onChange={(e) => handleInputChange("watermarkOpacity", parseFloat(e.target.value))}
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
                            onChange={(e) => handleInputChange("watermarkX", parseInt(e.target.value))}
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
                            onChange={(e) => handleInputChange("watermarkY", parseInt(e.target.value))}
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
                                className={`flex items-center space-x-2 p-2 rounded text-xs border text-left transition-all ${isChecked
                                    ? "bg-emerald-950/40 border-emerald-500 text-emerald-400"
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                                  }`}
                              >
                                {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                <span>Page {pNum}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                style={{ boxSizing: "border-box", fontSize: "11.5px", lineHeight: "1.5" }}
              >
                {/* Optional Watermark Overlay */}
                {data.watermarkEnabled && data.watermarkPages.includes(1) && data.watermarkImage && (
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
                      alignItems: "center"
                    }}
                  >
                    <img src={data.watermarkImage} alt="watermark" className="w-full h-full object-contain select-none" />
                  </div>
                )}

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-gray-300 pb-3 mb-5">
                    <div className="text-3xl font-extrabold tracking-tight text-gray-800 flex items-center">
                      {data.logoType === "image" && data.logoImage ? (
                        <img src={data.logoImage} alt="Hospital Logo" className="max-h-12 object-contain" />
                      ) : (
                        <>
                          <span className="text-gray-900">{data.hospitalName.split(" ")[0] || "Orchid"}</span>
                          <span className="text-gray-600 ml-1 text-base font-normal block leading-tight border-l border-gray-400 pl-2">
                            {data.hospitalName.split(" ").slice(1).join(" ") || "Medical Centre"}
                            <span className="block text-[8px] text-gray-400 uppercase tracking-widest font-bold font-sans">Super Speciality Hospital</span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-[9px] text-right text-gray-600 space-y-0.5">
                      <p className="font-bold text-gray-800">{data.hospitalSub}</p>
                      <p>{data.hospitalAddress}</p>
                      <p>CIN : {data.cin}</p>
                      <p>E: {data.hospitalEmail} | T: {data.hospitalPhone}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-gray-100 px-3 py-1.5 mb-8 font-bold text-gray-850">
                    <span>FITNESS / MEDICAL CERTIFICATE</span>
                    <span className="text-[9px] text-gray-500">(OFFICIAL RECORD)</span>
                  </div>

                  {/* Document Title */}
                  <div className="text-center mb-8">
                    <h3 className="text-[14px] font-black text-gray-900 underline tracking-wide uppercase">
                      {data.fitTitle}
                    </h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">TO WHOMSOEVER IT MAY CONCERN</p>
                  </div>

                  {/* Patient Details Grid (Simplified) */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-gray-200 rounded-sm p-4 mb-6 bg-gray-50/50">
                    <div><span className="text-gray-500">Patient Name:</span> <span className="font-bold text-gray-900">{data.patientName}</span></div>
                    <div><span className="text-gray-500">UHID:</span> <span className="font-bold text-gray-900">{data.uhid}</span></div>
                    <div><span className="text-gray-500">Age / Sex:</span> <span className="font-bold text-gray-900">{data.ageSex}</span></div>
                    <div><span className="text-gray-500">Mobile:</span> <span className="font-bold text-gray-900">{data.mobile}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-bold text-gray-900 leading-normal">{data.address}</span></div>
                  </div>

                  {/* Certificate Statement */}
                  <div className="space-y-4 text-justify leading-relaxed text-[12px] text-gray-800">
                    <p>
                      This is to certify that I have conducted a clinical examination and medical evaluation of
                      <strong> {data.patientName}</strong>, aged <strong>{data.ageSex}</strong>, who has been registered under UHID
                      <strong> {data.uhid}</strong>.
                    </p>
                    <p>
                      Based on my assessment, clinical history, and physical measurements, I hereby declare that the patient is
                      <span className={`inline-block mx-1.5 px-2 py-0.5 rounded font-black text-[11px] ${data.fitStatus === "fit" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}>
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
                      <p className="text-[10px] text-gray-500">Date of Issue:</p>
                      <p className="text-sm font-bold text-gray-800">{data.fitDate}</p>
                    </div>
                    <div className="text-right">
                      <div className="w-48 border-b border-gray-400 mb-1.5"></div>
                      <p className="text-[11px] font-bold text-gray-800">{data.fitSignatory}</p>
                      <p className="text-[9px] text-gray-400">Authorized Signatory</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-300 mt-5 pt-4">
                    <div className="text-center text-[8px] text-gray-400">
                      {data.hospitalSub} • emergency helpline: {data.hospitalEmergency}
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
                style={{ boxSizing: "border-box", fontSize: "11px", lineHeight: "1.4" }}
              >
                {/* Optional Watermark Overlay */}
                {data.watermarkEnabled && data.watermarkPages.includes(1) && data.watermarkImage && (
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
                      alignItems: "center"
                    }}
                  >
                    <img src={data.watermarkImage} alt="watermark" className="w-full h-full object-contain select-none" />
                  </div>
                )}

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-gray-300 pb-3 mb-4">
                    <div className="text-3xl font-extrabold tracking-tight text-gray-800 flex items-center">
                      {data.logoType === "image" && data.logoImage ? (
                        <img src={data.logoImage} alt="Hospital Logo" className="max-h-12 object-contain" />
                      ) : (
                        <>
                          <span className="text-gray-900">{data.hospitalName.split(" ")[0] || "Orchid"}</span>
                          <span className="text-gray-600 ml-1 text-base font-normal block leading-tight border-l border-gray-400 pl-2">
                            {data.hospitalName.split(" ").slice(1).join(" ") || "Medical Centre"}
                            <span className="block text-[8px] text-gray-400 uppercase tracking-widest font-bold font-sans">Super Speciality Hospital</span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-[9px] text-right text-gray-600 space-y-0.5">
                      <p className="font-bold text-gray-800">{data.hospitalSub}</p>
                      <p>{data.hospitalAddress}</p>
                      <p>CIN : {data.cin}</p>
                      <p>E: {data.hospitalEmail} | T: {data.hospitalPhone}</p>
                      <p>W: {data.hospitalWebsite}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-gray-100 px-3 py-1 mb-4 font-bold text-gray-700">
                    <span>DIAGNOSTIC REPORTS</span>
                    <span className="text-[9px] text-gray-500">(FOR DIAGNOSTIC REPORTS ONLY)</span>
                  </div>

                  {/* Patient Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 border border-gray-300 rounded-sm p-3 mb-4 text-[10px]">
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Patient Name</span>
                      <span className="col-span-2 font-bold">: {data.patientName}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">IP No</span>
                      <span className="col-span-2 font-bold">: {data.ipNo}</span>
                    </div>

                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Age/Sex</span>
                      <span className="col-span-2 font-bold">: {data.ageSex}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Order Date</span>
                      <span className="col-span-2 font-bold">: {data.orderDate}</span>
                    </div>

                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">UHID</span>
                      <span className="col-span-2 font-bold">: {data.uhid}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Report Date</span>
                      <span className="col-span-2 font-bold">: {data.reportDate}</span>
                    </div>

                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Ref. Doctor</span>
                      <span className="col-span-2 font-bold">: {data.refDoctor}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Facility</span>
                      <span className="col-span-2 font-bold">: {data.facility}</span>
                    </div>

                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Aadhar Card</span>
                      <span className="col-span-2 font-bold">: {data.aadharCard}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Dob</span>
                      <span className="col-span-2 font-bold">: {data.dob}</span>
                    </div>

                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Address</span>
                      <span className="col-span-2 font-bold break-words leading-tight">: {data.address}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Mobile</span>
                      <span className="col-span-2 font-bold">: {data.mobile}</span>
                    </div>

                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Company Name</span>
                      <span className="col-span-2 font-bold">: {data.companyName}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Ordering Bed/Ward Name</span>
                      <span className="col-span-2 font-bold">: {data.orderingBedWard}</span>
                    </div>

                    <div></div>
                    <div className="grid grid-cols-3">
                      <span className="text-gray-500">Current Bed/Ward Name</span>
                      <span className="col-span-2 font-bold">: {data.currentBedWard}</span>
                    </div>
                  </div>

                  {/* Title & Findings */}
                  <div className="mb-4">
                    <h4 className="font-bold underline text-center uppercase mb-3">{data.reportTitle}</h4>
                    <p className="mb-3 font-semibold">Clinical profile: <span className="font-normal">{data.clinicalProfile}</span></p>

                    <div className="space-y-3 mt-4 text-justify">
                      <h5 className="font-bold underline">Findings:</h5>
                      {data.findingsList.map((item) => (
                        item.value && (
                          <div key={item.id}>
                            <span className="font-bold">{item.label} : </span>
                            <span>{item.value}</span>
                          </div>
                        )
                      ))}
                    </div>

                    {data.impression && (
                      <div className="mt-5">
                        <p className="font-bold underline uppercase">IMPRESSION: PLAIN CT OF KUB REVEALS:-</p>
                        <p className="font-bold pl-4 mt-1 uppercase">- {data.impression}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="relative z-10">
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] text-gray-500">Report Saved By: {data.reportSavedBy}</p>
                    <div className="text-right">
                      <div className="w-28 border-b border-gray-400 mb-1"></div>
                      <p className="text-[9px] font-bold text-gray-700">Authorized Signatory</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-300 mt-5 pt-4">
                    <div className="flex justify-between text-[8px] text-gray-400">
                      <p>Print Date: {data.printDateTime}</p>
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
                <div className="text-center text-xs text-slate-400 mb-2">A4 Discharge Summary</div>
                <div
                  ref={page1Ref}
                  className="bg-white text-black p-[12mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                  style={{ boxSizing: "border-box", fontSize: "10.5px", lineHeight: "1.35" }}
                >
                  {/* Watermark */}
                  {data.watermarkEnabled && data.watermarkPages.includes(1) && data.watermarkImage && (
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
                        alignItems: "center"
                      }}
                    >
                      <img src={data.watermarkImage} alt="watermark" className="w-full h-full object-contain select-none" />
                    </div>
                  )}

                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-gray-300 pb-2 mb-3">
                      <div className="text-2xl font-black text-gray-800 flex items-center">
                        {data.logoType === "image" && data.logoImage ? (
                          <img src={data.logoImage} alt="Hospital Logo" className="max-h-10 object-contain" />
                        ) : (
                          <>
                            <span>{data.hospitalName.split(" ")[0]}</span>
                            <span className="text-gray-600 ml-1 text-sm font-normal border-l border-gray-400 pl-2 block">
                              {data.hospitalName.split(" ").slice(1).join(" ")}
                              <span className="block text-[7px] text-gray-400 uppercase tracking-widest font-bold">Super Speciality Hospital</span>
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[8px] text-right text-gray-600 leading-tight">
                        <p className="font-bold text-gray-700">{data.hospitalSub}</p>
                        <p>{data.hospitalAddress}</p>
                        <p>E: {data.hospitalEmail} | T: {data.hospitalPhone}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-gray-150 px-2.5 py-0.5 rounded-sm mb-3 font-bold text-[11px] text-gray-700">
                      <span>DISCHARGE SUMMARY</span>
                    </div>

                    {/* Patient detail block */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 border border-gray-350 p-2.5 rounded-sm mb-4 text-[9.5px]">
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Patient Name</span>
                        <span className="col-span-2 font-bold">: {data.patientName}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">IP No</span>
                        <span className="col-span-2 font-bold">: {data.ipNo}</span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Age/Sex</span>
                        <span className="col-span-2 font-bold">: {data.ageSex}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Admit Date</span>
                        <span className="col-span-2 font-bold">: {data.admitDate}</span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Discharge Date</span>
                        <span className="col-span-2 font-bold">: {data.dischargeDateTime}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">UHID</span>
                        <span className="col-span-2 font-bold">: {data.uhid}</span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Doctor Name</span>
                        <span className="col-span-2 font-bold">: {data.refDoctor}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Facility</span>
                        <span className="col-span-2 font-bold">: {data.facility}</span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Aadhar Card</span>
                        <span className="col-span-2 font-bold">: {data.aadharCard}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Dob</span>
                        <span className="col-span-2 font-bold">: {data.dob}</span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Address</span>
                        <span className="col-span-2 font-bold break-words leading-tight">: {data.address}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Mobile</span>
                        <span className="col-span-2 font-bold">: {data.mobile}</span>
                      </div>

                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Company Name</span>
                        <span className="col-span-2 font-bold">: {data.companyName}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Ordering Bed/Ward Name</span>
                        <span className="col-span-2 font-bold">: {data.orderingBedWard}</span>
                      </div>

                      <div></div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500">Current Bed/Ward Name</span>
                        <span className="col-span-2 font-bold">: {data.currentBedWard}</span>
                      </div>
                    </div>

                    {/* Primary & Cross Consultants */}
                    <div className="space-y-2 mb-3">
                      <div>
                        <p className="font-bold underline text-gray-800">Primary Consultant</p>
                        <p className="text-justify font-medium leading-relaxed mt-0.5">{data.primaryConsultant}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">Cross Consultants</p>
                        <p className="mt-0.5">{data.crossConsultants}</p>
                      </div>
                    </div>

                    {/* Diagnosis & clinical details */}
                    <div className="space-y-2.5">
                      <div>
                        <p className="font-bold underline text-gray-800">Final / Provisional Diagnosis</p>
                        <p className="font-bold text-gray-900 mt-0.5">{data.finalDiagnosis}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-bold underline text-gray-800">Result</p>
                          <p className="mt-0.5">{data.dischargeResult}</p>
                        </div>
                        <div>
                          <p className="font-bold underline text-gray-800">Nature of Treatment</p>
                          <p className="mt-0.5">{data.natureOfTreatment}</p>
                        </div>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">Reason for admission</p>
                        <p className="mt-0.5">{data.reasonForAdmission}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">HOPI</p>
                        <p className="mt-0.5">{data.hopi}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">Past History</p>
                        <p className="mt-0.5">{data.pastHistory}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">Family History</p>
                        <p className="mt-0.5">{data.familyHistory}</p>
                      </div>
                      <div>
                        <p className="font-bold underline text-gray-800">Allergy</p>
                        <p className="mt-0.5">{data.allergy}</p>
                      </div>
                    </div>

                    {/* Vitals Table */}
                    <div className="mt-3">
                      <p className="font-bold underline text-gray-800 mb-1.5">O/E (At admission)</p>
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
                    <p className="font-semibold text-gray-500">NOTE: FOR BIOPSY REPORT CONTACT RECEPTION: +91-9117100100 DIET CONSULTATION BY DIETICIAN: 02:00 PM - 05:00 PM EMERGENCY HELPLINE: +91-9117100100</p>
                    <div className="flex justify-between mt-1">
                      <span>Orchid Medical Centre</span>
                      <span className="font-bold">1/{totalPages}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAGE 2 */}
              <div className="shadow-2xl rounded-sm relative">
                <div className="text-center text-xs text-slate-400 mb-2">A4 Discharge Summary</div>
                <div
                  ref={page2Ref}
                  className="bg-white text-black p-[12mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                  style={{ boxSizing: "border-box", fontSize: "10.5px", lineHeight: "1.35" }}
                >
                  {/* Watermark */}
                  {data.watermarkEnabled && data.watermarkPages.includes(2) && data.watermarkImage && (
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
                        alignItems: "center"
                      }}
                    >
                      <img src={data.watermarkImage} alt="watermark" className="w-full h-full object-contain select-none" />
                    </div>
                  )}

                  <div className="relative z-10">
                    <div className="grid grid-cols-3 border border-gray-300 rounded p-2 mb-3 text-[9px]">
                      <div><span className="text-gray-500">Patient Name:</span> <span className="font-bold">{data.patientName}</span></div>
                      <div><span className="text-gray-500">UHID:</span> <span className="font-bold">{data.uhid}</span></div>
                      <div><span className="text-gray-500">IP No:</span> <span className="font-bold">{data.ipNo}</span></div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="font-bold underline text-gray-800">Treatment Given:</p>
                        <div className="grid grid-cols-3 gap-y-1.5 mt-1 font-semibold text-gray-700">
                          {data.treatmentGiven.map((t, i) => (
                            <p key={i}>{i + 1}. {t}</p>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">Investigations:</p>
                        <p className="mt-0.5 text-gray-700">{data.investigations}</p>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">COURSE DURING STAY (SUMMARY)</p>
                        <p className="mt-0.5 text-justify leading-relaxed">{data.courseDuringStay}</p>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">Procedure done:</p>
                        <p className="mt-0.5 text-gray-700">{data.procedureDone}</p>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">When and how to obtain urgent care:</p>
                        <p className="mt-0.5 text-gray-700 leading-normal">{data.urgentCareInfo}</p>
                      </div>

                      {/* Discharge Medications list */}
                      <div>
                        <p className="font-bold underline text-gray-800 mb-1">DISCHARGE MEDICATION</p>
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
                                <tr key={i} className="border-b border-gray-200">
                                  <td className="p-1.5 font-bold">{i + 1}</td>
                                  <td className="p-1.5 font-bold text-gray-800">{m.name}</td>
                                  <td className="p-1.5 text-gray-700">{m.instruction}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-bold underline text-gray-800">Special needs:</p>
                          <p className="mt-0.5">{data.specialNeeds}</p>
                        </div>
                        <div>
                          <p className="font-bold underline text-gray-800">Follow up:</p>
                          <p className="mt-0.5">{data.dischargeFollowUp}</p>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold underline text-gray-800">Condition on Discharge:</p>
                        <p className="mt-0.5 font-bold text-emerald-700">{data.conditionOnDischarge}</p>
                      </div>
                    </div>
                  </div>

                  {/* Signatures & Footer */}
                  <div className="relative z-10">
                    <div className="flex justify-between items-end mb-4 pt-4">
                      <div>
                        <div className="w-32 border-b border-gray-300 mb-1"></div>
                        <p className="text-[9px] font-bold text-gray-700">Doctor Signature</p>
                      </div>
                      <div className="text-center bg-gray-50 p-2 border border-gray-200 rounded text-[8px] max-w-[120px]">
                        <p className="font-bold">Orchid Medical Centre</p>
                        <p className="text-gray-400">Radiology Stamp</p>
                      </div>
                      <div className="text-right">
                        <div className="w-32 border-b border-gray-300 mb-1"></div>
                        <p className="text-[9px] font-bold text-gray-700">Consultant signature</p>
                        <p className="text-[8px] text-gray-500">{data.verifiedBy}</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-300 pt-2 text-[7.5px] text-gray-400 text-center leading-tight">
                      <p className="font-semibold text-gray-500">NOTE: FOR BIOPSY REPORT CONTACT RECEPTION: +91-9117100100 DIET CONSULTATION BY DIETICIAN: 02:00 PM - 05:00 PM EMERGENCY HELPLINE: +91-9117100100</p>
                      <div className="flex justify-between mt-1">
                        <span>Orchid Medical Centre</span>
                        <span className="font-bold">2/{totalPages}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAGE 3 */}
              <div className="shadow-2xl rounded-sm relative">
                <div className="text-center text-xs text-slate-400 mb-2">A4 Discharge Summary</div>
                <div
                  ref={page3Ref}
                  className="bg-white text-black p-[12mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                  style={{ boxSizing: "border-box", fontSize: "10.5px", lineHeight: "1.35" }}
                >
                  {/* Watermark */}
                  {data.watermarkEnabled && data.watermarkPages.includes(3) && data.watermarkImage && (
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
                        alignItems: "center"
                      }}
                    >
                      <img src={data.watermarkImage} alt="watermark" className="w-full h-full object-contain select-none" />
                    </div>
                  )}

                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-gray-300 pb-2 mb-3">
                      <div className="text-2xl font-black text-gray-800 flex items-center">
                        {data.logoType === "image" && data.logoImage ? (
                          <img src={data.logoImage} alt="Hospital Logo" className="max-h-10 object-contain" />
                        ) : (
                          <>
                            <span>{data.hospitalName.split(" ")[0]}</span>
                            <span className="text-gray-600 ml-1 text-sm font-normal border-l border-gray-400 pl-2 block">
                              {data.hospitalName.split(" ").slice(1).join(" ")}
                              <span className="block text-[7px] text-gray-400 uppercase tracking-widest font-bold">Super Speciality Hospital</span>
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[8px] text-right text-gray-600 leading-tight">
                        <p className="font-bold text-gray-700">{data.hospitalSub}</p>
                        <p>{data.hospitalAddress}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-gray-150 px-2.5 py-0.5 rounded-sm mb-4 font-bold text-[11px] text-gray-700">
                      <span>DISCHARGE SUMMARY (FOLLOW-UP)</span>
                    </div>

                    {/* Patient info repetition block */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 border border-gray-350 p-2.5 rounded-sm mb-4 text-[9.5px]">
                      <div><span className="text-gray-500">Patient Name:</span> <span className="font-bold">{data.patientName}</span></div>
                      <div><span className="text-gray-500">UHID:</span> <span className="font-bold">{data.uhid}</span></div>
                      <div><span className="text-gray-500">Age/Sex:</span> <span className="font-bold">{data.ageSex}</span></div>
                      <div><span className="text-gray-500">Admit Dt:</span> <span className="font-bold">{data.admitDate}</span></div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="font-bold underline text-gray-800">Primary Consultant Details:</p>
                        <p className="mt-1 font-semibold leading-relaxed">{data.primaryConsultant}</p>
                      </div>

                      <div className="border border-gray-300 p-3 rounded-sm space-y-3 bg-gray-50 text-[10px]">
                        <p className="font-bold text-gray-800">Acknowledgment & Received by (Patient / NOK):</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-gray-500">Received By:</span>
                            <div className="border-b border-gray-400 h-6 mt-1 font-bold">{data.receivedBy || "___________________"}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Date:</span>
                            <div className="border-b border-gray-400 h-6 mt-1 font-bold">{data.receivedDate || "____/____/________"}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Time:</span>
                            <div className="border-b border-gray-400 h-6 mt-1 font-bold">{data.receivedTime || "____:____"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-emerald-55 border border-emerald-200 p-3 rounded-sm">
                          <p className="font-bold text-emerald-800">Discharge Follow Up Visit Date:</p>
                          <p className="text-lg font-black text-emerald-950 mt-1">{data.dischargeFollowUpVisitDate}</p>
                        </div>
                        <div className="border border-gray-300 p-3 rounded-sm text-[9.5px] space-y-1">
                          <p><span className="text-gray-500">Prepared By:</span> <span className="font-bold text-gray-800">{data.preparedBy}</span></p>
                          <p><span className="text-gray-500">Verified By:</span> <span className="font-bold text-gray-800">{data.verifiedBy}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Note Footer */}
                  <div className="border-t border-gray-300 pt-2 text-[7.5px] text-gray-400 text-center leading-tight relative z-10">
                    <p className="font-semibold text-gray-500">NOTE: FOR BIOPSY REPORT CONTACT RECEPTION: +91-9117100100 DIET CONSULTATION BY DIETICIAN: 02:00 PM - 05:00 PM EMERGENCY HELPLINE: +91-9117100100</p>
                    <div className="flex justify-between mt-1">
                      <span>Orchid Medical Centre</span>
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
                    <div className="text-center text-xs text-slate-400 mb-2">A4 Discharge Summary</div>
                    <div
                      ref={(el) => {
                        customPagesRefs.current[idx] = el;
                      }}
                      className="bg-white text-black p-[12mm] font-sans shadow-lg mx-auto w-full min-h-[297mm] flex flex-col justify-between relative overflow-hidden"
                      style={{ boxSizing: "border-box", fontSize: "10.5px", lineHeight: "1.35" }}
                    >
                      {/* Watermark */}
                      {data.watermarkEnabled && data.watermarkPages.includes(pageNum) && data.watermarkImage && (
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
                            alignItems: "center"
                          }}
                        >
                          <img src={data.watermarkImage} alt="watermark" className="w-full h-full object-contain select-none" />
                        </div>
                      )}

                      <div className="relative z-10">
                        {/* Header */}
                        <div className="flex justify-between items-start border-b border-gray-300 pb-2 mb-3">
                          <div className="text-2xl font-black text-gray-800 flex items-center">
                            {data.logoType === "image" && data.logoImage ? (
                              <img src={data.logoImage} alt="Hospital Logo" className="max-h-10 object-contain" />
                            ) : (
                              <>
                                <span>{data.hospitalName.split(" ")[0]}</span>
                                <span className="text-gray-600 ml-1 text-sm font-normal border-l border-gray-400 pl-2 block">
                                  {data.hospitalName.split(" ").slice(1).join(" ")}
                                  <span className="block text-[7px] text-gray-400 uppercase tracking-widest font-bold">Super Speciality Hospital</span>
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-[8px] text-right text-gray-600 leading-tight">
                            <p className="font-bold text-gray-700">{data.hospitalSub}</p>
                            <p>{data.hospitalAddress}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center bg-gray-150 px-2.5 py-0.5 rounded-sm mb-4 font-bold text-[11px] text-gray-700">
                          <span>DISCHARGE SUMMARY (ADDITIONAL DOCUMENTATION)</span>
                        </div>

                        <div className="whitespace-pre-wrap text-justify text-gray-800 leading-relaxed font-medium">
                          {cp}
                        </div>
                      </div>

                      {/* Note Footer */}
                      <div className="border-t border-gray-300 pt-2 text-[7.5px] text-gray-400 text-center leading-tight relative z-10">
                        <p className="font-semibold text-gray-500">NOTE: FOR BIOPSY REPORT CONTACT RECEPTION: +91-9117100100 DIET CONSULTATION BY DIETICIAN: 02:00 PM - 05:00 PM EMERGENCY HELPLINE: +91-9117100100</p>
                        <div className="flex justify-between mt-1">
                          <span>Orchid Medical Centre</span>
                          <span className="font-bold">{pageNum}/{totalPages}</span>
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
    </div>
  );
}
