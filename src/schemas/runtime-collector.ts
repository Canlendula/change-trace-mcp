import { z } from "zod";

import { repositoryPathSchema } from "./common.js";

const manifestPathSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => value !== "." && !value.endsWith("/"), {
    message: "Manifest path must identify a file",
  })
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !/^[A-Za-z]:/u.test(value) &&
      !value.includes("\\"),
    {
      message: "Manifest path must be repository-relative",
    },
  )
  .refine(
    (value) =>
      !value
        .split("/")
        .some(
          (segment) =>
            segment === "" || segment === "." || segment === "..",
        ),
    {
      message: "Manifest path contains a forbidden segment",
    },
  )
  .refine(
    (value) =>
      !value
        .split("/")
        .some(
          (segment) =>
            segment
              .replace(/[. ]+$/u, "")
              .toLowerCase() === ".git",
        ),
    {
      message: "Manifest path cannot enter Git metadata",
    },
  )
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
    message: "Manifest path cannot contain control characters",
  });

export const collectRuntimeEvidenceInputSchema = z.strictObject({
  repositoryPath: repositoryPathSchema,
  manifestPath: manifestPathSchema,
});

export type CollectRuntimeEvidenceInput = z.infer<
  typeof collectRuntimeEvidenceInputSchema
>;
