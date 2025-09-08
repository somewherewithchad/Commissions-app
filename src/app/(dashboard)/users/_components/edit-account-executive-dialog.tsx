import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import React from "react";
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
import { formSchema } from "@/app/(dashboard)/users/_components/add-account-executive-dialog";
import { type RouterOutputs } from "@/trpc/react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type AccountExecutive =
  RouterOutputs["accountExecutive"]["getAllAccountExecutives"]["items"][number];

export function EditAccountExecutiveDialog({
  accountExecutive,
}: {
  accountExecutive: AccountExecutive;
}) {
  const utils = api.useUtils();
  const [open, setOpen] = React.useState(false);

  const editAccountExecutive =
    api.accountExecutive.editAccountExecutive.useMutation({
      onSuccess: (res) => {
        toast.success(res.message);
        void utils.accountExecutive.getAllAccountExecutives.invalidate();
        setOpen(false);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: accountExecutive.name,
      email: accountExecutive.email,
      baseCommissionRate: accountExecutive.baseCommissionRate * 100,
      tier1CommissionRate: accountExecutive.tier1CommissionRate * 100,
      tier1CashCollectedThreshold: accountExecutive.tier1CashCollectedThreshold,
      tier2CommissionRate: accountExecutive.tier2CommissionRate * 100,
      tier2CashCollectedThreshold: accountExecutive.tier2CashCollectedThreshold,
      tier3CommissionRate: accountExecutive.tier3CommissionRate * 100,
      tier3CashCollectedThreshold: accountExecutive.tier3CashCollectedThreshold,
      tierSystemEnabled: accountExecutive.tierSystemEnabled,
    },
  });

  const tierSystemEnabled = form.watch("tierSystemEnabled");

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    editAccountExecutive.mutate(values);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
            }}
          >
            Edit
          </DropdownMenuItem>
        </DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account Executive</DialogTitle>
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
                <Button type="submit" disabled={editAccountExecutive.isPending}>
                  {editAccountExecutive.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
