const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Maxed unified database...");
  const bcrypt = require("bcryptjs");
  const defaultPasswordHash = await bcrypt.hash("maxed2024", 10);

  // ---- Firm ----------------------------------------------------------------
  const firm = await prisma.firm.create({
    data: {
      name: "James CPA LLC",
      email: "james@jamescpa.com",
      phone: "(555) 432-1000",
      plan: "professional",
    },
  });
  console.log(`Created firm: ${firm.name}`);

  // ---- Team Member ---------------------------------------------------------
  const admin = await prisma.teamMember.create({
    data: {
      firmId: firm.id,
      name: "James Carter",
      email: "james@jamescpa.com",
      role: "admin",
      passwordHash: defaultPasswordHash,
    },
  });
  console.log(`Created team member: ${admin.name}`);

  // ---- Clients -------------------------------------------------------------
  const clientsData = [
    {
      name: "Riverside Bakery LLC",
      email: "anna@riversidebakery.com",
      phone: "(555) 101-2001",
      businessType: "Food & Beverage",
      annualRevenue: 420000,
      employeeCount: 12,
    },
    {
      name: "Summit Tech Solutions Inc",
      email: "mike@summittech.io",
      phone: "(555) 202-3002",
      businessType: "Technology",
      annualRevenue: 1850000,
      employeeCount: 35,
    },
    {
      name: "GreenLeaf Landscaping",
      email: "carlos@greenleafls.com",
      phone: "(555) 303-4003",
      businessType: "Landscaping & Maintenance",
      annualRevenue: 310000,
      employeeCount: 8,
    },
    {
      name: "Dr. Patel Family Medicine",
      email: "office@patelfm.com",
      phone: "(555) 404-5004",
      businessType: "Healthcare",
      annualRevenue: 980000,
      employeeCount: 15,
    },
    {
      name: "Harbor Real Estate Group",
      email: "lisa@harborre.com",
      phone: "(555) 505-6005",
      businessType: "Real Estate",
      annualRevenue: 2400000,
      employeeCount: 22,
    },
  ];

  const clients = [];
  for (const data of clientsData) {
    const client = await prisma.client.create({
      data: { ...data, firmId: firm.id },
    });
    clients.push(client);
    console.log(`Created client: ${client.name}`);
  }

  // ---- Documents -----------------------------------------------------------
  const documentsData = [
    { clientId: clients[0].id, title: "2024 Federal Tax Return", type: "tax_return", status: "filed" },
    { clientId: clients[0].id, title: "Q4 2024 Profit & Loss", type: "financial_statement", status: "reviewed" },
    { clientId: clients[1].id, title: "2024 Corporate Tax Return", type: "tax_return", status: "in_review" },
    { clientId: clients[1].id, title: "R&D Tax Credit Documentation", type: "tax_credit", status: "uploaded" },
    { clientId: clients[1].id, title: "Stock Option Plan 2025", type: "compensation", status: "uploaded" },
    { clientId: clients[2].id, title: "2024 Schedule C", type: "tax_return", status: "filed" },
    { clientId: clients[2].id, title: "Vehicle Mileage Log 2024", type: "expense_report", status: "reviewed" },
    { clientId: clients[3].id, title: "2024 Partnership Return", type: "tax_return", status: "in_review" },
    { clientId: clients[3].id, title: "Medical Equipment Depreciation Schedule", type: "depreciation", status: "uploaded" },
    { clientId: clients[4].id, title: "2024 S-Corp Return", type: "tax_return", status: "draft" },
  ];

  for (const data of documentsData) {
    await prisma.document.create({ data });
  }
  console.log(`Created ${documentsData.length} documents`);

  // ---- Invoices ------------------------------------------------------------
  const invoicesData = [
    { clientId: clients[0].id, amount: 1500, status: "paid", dueDate: new Date("2025-02-15"), paidDate: new Date("2025-02-10") },
    { clientId: clients[1].id, amount: 4500, status: "sent", dueDate: new Date("2025-03-01") },
    { clientId: clients[2].id, amount: 1200, status: "paid", dueDate: new Date("2025-01-30"), paidDate: new Date("2025-01-28") },
    { clientId: clients[3].id, amount: 3200, status: "draft", dueDate: new Date("2025-04-01") },
    { clientId: clients[4].id, amount: 5800, status: "sent", dueDate: new Date("2025-03-15") },
  ];

  for (const data of invoicesData) {
    await prisma.invoice.create({ data });
  }
  console.log(`Created ${invoicesData.length} invoices`);

  // ---- Scenarios -----------------------------------------------------------
  const scenariosData = [
    {
      clientId: clients[0].id,
      question: "Should the bakery switch from sole proprietorship to S-Corp to reduce self-employment tax?",
      optionChosen: "Convert to S-Corp",
      outcome: "Estimated $8,400/yr savings in self-employment tax with reasonable salary of $55,000",
      projectedImpact: 8400,
    },
    {
      clientId: clients[1].id,
      question: "What is the potential R&D tax credit for the new AI product development expenses?",
      optionChosen: null,
      outcome: null,
      projectedImpact: 62000,
    },
    {
      clientId: clients[3].id,
      question: "Should Dr. Patel purchase or lease the new diagnostic imaging equipment ($180,000)?",
      optionChosen: "Section 179 purchase",
      outcome: "Full first-year deduction under Section 179, reducing taxable income by $180,000",
      projectedImpact: 45000,
    },
  ];

  for (const data of scenariosData) {
    await prisma.scenario.create({ data });
  }
  console.log(`Created ${scenariosData.length} scenarios`);

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
