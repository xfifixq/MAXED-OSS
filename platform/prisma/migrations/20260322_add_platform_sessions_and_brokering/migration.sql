-- CreateTable
CREATE TABLE "PlatformSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "teamMemberId" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProvisioningRun" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "requestedById" TEXT,
  "summary" TEXT,
  "outputJson" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceProvisioningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBrokerSession" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "platformSessionId" TEXT,
  "targetPath" TEXT,
  "state" TEXT NOT NULL DEFAULT 'created',
  "payloadJson" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceBrokerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSession_tokenHash_key" ON "PlatformSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PlatformSession_teamMemberId_idx" ON "PlatformSession"("teamMemberId");

-- CreateIndex
CREATE INDEX "PlatformSession_firmId_idx" ON "PlatformSession"("firmId");

-- CreateIndex
CREATE INDEX "ServiceProvisioningRun_firmId_service_idx" ON "ServiceProvisioningRun"("firmId", "service");

-- CreateIndex
CREATE INDEX "ServiceBrokerSession_firmId_service_idx" ON "ServiceBrokerSession"("firmId", "service");

-- CreateIndex
CREATE INDEX "ServiceBrokerSession_platformSessionId_idx" ON "ServiceBrokerSession"("platformSessionId");

-- AddForeignKey
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProvisioningRun" ADD CONSTRAINT "ServiceProvisioningRun_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProvisioningRun" ADD CONSTRAINT "ServiceProvisioningRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBrokerSession" ADD CONSTRAINT "ServiceBrokerSession_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBrokerSession" ADD CONSTRAINT "ServiceBrokerSession_platformSessionId_fkey" FOREIGN KEY ("platformSessionId") REFERENCES "PlatformSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
