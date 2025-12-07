import { ApiKeyRole, PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient({
  datasources: { db: { url: "file:../database.db" } },
});

async function main() {
  const existingAdminKey = await prisma.apiKey.findFirst({
    where: {
      role: ApiKeyRole.ADMIN,
      deletedAt: null,
    },
  });

  if (existingAdminKey) {
    console.log("Admin API Key already exists");
  } else {
    const adminKey = await prisma.apiKey.create({
      data: {
        name: "Admin API Key",
        apiKey: process.env.API_ADMIN_KEY || "admin-api-key-secret",
        role: ApiKeyRole.ADMIN,
      },
    });
    console.log("Admin API Key created:", adminKey.apiKey);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
