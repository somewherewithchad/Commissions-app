import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import React from "react";
import { Button } from "@/components/ui/button";
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
import { formSchema } from "@/app/(dashboard)/users/_components/add-account-manager-dialog";
import { type RouterOutputs } from "@/trpc/react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type AccountManager =
  RouterOutputs["accountManager"]["getAllAccountManagers"]["items"][number];

export function EditAccountManagerDialog({
  accountManager,
}: {
  accountManager: AccountManager;
}) {
  const utils = api.useUtils();
  const [open, setOpen] = React.useState(false);

  const editAccountManager = api.accountManager.editAccountManager.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      void utils.accountManager.getAllAccountManagers.invalidate();
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: accountManager.name,
      email: accountManager.email,
      isAmerican: accountManager.isAmerican,
      americanCommissionRate: accountManager.americanCommissionRate * 100,
      tier1CommissionRate: accountManager.tier1CommissionRate * 100,
      tier1Threshold: accountManager.tier1Threshold,
      tier2CommissionRate: accountManager.tier2CommissionRate * 100,
      tier2Threshold: accountManager.tier2Threshold,
      tier3CommissionRate: accountManager.tier3CommissionRate * 100,
      tier3Threshold: accountManager.tier3Threshold,
    },
  });

  const isAmerican = form.watch("isAmerican");

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    editAccountManager.mutate(values);
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
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Account Manager</DialogTitle>
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
                name="isAmerican"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Is American</FormLabel>
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
                name="americanCommissionRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={cn(!isAmerican && "text-muted-foreground")}
                    >
                      American Commission Rate
                    </FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          placeholder="5"
                          className="pr-8"
                          {...field}
                          disabled={!isAmerican}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tier1CommissionRate"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel
                        className={cn(isAmerican && "text-muted-foreground")}
                      >
                        Tier 1 Commission Rate
                        <span className="text-xs text-muted-foreground">
                          (Paid this month)
                        </span>
                      </FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            placeholder="7.5"
                            className="pr-8"
                            {...field}
                            disabled={isAmerican}
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
                  name="tier1Threshold"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel
                        className={cn(isAmerican && "text-muted-foreground")}
                      >
                        Tier 1 Threshold
                        <span className="text-xs text-muted-foreground">
                          ($0 - ${field.value})
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="50000"
                          {...field}
                          disabled={isAmerican}
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
                        className={cn(isAmerican && "text-muted-foreground")}
                      >
                        Tier 2 Commission Rate
                        <span className="text-xs text-muted-foreground">
                          (Paid next month)
                        </span>
                      </FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            placeholder="7.5"
                            className="pr-8"
                            {...field}
                            disabled={isAmerican}
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
                  name="tier2Threshold"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel
                        className={cn(isAmerican && "text-muted-foreground")}
                      >
                        Tier 2 Threshold
                        <span className="text-xs text-muted-foreground">
                          (${Number(form.watch("tier1Threshold")) + 1} - $
                          {field.value})
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="50000"
                          {...field}
                          disabled={isAmerican}
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
                        className={cn(isAmerican && "text-muted-foreground")}
                      >
                        Tier 3 Commission Rate
                        <span className="text-xs text-muted-foreground">
                          (Paid next month)
                        </span>
                      </FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            placeholder="7.5"
                            className="pr-8"
                            {...field}
                            disabled={isAmerican}
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
                  name="tier3Threshold"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel
                        className={cn(isAmerican && "text-muted-foreground")}
                      >
                        Tier 3 Threshold
                        <span className="text-xs text-muted-foreground">
                          (${Number(form.watch("tier2Threshold")) + 1}+)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="50000"
                          {...field}
                          disabled={isAmerican}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editAccountManager.isPending}>
                  {editAccountManager.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
