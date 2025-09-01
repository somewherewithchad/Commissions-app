"use client";

"use client";

import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import {
  amountIsNumeric,
  canonicalFromToken,
  convertToYearMonth,
  extractMonthTokenFromFilename,
  parseCsv,
  validateMonthAndAmount,
} from "@/lib/utils";

const invoicesCsvRequiredHeaders = [
  "Deal ID",
  "Exclude - Deal link",
  "Deal link",
  "Deal name",
  "Recruiter Name",
  "Recruiter Email",
  "Amount invoiced",
  "Month",
] as const;

const collectionsCsvRequiredHeaders = [
  "Deal ID",
  "Recruiter Name",
  "Recruiter Email",
  "Amount paid",
  "Month",
] as const;

type InvoiceCSV = Record<(typeof invoicesCsvRequiredHeaders)[number], string>;
type CollectionCSV = Record<
  (typeof collectionsCsvRequiredHeaders)[number],
  string
>;

export function RecruiterDataForm() {
  const [invoicesFile, setInvoicesFile] = useState<File | null>(null);
  const [collectionsFile, setCollectionsFile] = useState<File | null>(null);
  const [invoicesMonthToken, setInvoicesMonthToken] = useState<string | null>(
    null
  );
  const [collectionsMonthToken, setCollectionsMonthToken] = useState<
    string | null
  >(null);
  const invoicesInputRef = useRef<HTMLInputElement>(null);
  const collectionsInputRef = useRef<HTMLInputElement>(null);

  const addMonthlyData = api.recruiter.addMonthlyData.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      setInvoicesFile(null);
      setInvoicesMonthToken(null);
      setCollectionsFile(null);
      setCollectionsMonthToken(null);
      if (invoicesInputRef.current) invoicesInputRef.current.value = "";
      if (collectionsInputRef.current) collectionsInputRef.current.value = "";
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message);
    },
  });

  function ensureSameMonthOrReset(
    which: "invoice" | "collection",
    currentToken: string | null,
    otherToken: string | null
  ) {
    if (
      currentToken &&
      otherToken &&
      currentToken.toLowerCase() !== otherToken.toLowerCase()
    ) {
      toast.error(
        `Files must be for the same month. Selected ${which} is ${currentToken}, other is ${otherToken}`
      );
      if (which === "invoice") {
        setInvoicesFile(null);
        setInvoicesMonthToken(null);
        if (invoicesInputRef.current) invoicesInputRef.current.value = "";
      } else {
        setCollectionsFile(null);
        setCollectionsMonthToken(null);
        if (collectionsInputRef.current) collectionsInputRef.current.value = "";
      }
      return false;
    }
    return true;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoicesFile || !collectionsFile) {
      toast.error("Please select both Deals and Cash CSV files.");
      return;
    }

    const dealsToken =
      invoicesMonthToken ??
      extractMonthTokenFromFilename(invoicesFile, "invoice");
    if (!dealsToken) return;
    const cashToken =
      collectionsMonthToken ??
      extractMonthTokenFromFilename(collectionsFile, "collection");
    if (!cashToken) return;
    if (dealsToken.toLowerCase() !== cashToken.toLowerCase()) {
      toast.error(
        `Files must be for the same month. Deals is ${dealsToken}, Cash is ${cashToken}`
      );
      return;
    }

    const canonicalMonth = canonicalFromToken(dealsToken);

    try {
      const [invoiceRows, collectionRows] = await Promise.all([
        parseCsv<InvoiceCSV>(invoicesFile, invoicesCsvRequiredHeaders),
        parseCsv<CollectionCSV>(collectionsFile, collectionsCsvRequiredHeaders),
      ]);

      if (
        !validateMonthAndAmount(
          invoiceRows,
          "Month",
          "Amount invoiced",
          canonicalMonth,
          "Invoices CSV"
        )
      ) {
        return;
      }

      if (
        !validateMonthAndAmount(
          collectionRows,
          "Month",
          "Amount paid",
          canonicalMonth,
          "Collections CSV"
        )
      ) {
        return;
      }

      addMonthlyData.mutate({
        deals: invoiceRows.map((invoice) => ({
          dealId: invoice["Deal ID"],
          dealLink: invoice["Deal link"],
          dealName: invoice["Deal name"],
          amountInvoiced: Number(invoice["Amount invoiced"].replace(/,/g, "")),
          month: convertToYearMonth(canonicalMonth),
          recruiterEmail: invoice["Recruiter Email"],
          recruiterName: invoice["Recruiter Name"],
        })),
        cashCollections: collectionRows.map((collection) => ({
          dealId: collection["Deal ID"],
          amountPaid: Number(collection["Amount paid"].replace(/,/g, "")),
          month: convertToYearMonth(canonicalMonth),
          recruiterEmail: collection["Recruiter Email"],
          recruiterName: collection["Recruiter Name"],
        })),
      });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Upload monthly data</CardTitle>
          <CardDescription>
            Import deals and cash collections for a given month. Accepted
            format: CSV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="invoices">Invoices CSV</Label>
              <Input
                id="invoices"
                name="invoices"
                type="file"
                accept=".csv,text/csv"
                ref={invoicesInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) {
                    setInvoicesFile(null);
                    setInvoicesMonthToken(null);
                    return;
                  }
                  const token = extractMonthTokenFromFilename(file, "invoice");
                  if (!token) {
                    // invalid name; reset input
                    setInvoicesFile(null);
                    setInvoicesMonthToken(null);
                    if (invoicesInputRef.current)
                      invoicesInputRef.current.value = "";
                    return;
                  }
                  // tentatively set, then ensure same-month with other file if present
                  if (
                    !ensureSameMonthOrReset(
                      "invoice",
                      token,
                      collectionsMonthToken
                    )
                  ) {
                    return;
                  }
                  setInvoicesFile(file);
                  setInvoicesMonthToken(token);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Required columns:
                <br />
                Deal ID, Deal link, Deal name, Recruiter Name, Recruiter Email,
                Amount invoiced, Month
              </p>
              <p className="text-xs text-muted-foreground">
                Example CSV filename:
                <br />
                <code>invoice-july-25.csv</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collections">Collections CSV</Label>
              <Input
                id="collections"
                name="collections"
                type="file"
                accept=".csv,text/csv"
                ref={collectionsInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) {
                    setCollectionsFile(null);
                    setCollectionsMonthToken(null);
                    return;
                  }
                  const token = extractMonthTokenFromFilename(
                    file,
                    "collection"
                  );
                  if (!token) {
                    setCollectionsFile(null);
                    setCollectionsMonthToken(null);
                    if (collectionsInputRef.current)
                      collectionsInputRef.current.value = "";
                    return;
                  }
                  if (
                    !ensureSameMonthOrReset(
                      "collection",
                      token,
                      invoicesMonthToken
                    )
                  ) {
                    return;
                  }
                  setCollectionsFile(file);
                  setCollectionsMonthToken(token);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Required columns:
                <br />
                Deal ID, Recruiter Name, Recruiter Email, Amount paid, Month
              </p>
              <p className="text-xs text-muted-foreground">
                Example CSV filename:
                <br />
                <code>collection-july-25.csv</code>
              </p>
            </div>

            <CardFooter className="px-0">
              <Button type="submit" disabled={addMonthlyData.isPending}>
                {addMonthlyData.isPending ? "Uploading..." : "Submit"}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
