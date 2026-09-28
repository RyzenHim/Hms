import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileText,
  LayoutGrid,
  Wifi,
} from "lucide-react";

const applications = [
  {
    href: "/wifi",
    name: "WiFi Bill Generator",
    description:
      "Create monthly internet bills with customer details, flexible GST, and a complete charge breakdown.",
    icon: Wifi,
    category: "BILLING",
    features: [
      "Monthly statements",
      "Automatic GST calculation",
      "Four-page PDF export",
    ],
    color: "text-sky-300",
    background: "bg-sky-400/10 border-sky-400/20",
  },
  {
    href: "/hms",
    name: "HMS",
    description:
      "Manage patients and prepare healthcare documents in your existing hospital workspace.",
    icon: Building2,
    category: "HEALTHCARE",
    features: [
      "Patient management",
      "Reports & prescriptions",
      "Certificates & discharge summaries",
    ],
    color: "text-emerald-300",
    background: "bg-emerald-400/10 border-emerald-400/20",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3 border-b border-slate-800 pb-7">
          <div className="rounded-xl bg-emerald-400 p-2.5 text-slate-950">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-bold">Document Workspace</p>
            <p className="text-xs text-slate-400">
              Your tools, in one place
            </p>{" "}
          </div>
        </header>
        <section className="pb-10 pt-16 sm:pt-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Applications
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            What would you like to create?
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">
            Choose a workspace to get started. Prepare your documents, review
            every detail, and download a print-ready PDF.
          </p>
        </section>
        <div className="grid gap-6 md:grid-cols-2">
          {applications.map(({ icon: Icon, ...application }) => (
            <Link
              key={application.href}
              href={application.href}
              className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-7 transition hover:-translate-y-1 hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
            >
              <div className="mb-8 flex items-center justify-between">
                <span
                  className={`rounded-xl border p-3 ${application.background} ${application.color}`}
                >
                  <Icon className="h-7 w-7" />
                </span>
                <span className="text-[10px] font-bold tracking-[0.18em] text-slate-500">
                  {application.category}
                </span>
              </div>
              <h2 className="text-xl font-bold">{application.name}</h2>
              <p className="mb-6 mt-3 min-h-18 text-sm leading-6 text-slate-400">
                {application.description}
              </p>
              <ul className="mb-8 space-y-3 text-sm text-slate-300">
                {application.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <FileText className={`h-4 w-4 ${application.color}`} />
                    {feature}
                  </li>
                ))}
              </ul>
              <div
                className={`mt-auto flex items-center justify-between border-t border-slate-800 pt-5 text-sm font-semibold ${application.color}`}
              >
                Open {application.name}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
