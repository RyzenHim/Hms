export interface Medication {
  name: string;
  instruction: string;
}

export interface FindingItem {
  id: string;
  label: string;
  value: string;
  isDefault: boolean;
}

export interface StampDesigner {
  name: string;
  mainText: string;
  centerContent?: "text" | "medicalSymbol";
  symbolScale?: number;
  topText: string;
  bottomText: string;
  color: string;
  shape: "round" | "rectangle";
  inkOpacity: number;
  distress: number;
  inkSpread: number;
  edgeSoftness: number;
  fadeSide: "none" | "top" | "right" | "bottom" | "left";
  fadeStrength: number;
  inkSpill: number;
  sizeMismatch: number;
  textOpacityVariation: number;
  pressureVariation?: number;
  inkBleed?: number;
  edgeWear?: number;
  smudge?: number;
  borderEnabled: boolean;
  borderWidth: number;
}

export interface NameStampDesigner {
  doctorName: string;
  department: string;
  degree: string;
  hospitalName: string;
  color: string;
  shape: "round" | "rectangle";
  inkOpacity: number;
  distress: number;
  inkSpread: number;
  edgeSoftness: number;
  fadeSide: "none" | "top" | "right" | "bottom" | "left";
  fadeStrength: number;
  inkSpill: number;
  sizeMismatch: number;
  textOpacityVariation: number;
  pressureVariation?: number;
  inkBleed?: number;
  edgeWear?: number;
  smudge?: number;
  borderEnabled: boolean;
  borderWidth: number;
}

export type StampDocumentType =
  | "diagnostic"
  | "discharge"
  | "fitness"
  | "opd";

export interface StampPlacement {
  documentType: StampDocumentType;
  page: number;
  size: number;
  opacity: number;
  x: number;
  y: number;
  rotation: number;
  filter: "none" | "grayscale" | "sepia" | "brightness";
}

export interface Stamp {
  id: string;
  label: string;
  image: string;
  imagePublicId?: string;
  size: number;
  opacity: number;
  x: number;
  y: number;
  rotation: number;
  filter: "none" | "grayscale" | "sepia" | "brightness";
  isDefault: boolean;
  pages: number[];
  documentTypes: StampDocumentType[];
  /** Independent usages of this reusable stamp. Legacy records use the fields above. */
  placements?: StampPlacement[];
  designer?: StampDesigner;
  nameDesigner?: NameStampDesigner;
}

export interface HeaderLogo {
  id: string;
  image: string;
  imagePublicId?: string;
  size: number;
  width?: number;
  height?: number;
  opacity: number;
  x: number;
  y: number;
  isDefault: boolean;
}

export interface LogoSettings {
  logoType: "text" | "image";
  logoImage: string;
  logoImagePublicId?: string;
  logoImageWidth: number;
  logoImageHeight: number;
  logoImageX: number;
  logoImageY: number;
  logoTextColor: string;
  logoTextSize: number;
  logoTextWeight: number;
  headerLogos: HeaderLogo[];
}

export interface ReportTheme {
  primary: string;
  primarySoft: string;
  text: string;
  muted: string;
  border: string;
  heading: string;
  background: string;
}

export interface ReportData {
  hospitalName: string;
  hospitalSub: string;
  hospitalAddress: string;
  hospitalEmail: string;
  hospitalPhone: string;
  hospitalWebsite: string;
  hospitalEmergency: string;
  emergencyStripeText: string;
  emergencyStripeBackground: string;
  emergencyStripeTextColor: string;
  emergencyStripeWidth: number;
  showUhidAtTop: boolean;
  showUhidBarcode: boolean;
  showUhidBarcodeInDetails: boolean;
  cin: string;
  hospitalTagline: string;
  dischargeFooterNote: string;
  dischargeFooterBrand: string;
  fitnessFooterText: string;
  opdFooterText: string;
  radiologyStampLabel: string;
  radiologyStampSubtext: string;
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
  reportTitle: string;
  clinicalProfile: string;
  rightKidney: string;
  leftKidney: string;
  ureters: string;
  urinaryBladder: string;
  prostate: string;
  impressionHeading: string;
  impression: string;
  suggestion: string;
  reportSavedBy: string;
  printDateTime: string;
  printRunBy: string;
  fitTitle: string;
  fitStatus: "fit" | "unfit";
  fitStatement: string;
  fitRemarks: string;
  fitDate: string;
  fitSignatory: string;
  opdTitle: string;
  opdVisitDate: string;
  opdDepartment: string;
  opdDoctorName: string;
  opdRegistrationNumber: string;
  opdPatientRegistrationNumber: string;
  opdDoctorQualifications: string;
  opdDayTime: string;
  opdValidUpto: string;
  opdHeight: string;
  opdWeight: string;
  opdBloodPressure: string;
  opdBmi: string;
  opdPulse: string;
  opdTemperature: string;
  opdRespiration: string;
  opdPages: string[];
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
  admissionCondition: string;
  pulse: string;
  bp: string;
  temp: string;
  spo2: string;
  respiration: string;
  pallor: string;
  cyanosis: string;
  edema: string;
  treatmentGiven: string[];
  investigations: string;
  courseDuringStay: string;
  procedureDone: string;
  urgentCareInfo: string;
  medications: Medication[];
  specialNeeds: string;
  dischargeFollowUp: string;
  conditionOnDischarge: string;
  dischargeFollowUpVisitDate: string;
  preparedBy: string;
  verifiedBy: string;
  receivedBy: string;
  receivedDate: string;
  receivedTime: string;
  customPages: string[];
  logoType: "text" | "image";
  logoImage: string;
  logoImagePublicId?: string;
  logoImageWidth: number;
  logoImageHeight: number;
  logoImageX: number;
  logoImageY: number;
  logoTextColor: string;
  logoTextSize: number;
  logoTextWeight: number;
  headerLogos: HeaderLogo[];
  documentLogoSettings: Record<StampDocumentType, LogoSettings>;
  watermarkEnabled: boolean;
  watermarkImageEnabled: boolean;
  watermarkImage: string;
  watermarkImagePublicId?: string;
  watermarkOpacity: number;
  watermarkPages: number[];
  watermarkX: number;
  watermarkY: number;
  watermarkText: string;
  watermarkTextColor: string;
  watermarkTextSize: number;
  watermarkTextWeight: number;
  watermarkTextOpacity: number;
  watermarkTextRotation: number;
  watermarkTextSkewX: number;
  watermarkTextSkewY: number;
  watermarkTextX: number;
  watermarkTextY: number;
  watermarkTextLetterSpacing: number;
  watermarkTextStyle: "normal" | "italic";
  watermarkTextTransform: "none" | "uppercase" | "lowercase";
  reportTheme: ReportTheme;
  findingsList: FindingItem[];
  dischargeSummaryStamps: Stamp[];
}

export interface PatientListItem {
  _id: string;
  patientName: string;
  uhid: string;
  hospitalDetails: Pick<
    ReportData,
    "hospitalName" | "hospitalSub" | "hospitalAddress"
  >;
  updatedAt: string;
}
