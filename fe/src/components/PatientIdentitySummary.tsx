import { UhidWithBarcode } from "./UhidBarcode";

interface PatientIdentitySummaryProps {
  patientName: string;
  ageSex: string;
  uhid: string;
  dob: string;
  showUhidBarcode: boolean;
  className?: string;
}

export function PatientIdentitySummary({
  patientName,
  ageSex,
  uhid,
  dob,
  showUhidBarcode,
  className = "",
}: PatientIdentitySummaryProps) {
  const fields = [
    ["Patient Name", patientName],
    ["Age/Sex", ageSex],
    ["UHID", uhid],
    ["DOB", dob],
  ] as const;

  return (
    <div
      className={`grid grid-cols-2 gap-x-4 gap-y-1 border border-gray-300 p-2.5 rounded-sm text-[9.5px] ${className}`}
    >
      {fields.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <span className="text-gray-500">{label}:</span>{" "}
          {label === "UHID" ? (
            <UhidWithBarcode
              value={value}
              showBarcode={showUhidBarcode}
              className="font-bold"
              barcodeClassName="h-4 w-24"
            />
          ) : (
            <span className="font-bold break-words">{value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
