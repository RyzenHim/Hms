/** Editable form values stay strings so clearing a numeric field never inserts zero. */
export interface WifiBillData {
  providerName: string;
  providerAddress: string;
  providerGstin: string;
  supportPhone: string;
  supportEmail: string;
  paymentInstructions: string;
  paymentUpiId: string;
  paymentPayeeName: string;
  paymentMerchantCode: string;
  paymentTransactionNote: string;
  issuerSignatoryName: string;
  issuerSignatoryTitle: string;
  /** Blank uses the reference signature extracted from the supplied operator bill. */
  issuerSignatureUrl: string;
  issuerSignaturePublicId: string;
  providerPan: string;
  providerCin: string;
  providerServiceCategory: string;
  registeredOffice: string;
  corporateOffice: string;
  contactInformation: string;
  appellateInformation: string;
  corporateCoordinatorInformation: string;
  chargesInformation: string;
  addressChangeInformation: string;
  otherInformation: string;
  fupInformation: string;
  hsnServiceDescription: string;
  customerName: string;
  customerAddressLine1: string;
  customerCity: string;
  customerPostalCode: string;
  customerEmail: string;
  customerPhone: string;
  customerGstin: string;
  customerState: string;
  customerStateCode: string;
  accountNumber: string;
  invoiceNumber: string;
  wifiId: string;
  fixedlineNumber: string;
  billMonth: string;
  monthMode: "current" | "custom";
  billDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  planDisplayName: string;
  speed: string;
  quota: string;
  connections: string;
  hsnSacCode: string;
  rentalAmount: string;
  discount: string;
  otherCharges: string;
  gstRate: string;
  taxMode: "split" | "igst";
  amountMode: "exclusive" | "inclusive";
  previousBalance: string;
  paymentReceived: string;
  paymentCoupon: string;
  history1PreviousDues: string;
  history1Payments: string;
  history1PaymentCoupon: string;
  history1Credits: string;
  history1CurrentCharges: string;
  history2PreviousDues: string;
  history2Payments: string;
  history2PaymentCoupon: string;
  history2Credits: string;
  history2CurrentCharges: string;
  history3PreviousDues: string;
  history3Payments: string;
  history3PaymentCoupon: string;
  history3Credits: string;
  history3CurrentCharges: string;
  paymentDate: string;
  paymentMethod: string;
  credits: string;
  creditLimit: string;
  securityDeposit: string;
  tariffAirtelFixedline: string;
  tariffOtherFixedline: string;
  tariffAirtelMobile: string;
  tariffOtherMobile: string;
  tariffFixedlineCug: string;
  tariffWll: string;
  /** Optional manual override; blank uses the late-payment policy calculated from the payable amount. */
  lateFee: string;
  notes: string;
}

/** Monetary values are INR; calculations are performed in integer paise. */
export interface WifiBillTotals {
  rentalAmount: number;
  discount: number;
  otherCharges: number;
  rentalBeforeTax: number;
  discountBeforeTax: number;
  otherChargesBeforeTax: number;
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstTotal: number;
  totalCurrentCharges: number;
  previousBalance: number;
  paymentReceived: number;
  paymentCoupon: number;
  credits: number;
  lateFee: number;
  lateFeeGst: number;
  lateFeeWithGst: number;
  previousBalanceDue: number;
  netBalance: number;
  totalPayable: number;
  creditBalance: number;
  amountAfterDueDate: number;
  creditLimit: number;
  securityDeposit: number;
  paymentTotal: number;
  netRental: number;
}

export interface WifiCompanyProfile {
  legalName: string;
  address: string;
  gstin: string;
  pan: string;
  cin: string;
  serviceCategory: string;
  registeredOffice: string;
  corporateOffice: string;
  supportPhone: string;
  supportEmail: string;
}

export interface WifiInvoiceIdentifiers {
  invoiceNumber: string;
  accountNumber: string;
  wifiId: string;
  fixedlineNumber: string;
  billMonth: string;
  billDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  paymentReference: string;
}

export interface WifiInvoice {
  /** Immutable snapshot used by both the HTML preview and the PDF renderer. */
  source: Readonly<WifiBillData>;
  companyProfile: Readonly<WifiCompanyProfile>;
  customer: Readonly<{
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    addressLines: readonly string[];
    email: string;
    phone: string;
    gstin: string;
    stateCode: string;
  }>;
  identifiers: Readonly<WifiInvoiceIdentifiers>;
  plan: Readonly<{
    displayName: string;
    hsnSacCode: string;
    serviceDescription: string;
    speed: string;
    quota: string;
    connections: string;
  }>;
  payment: Readonly<{
    upiId: string;
    payeeName: string;
    merchantCode: string;
    transactionNote: string;
  }>;
  calculations: Readonly<WifiBillTotals>;
  barcodeValue: string;
}

export type WifiBillErrors = Partial<Record<keyof WifiBillData, string>>;
