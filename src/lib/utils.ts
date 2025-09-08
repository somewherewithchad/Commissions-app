import { clsx, type ClassValue } from "clsx";
import { format, parse } from "date-fns";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";
import Papa from "papaparse";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertToYearMonth(dateString: string) {
  // 1. Parse the string, telling date-fns its format is 'MMMM-yy'.
  // 'MMMM' = full month name, 'yy' = 2-digit year.
  const parsedDate = parse(dateString, "MMMM-yy", new Date());

  // 2. Format the resulting Date object into the 'yyyy-MM' format.
  return format(parsedDate, "yyyy-MM");
}

export function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export const validMonths = new Set([
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

export function amountIsNumeric(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  // allow integers or decimals, optional leading minus
  return /^-?\d+(\.\d+)?$/.test(normalized);
}

export function getBaseName(name: string) {
  const lastDot = name.lastIndexOf(".");
  return lastDot === -1 ? name : name.slice(0, lastDot);
}

export function canonicalFromToken(token: string) {
  // token like 'july-25' -> 'July-25'
  const parts = token.split("-");
  const m = parts[0] ?? "";
  const y = parts[1] ?? "";
  if (!m || !y) return token;
  const monthCanonical = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  return `${monthCanonical}-${y}`;
}

export function extractMonthTokenFromFilename(
  file: File,
  expectedPrefix: "invoice" | "collection"
) {
  const base = getBaseName(file.name);
  const match = base.match(/^(invoice|collection)-([a-zA-Z]+)-(\d{2})$/i);
  if (!match) {
    toast.error(
      `${
        expectedPrefix === "invoice" ? "Invoices" : "Collections"
      } filename must be like ${expectedPrefix}-july-25.csv`
    );
    return null;
  }
  const prefix = (match[1] ?? "").toLowerCase();
  const month = (match[2] ?? "").toLowerCase();
  const year = match[3] ?? "";
  if (!prefix || !month || !year) {
    toast.error(
      `Invalid filename '${file.name}'. Expected ${expectedPrefix}-july-25.csv`
    );
    return null;
  }
  if (prefix !== expectedPrefix) {
    toast.error(
      `Expected a ${expectedPrefix} file, but got '${prefix}'. Rename to ${expectedPrefix}-${month}-${year}.csv`
    );
    return null;
  }
  if (!validMonths.has(month)) {
    toast.error(`Invalid month '${match[2]}' in filename '${file.name}'`);
    return null;
  }
  return `${month}-${year}`;
}

export async function parseCsv<T extends Record<string, string>>(
  file: File,
  requiredHeaders: readonly string[]
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) =>
        header
          .replace(/\.+$/, "") // remove trailing periods
          .replace(/\u00A0/g, " ") // convert non-breaking spaces
          .trim()
          .replace(/\s+/g, " "), // collapse multiple spaces
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            const message = `Error parsing CSV file: ${results.errors[0]?.message}`;
            toast.error(message);
            console.error(results.errors);
            reject(new Error(message));
            return;
          }

          // Prefer headers from Papa's meta.fields (available even when there are 0 data rows)
          const headers =
            results.meta?.fields ?? Object.keys(results.data[0] ?? {});
          const missingHeaders = requiredHeaders.filter(
            (header) => !headers.includes(header)
          );
          if (missingHeaders.length > 0) {
            const message = `Missing required columns: ${missingHeaders.join(
              ", "
            )}`;
            toast.error(message);
            reject(new Error(message));
            return;
          }

          resolve(results.data);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Error processing file";
          toast.error(message);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      },
      error: (error) => {
        const message = `CSV parse error: ${error.message}`;
        toast.error(message);
        reject(new Error(message));
      },
    });
  });
}

export function validateMonthAndAmount<T extends Record<string, string>>(
  rows: T[],
  monthCol: keyof T,
  amountCol: keyof T,
  expectedCanonicalMonth: string,
  csvLabel: string
): boolean {
  for (const [i, row] of rows.entries()) {
    const rowNumber = i + 2;
    const monthValue = String(row[monthCol]).trim();
    if (monthValue.toLowerCase() !== expectedCanonicalMonth.toLowerCase()) {
      toast.error(
        `${csvLabel}: Month mismatch at row ${rowNumber}. Expected '${expectedCanonicalMonth}', got '${monthValue}'`
      );
      return false;
    }
    const amountValue = String(row[amountCol] ?? "");
    if (!amountIsNumeric(amountValue)) {
      toast.error(
        `${csvLabel}: Invalid ${String(
          amountCol
        )} at row ${rowNumber}. Must be a number (commas allowed).`
      );
      return false;
    }
  }
  return true;
}

export type UserType = "recruiter" | "recruitmentManager" | "accountExecutive";

export const userTypes = [
  "recruiter",
  "recruitmentManager",
  "accountExecutive",
];

export function userTypeToLabel(type: string) {
  if (type === "recruiter") return "Recruiter";
  if (type === "recruitmentManager") return "Recruitment Manager";
  if (type === "accountExecutive") return "Account Executive";
  return type;
}
