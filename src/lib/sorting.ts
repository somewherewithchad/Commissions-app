import { z } from "zod";

export const sortSchema = z.array(
  z.object({
    id: z.string(),
    desc: z.boolean(),
  })
);

export type SortInput = z.infer<typeof sortSchema>;

const keywords = ["lastLogin", "jobStatus", "candidatesForReview"];

export function createOrderByClause(sort: SortInput) {
  return sort.map((sortItem) => {
    const direction = sortItem.desc ? "desc" : "asc";
    const shouldApplyNullsLast = keywords.some((keyword) =>
      sortItem.id.includes(keyword)
    );

    const orderByValue = shouldApplyNullsLast
      ? { sort: direction, nulls: "last" }
      : direction;

    if (sortItem.id.startsWith("_count.")) {
      const parts = sortItem.id.split(".");
      if (parts.length === 2 && parts[0] && parts[1]) {
        return {
          [parts[1]]: {
            [parts[0]]: direction,
          },
        };
      }
    }

    if (sortItem.id.includes(".")) {
      const parts = sortItem.id.split(".");
      // Construct nested object from inside out
      return parts.reduceRight((acc, part, index) => {
        if (index === parts.length - 1) {
          return {
            [part]: orderByValue,
          };
        }
        return {
          [part]: acc,
        };
      }, {});
    }
    return {
      [sortItem.id]: orderByValue,
    };
  });
}
