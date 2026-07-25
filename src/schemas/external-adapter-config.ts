import { z } from "zod";

import { CORE_SCHEMA_VERSION } from "./common.js";
import { externalAdapterRegistrationSchema } from "./external-adapter.js";

export const MAX_EXTERNAL_ADAPTER_REGISTRATIONS = 16;

export const externalAdapterConfigurationSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    adapters: z
      .array(externalAdapterRegistrationSchema)
      .max(MAX_EXTERNAL_ADAPTER_REGISTRATIONS),
  })
  .superRefine(({ adapters }, context) => {
    const adapterIds = new Set<string>();
    adapters.forEach(({ adapter }, index) => {
      if (adapterIds.has(adapter.id)) {
        context.addIssue({
          code: "custom",
          message: "Adapter IDs must be unique",
          path: ["adapters", index, "adapter", "id"],
        });
      }
      adapterIds.add(adapter.id);
    });
  });

export type ExternalAdapterConfiguration = z.infer<
  typeof externalAdapterConfigurationSchema
>;
