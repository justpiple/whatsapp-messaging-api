-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "ApiKeyRole" AS ENUM ('ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WhatsappAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" SERIAL NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" "WhatsappAccountStatus" NOT NULL DEFAULT 'INACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" SERIAL NOT NULL,
    "identifier" VARCHAR(255) NOT NULL,
    "data" TEXT NOT NULL,
    "whatsapp_account_id" INTEGER NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sent_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "send_by" INTEGER NOT NULL,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "role" "ApiKeyRole" NOT NULL DEFAULT 'SYSTEM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_accounts_phone_number_key" ON "whatsapp_accounts"("phone_number");

-- CreateIndex
CREATE INDEX "session_whatsapp_account_id_idx" ON "session"("whatsapp_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_whatsapp_account_id_identifier_key" ON "session"("whatsapp_account_id", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_api_key_key" ON "api_keys"("api_key");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_whatsapp_account_id_fkey" FOREIGN KEY ("whatsapp_account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_send_by_fkey" FOREIGN KEY ("send_by") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
