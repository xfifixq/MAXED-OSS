-- CreateTable
CREATE TABLE "ServiceCredential" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "token" TEXT,
    "username" TEXT,
    "password" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCredential_firmId_service_key" ON "ServiceCredential"("firmId", "service");

-- AddForeignKey
ALTER TABLE "ServiceCredential" ADD CONSTRAINT "ServiceCredential_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
