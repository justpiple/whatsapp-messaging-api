-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "identifier" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "whatsapp_account_id" INTEGER NOT NULL,
    CONSTRAINT "session_whatsapp_account_id_fkey" FOREIGN KEY ("whatsapp_account_id") REFERENCES "whatsapp_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recipient_account_map" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipient_number" TEXT NOT NULL,
    "whatsapp_account_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "recipient_account_map_whatsapp_account_id_fkey" FOREIGN KEY ("whatsapp_account_id") REFERENCES "whatsapp_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SYSTEM',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE INDEX "session_whatsapp_account_id_idx" ON "session"("whatsapp_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_whatsapp_account_id_identifier_key" ON "session"("whatsapp_account_id", "identifier");

-- CreateIndex
CREATE INDEX "recipient_account_map_whatsapp_account_id_idx" ON "recipient_account_map"("whatsapp_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_account_map_recipient_number_key" ON "recipient_account_map"("recipient_number");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_api_key_key" ON "api_keys"("api_key");
