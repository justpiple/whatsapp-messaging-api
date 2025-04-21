import { PrismaClient } from "@prisma/client";
import { createSoftDeleteExtension } from "prisma-extension-soft-delete";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

if (globalForPrisma.prisma) {
  globalForPrisma.prisma.$extends(
    createSoftDeleteExtension({
      models: {
        WhatsappAccount: true,
        ApiKey: true,
      },
      defaultConfig: {
        field: "deletedAt",
        createValue: (deleted) => {
          if (deleted) return new Date();
          return null;
        },
      },
    }),
  );
}

export default prisma;
