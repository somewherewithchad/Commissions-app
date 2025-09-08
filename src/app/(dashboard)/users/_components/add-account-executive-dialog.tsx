import { Button } from "@/components/ui/button";
import { Icons } from "@/lib/icons";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const formSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    name: z.string().min(1, "Name is required"),
    baseCommissionRate: z.coerce
      .number({
        invalid_type_error: "Base commission rate must be a number",
        required_error: "Base commission rate is required",
      })
      .min(0.01, "Base commission rate must be greater than 0"),
    tier1CommissionRate: z.coerce
      .number({
        invalid_type_error: "Tier 1 commission rate must be a number",
        required_error: "Tier 1 commission rate is required",
      })
      .min(0.01, "Tier 1 commission rate must be greater than 0"),
    tier1CashCollectedThreshold: z.coerce
      .number({
        invalid_type_error: "Tier 1 cash collected threshold must be a number",
        required_error: "Tier 1 cash collected threshold is required",
      })
      .min(1, "Tier 1 cash collected threshold must be greater than 0"),
    tier2CommissionRate: z.coerce
      .number({
        invalid_type_error: "Tier 2 commission rate must be a number",
        required_error: "Tier 2 commission rate is required",
      })
      .min(0.01, "Tier 2 commission rate must be greater than 0"),
    tier2CashCollectedThreshold: z.coerce
      .number({
        invalid_type_error: "Tier 2 cash collected threshold must be a number",
        required_error: "Tier 2 cash collected threshold is required",
      })
      .min(1, "Tier 2 cash collected threshold must be greater than 0"),
    tier3CommissionRate: z.coerce
      .number({
        invalid_type_error: "Tier 3 commission rate must be a number",
        required_error: "Tier 3 commission rate is required",
      })
      .min(0.01, "Tier 3 commission rate must be greater than 0"),
    tier3CashCollectedThreshold: z.coerce
      .number({
        invalid_type_error: "Tier 3 cash collected threshold must be a number",
        required_error: "Tier 3 cash collected threshold is required",
      })
      .min(1, "Tier 3 cash collected threshold must be greater than 0"),
    tierSystemEnabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // Base rate must be strictly less than Tier 1 rate
    if (data.baseCommissionRate >= data.tier1CommissionRate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseCommissionRate"],
        message:
          "Base commission rate must be less than Tier 1 commission rate",
      });
    }

    // Commission rates must be strictly ascending: T1 < T2 < T3
    if (data.tier1CommissionRate >= data.tier2CommissionRate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tier2CommissionRate"],
        message: "Tier 2 rate must be greater than Tier 1 rate",
      });
    }
    if (data.tier2CommissionRate >= data.tier3CommissionRate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tier3CommissionRate"],
        message: "Tier 3 rate must be greater than Tier 2 rate",
      });
    }

    // Cash collected thresholds must be strictly ascending: T1 < T2 < T3
    if (data.tier1CashCollectedThreshold >= data.tier2CashCollectedThreshold) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tier2CashCollectedThreshold"],
        message: "Tier 2 threshold must be greater than Tier 1 threshold",
      });
    }
    if (data.tier2CashCollectedThreshold >= data.tier3CashCollectedThreshold) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tier3CashCollectedThreshold"],
        message: "Tier 3 threshold must be greater than Tier 2 threshold",
      });
    }
  });

export function AddAccountExecutiveDialog() {
  const utils = api.useUtils();

  const addAccountExecutive =
    api.accountExecutive.addAccountExecutive.useMutation({
      onSuccess: (res) => {
        toast.success(res.message);
        form.reset();
        void utils.accountExecutive.getAllAccountExecutives.invalidate();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      baseCommissionRate: 0.01,
      tier1CommissionRate: 0.01,
      tier1CashCollectedThreshold: 0,
      tier2CommissionRate: 0.01,
      tier2CashCollectedThreshold: 0,
      tier3CommissionRate: 0.01,
      tier3CashCollectedThreshold: 0,
      tierSystemEnabled: true,
    },
  });

  const tierSystemEnabled = form.watch("tierSystemEnabled");

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    addAccountExecutive.mutate(values);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Icons.plus className="h-4 w-4" />
          Add Account Executive
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Account Executive</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="jane@acme.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tierSystemEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Tier System Enabled</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baseCommissionRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Commission Rate</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input placeholder="5" className="pr-8" {...field} />
                    </FormControl>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                      %
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tier1CommissionRate"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel
                      className={cn(
                        !tierSystemEnabled && "text-muted-foreground"
                      )}
                    >
                      Tier 1 Commission Rate
                    </FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="7.5"
                          className="pr-8"
                          {...field}
                          disabled={!tierSystemEnabled}
                        />
                      </FormControl>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                        %
                      </span>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tier1CashCollectedThreshold"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel
                      className={cn(
                        !tierSystemEnabled && "text-muted-foreground"
                      )}
                    >
                      Tier 1 Cash Collected Threshold
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="50000"
                        {...field}
                        disabled={!tierSystemEnabled}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tier2CommissionRate"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel
                      className={cn(
                        !tierSystemEnabled && "text-muted-foreground"
                      )}
                    >
                      Tier 2 Commission Rate
                    </FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="10"
                          className="pr-8"
                          {...field}
                          disabled={!tierSystemEnabled}
                        />
                      </FormControl>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                        %
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tier2CashCollectedThreshold"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel
                      className={cn(
                        !tierSystemEnabled && "text-muted-foreground"
                      )}
                    >
                      Tier 2 Cash Collected Threshold
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="100000"
                        {...field}
                        disabled={!tierSystemEnabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tier3CommissionRate"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel
                      className={cn(
                        !tierSystemEnabled && "text-muted-foreground"
                      )}
                    >
                      Tier 3 Commission Rate
                    </FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="12.5"
                          className="pr-8"
                          {...field}
                          disabled={!tierSystemEnabled}
                        />
                      </FormControl>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                        %
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tier3CashCollectedThreshold"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel
                      className={cn(
                        !tierSystemEnabled && "text-muted-foreground"
                      )}
                    >
                      Tier 3 Cash Collected Threshold
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="150000"
                        {...field}
                        disabled={!tierSystemEnabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={addAccountExecutive.isPending}>
                {addAccountExecutive.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
