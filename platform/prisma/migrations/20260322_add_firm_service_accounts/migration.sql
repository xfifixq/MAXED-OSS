CREATE TABLE "FirmServiceAccount" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "teamMemberId" TEXT,
  "service" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FirmServiceAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FirmServiceAccount_firmId_service_role_key" ON "FirmServiceAccount"("firmId", "service", "role");

ALTER TABLE "FirmServiceAccount"
ADD CONSTRAINT "FirmServiceAccount_firmId_fkey"
FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FirmServiceAccount"
ADD CONSTRAINT "FirmServiceAccount_teamMemberId_fkey"
FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
