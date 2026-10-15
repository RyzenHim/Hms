import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import styles from "./WifiBillDocument.module.css";

type TableVariant = "standard" | "grid" | "detail" | "tax" | "tariff" | "payment";

const variantClasses: Record<TableVariant, string> = {
  standard: "",
  grid: styles.gridTable,
  detail: styles.detailTable,
  tax: `${styles.detailTable} ${styles.taxTable}`,
  tariff: styles.tariffTable,
  payment: styles.paymentHistoryTable,
};

export function BillTable({ variant = "standard", className = "", ...props }:
  ComponentPropsWithoutRef<"table"> & { variant?: TableVariant }) {
  return <table className={[styles.table, variantClasses[variant], className].filter(Boolean).join(" ")} {...props} />;
}

export function AlignedCell<T extends ElementType = "td">({
  as,
  align = "left",
  children,
  className = "",
  ...props
}: {
  as?: T;
  align?: "left" | "center" | "right";
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">) {
  const Component = as || "td";
  const alignmentClass = align === "right" ? styles.money : align === "center" ? styles.center : "";
  return <Component className={[alignmentClass, className].filter(Boolean).join(" ")} {...props}>{children}</Component>;
}

export function TotalRow({ children, grand = false }: { children: ReactNode; grand?: boolean }) {
  return <tr className={grand ? styles.grandTotal : styles.totalRow}>{children}</tr>;
}

