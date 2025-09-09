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

export const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required"),
  isAmerican: z.boolean(),
  americanCommissionRate: z.coerce.number({
    invalid_type_error: "American commission rate must be a number",
    required_error: "American commission rate is required",
  }),
  tier1CommissionRate: z.coerce.number({
    invalid_type_error: "Tier 1 commission rate must be a number",
    required_error: "Tier 1 commission rate is required",
  }),
  tier1Threshold: z.coerce.number({
    invalid_type_error: "Tier 1 threshold must be a number",
    required_error: "Tier 1 threshold is required",
  }),
  tier2CommissionRate: z.coerce.number({
    invalid_type_error: "Tier 2 commission rate must be a number",
    required_error: "Tier 2 commission rate is required",
  }),
  tier2Threshold: z.coerce.number({
    invalid_type_error: "Tier 2 threshold must be a number",
    required_error: "Tier 2 threshold is required",
  }),
  tier3CommissionRate: z.coerce.number({
    invalid_type_error: "Tier 3 commission rate must be a number",
    required_error: "Tier 3 commission rate is required",
  }),
  tier3Threshold: z.coerce.number({
    invalid_type_error: "Tier 3 threshold must be a number",
    required_error: "Tier 3 threshold is required",
  }),
});

export function AddAccountManagerDialog() {
  const utils = api.useUtils();

  const addAccountManager = api.accountManager.addAccountManager.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      form.reset();
      void utils.accountManager.getAllAccountManagers.invalidate();
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
      isAmerican: false,
      americanCommissionRate: 1,
      tier1CommissionRate: 2.5,
      tier1Threshold: 99999,
      tier2CommissionRate: 0.5,
      tier2Threshold: 149999,
      tier3CommissionRate: 0.5,
      tier3Threshold: 150000,
    },
  });

  const isAmerican = form.watch("isAmerican");

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("=============> ", values);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Icons.plus className="h-4 w-4" />
          Add Account Manager
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Account Manager</DialogTitle>
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
              <Button type="submit" disabled={addAccountManager.isPending}>
                {addAccountManager.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
