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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
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
      invalid_type_error: "Tier 1 commission rate must be a number",
      required_error: "Tier 1 commission rate is required",
    })
    .min(0.01, "Tier 1 commission rate must be greater than 0"),
  tier2CashCollectedThreshold: z.coerce
    .number({
      invalid_type_error: "Tier 1 cash collected threshold must be a number",
      required_error: "Tier 1 cash collected threshold is required",
    })
    .min(1, "Tier 1 cash collected threshold must be greater than 0"),
  tier3CommissionRate: z.coerce
    .number({
      invalid_type_error: "Tier 1 commission rate must be a number",
      required_error: "Tier 1 commission rate is required",
    })
    .min(0.01, "Tier 1 commission rate must be greater than 0"),
  tier3CashCollectedThreshold: z.coerce
    .number({
      invalid_type_error: "Tier 1 cash collected threshold must be a number",
      required_error: "Tier 1 cash collected threshold is required",
    })
    .min(1, "Tier 1 cash collected threshold must be greater than 0"),
});

export function AccountExecutiveDialog() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      baseCommissionRate: 0.01,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Icons.plus className="h-4 w-4" />
          Add Account Executive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Account Executive</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baseCommissionRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Commission Rate</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="tier1CommissionRate"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Tier 1 Commission Rate</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tier1CashCollectedThreshold"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Tier 1 Cash Collected Threshold</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="tier2CommissionRate"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Tier 2 Commission Rate</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tier2CashCollectedThreshold"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Tier 2 Cash Collected Threshold</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="tier3CommissionRate"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Tier 3 Commission Rate</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tier3CashCollectedThreshold"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Tier 3 Cash Collected Threshold</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
