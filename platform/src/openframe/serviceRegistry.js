function generateStrongPassword(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return password;
}

function slugifyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

const SERVICES = {
  paperless: process.env.PAPERLESS_URL || "http://localhost:8000",
  docuseal: process.env.DOCUSEAL_URL || "http://localhost:3003",
  invoiceninja: process.env.INVOICE_NINJA_URL || "http://localhost:8080",
  n8n: process.env.N8N_URL || "http://localhost:5678",
  kimai: process.env.KIMAI_URL || "http://localhost:8001",
  mattermost: process.env.MATTERMOST_URL || "http://localhost:8065",
  metabase: process.env.METABASE_URL || "http://localhost:3002",
  twenty: process.env.TWENTY_URL || "http://localhost:3004",
  bigcapital: process.env.BIGCAPITAL_URL || "http://localhost:3000",
};

const PUBLIC_SERVICES = {
  paperless: process.env.PAPERLESS_PUBLIC_URL || "https://docs.maxed.life",
  docuseal: process.env.DOCUSEAL_PUBLIC_URL || "https://sign.maxed.life",
  invoiceninja: process.env.INVOICE_NINJA_PUBLIC_URL || "https://billing.maxed.life",
  n8n: process.env.N8N_PUBLIC_URL || "https://flow.maxed.life",
  kimai: process.env.KIMAI_PUBLIC_URL || "https://time.maxed.life",
  bigcapital: process.env.BIGCAPITAL_PUBLIC_URL || "https://books.maxed.life",
  twenty: process.env.TWENTY_PUBLIC_URL || "https://crm.maxed.life",
  metabase: process.env.METABASE_PUBLIC_URL || "https://reports.maxed.life",
  mattermost: process.env.MATTERMOST_PUBLIC_URL || "https://chat.maxed.life",
};

const SERVICE_CATALOG = {
  paperless: {
    key: "paperless",
    name: "Paperless",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "firm_credentials",
    isolationNote: "Separate firm credentials exist, but this still runs inside a shared Paperless instance.",
    preferredAction: "signin_or_admin",
    setupPath: "",
    adminPath: "",
    note: "Paperless can stay embedded once firm credentials exist.",
  },
  docuseal: {
    key: "docuseal",
    name: "DocuSeal",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "firm_credentials",
    isolationNote: "Separate firm credentials and tokens exist, but DocuSeal still sits behind one shared Maxed deployment.",
    preferredAction: "signin_or_admin",
    setupPath: "",
    adminPath: "",
    note: "DocuSeal remains embedded when the workspace is already initialized.",
  },
  invoiceninja: {
    key: "invoiceninja",
    name: "Invoice Ninja",
    provisioningMode: "bootstrap_then_admin",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "shared_instance_admin_managed",
    isolationNote: "CPA staff users can be separate, but Invoice Ninja still needs strong company-level admin discipline inside one shared instance.",
    preferredAction: "setup_then_user_management",
    setupPath: "/setup",
    adminPath: "/#/settings/user_management",
    note: "Invoice Ninja needs first-run setup before CPA staff users can be created from User Management.",
  },
  n8n: {
    key: "n8n",
    name: "n8n",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: false,
    isolationTier: "admin_backend_only",
    isolationNote: "n8n should stay a Maxed backend automation surface, not a CPA-facing shared workspace.",
    preferredAction: "setup_owner_then_api_key",
    setupPath: "/setup",
    adminPath: "",
    note: "n8n exposes an owner setup flow on fresh instances and can stay embedded for that workflow.",
  },
  kimai: {
    key: "kimai",
    name: "Kimai",
    provisioningMode: "bootstrap_then_admin",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "shared_instance_admin_managed",
    isolationNote: "Kimai users can be separate per firm, but it still operates inside one shared instance and needs admin oversight.",
    preferredAction: "first_admin_then_users",
    setupPath: "",
    adminPath: "/en/admin/user/",
    note: "Kimai may require a first super-admin from bootstrap or CLI before normal user provisioning works.",
  },
  mattermost: {
    key: "mattermost",
    name: "Mattermost",
    provisioningMode: "config_or_signup",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "shared_instance_team_scoped",
    isolationNote: "Mattermost should be treated as team-scoped inside one shared server, not as a fully isolated per-firm tenant.",
    preferredAction: "enable_signup_or_admin_create",
    setupPath: "/signup_email",
    adminPath: "/admin_console/user_management/users",
    note: "Mattermost public signup depends on server-wide account creation settings.",
  },
  metabase: {
    key: "metabase",
    name: "Metabase",
    provisioningMode: "bootstrap_then_admin",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "admin_backend_only",
    isolationNote: "Metabase should stay a reporting backend and admin surface. Do not treat the upstream UI as a CPA tenant boundary.",
    preferredAction: "setup_then_invite",
    setupPath: "/setup",
    adminPath: "/admin/people",
    note: "Metabase requires the first admin during setup, and only after that can firm users be invited.",
  },
  twenty: {
    key: "twenty",
    name: "Twenty CRM",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: false,
    isolationTier: "workspace_scoped",
    isolationNote: "Twenty is closer to a real workspace boundary, but Maxed should still own the CPA-facing experience.",
    preferredAction: "signup",
    setupPath: "/sign-up",
    adminPath: "",
    note: "Twenty remains embedded because its signup flow already behaves correctly in Maxed.",
  },
  bigcapital: {
    key: "bigcapital",
    name: "Bigcapital",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "workspace_scoped",
    isolationNote: "Bigcapital is closer to a firm workspace boundary, but should still be treated as infrastructure behind Maxed.",
    preferredAction: "signup_or_admin",
    setupPath: "/auth/register",
    adminPath: "/admin/users",
    note: "Bigcapital keeps a direct signup flow through Maxed's embedded path.",
  },
};

const SERVICE_WORKSPACE_PATHS = {
  paperless: "/dashboard/documents",
  docuseal: "/dashboard/proposals",
  invoiceninja: "/dashboard/invoicing",
  n8n: "/dashboard/workflows",
  kimai: "/dashboard/time-tracking",
  bigcapital: "/dashboard/bookkeeping",
  twenty: "/dashboard/crm",
  metabase: "/dashboard/reporting",
  mattermost: "/dashboard/chat",
};

const SERVICE_ACCESS_CAPABILITIES = {
  paperless: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  docuseal: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  invoiceninja: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  n8n: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_owner_handoff",
  },
  kimai: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  bigcapital: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  twenty: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  metabase: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  mattermost: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
};

const SERVICE_PROVISIONING_ADAPTERS = {
  paperless: {
    key: "paperless",
    automatic: true,
    strategy: "maxed_managed_identity_seed",
    canBrokerBrowserSession: false,
  },
  docuseal: {
    key: "docuseal",
    automatic: true,
    strategy: "maxed_managed_identity_seed",
    canBrokerBrowserSession: false,
  },
  invoiceninja: {
    key: "invoiceninja",
    automatic: true,
    strategy: "bootstrap_then_maxed_identity_seed",
    canBrokerBrowserSession: false,
  },
  n8n: {
    key: "n8n",
    automatic: true,
    strategy: "owner_then_api_key_seed",
    canBrokerBrowserSession: false,
  },
  kimai: {
    key: "kimai",
    automatic: true,
    strategy: "bootstrap_then_maxed_identity_seed",
    canBrokerBrowserSession: false,
  },
  bigcapital: {
    key: "bigcapital",
    automatic: true,
    strategy: "workspace_identity_seed",
    canBrokerBrowserSession: false,
  },
  twenty: {
    key: "twenty",
    automatic: true,
    strategy: "workspace_identity_seed",
    canBrokerBrowserSession: false,
  },
  metabase: {
    key: "metabase",
    automatic: true,
    strategy: "bootstrap_then_maxed_identity_seed",
    canBrokerBrowserSession: false,
  },
  mattermost: {
    key: "mattermost",
    automatic: true,
    strategy: "bootstrap_then_maxed_identity_seed",
    canBrokerBrowserSession: false,
  },
};

const SERVICE_DEFAULT_TOKENS = {
  paperless: "PAPERLESS_API_TOKEN",
  docuseal: "DOCUSEAL_API_TOKEN",
  n8n: "N8N_API_KEY",
  bigcapital: "BIGCAPITAL_API_TOKEN",
  twenty: "TWENTY_API_KEY",
};

function getPublicServiceUrl(service) {
  return PUBLIC_SERVICES[service] || null;
}

function buildPublicServiceUrl(service, routePath = "") {
  const baseUrl = getPublicServiceUrl(service);
  if (!baseUrl) return null;
  if (!routePath) return baseUrl;
  return `${String(baseUrl).replace(/\/$/, "")}${routePath}`;
}

function getMaxedWorkspaceUrl(service) {
  const workspacePath = SERVICE_WORKSPACE_PATHS[service] || "/dashboard";
  return `https://app.maxed.life${workspacePath}`;
}

function getServiceIdentityShape(serviceKey) {
  switch (serviceKey) {
    case "invoiceninja":
    case "kimai":
    case "metabase":
      return {
        accountType: "bootstrap_admin_then_cpa_user",
        bootstrapRequired: true,
        summary: "Shared admin bootstraps the workspace, then creates a dedicated CPA user.",
      };
    case "mattermost":
    case "bigcapital":
    case "twenty":
      return {
        accountType: "direct_cpa_user_or_admin_create",
        bootstrapRequired: false,
        summary: "CPA user can usually sign up directly, or be created by an admin using the same email identity.",
      };
    case "n8n":
      return {
        accountType: "workspace_owner_plus_api_key",
        bootstrapRequired: true,
        summary: "Owner bootstraps the workspace, then Maxed stores the API key used for automation.",
      };
    default:
      return {
        accountType: "admin_managed_cpa_user",
        bootstrapRequired: false,
        summary: "Admin creates or confirms the CPA user, then Maxed stores the resulting credentials.",
      };
  }
}

function buildCanonicalIdentity(firm, teamMembers = []) {
  const sortedMembers = [...teamMembers].sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const primaryMember = sortedMembers.find((member) => member.role !== "admin") || sortedMembers[0] || null;
  const fallbackEmail = String(firm.email || "").trim().toLowerCase();
  const primaryEmail = primaryMember?.email || fallbackEmail || `${slugifyName(firm.name)}@maxed.local`;

  return {
    primaryMember: primaryMember
      ? {
          id: primaryMember.id,
          name: primaryMember.name,
          email: primaryMember.email,
          role: primaryMember.role,
        }
      : null,
    canonicalEmail: primaryEmail,
    canonicalUsername: primaryEmail.split("@")[0] || slugifyName(firm.name) || "firm",
    bootstrapRoleLabel: "Platform bootstrap admin",
    cpaRoleLabel: primaryMember?.role === "admin" ? "Firm admin user" : "Primary CPA user",
  };
}

function buildSuggestedServiceCredential(firm, identity, service) {
  const baseEmail = String(identity.canonicalEmail || firm.email || "").trim().toLowerCase();
  const emailParts = baseEmail.includes("@") ? baseEmail.split("@") : [slugifyName(firm.name), "maxed.local"];
  const localPart = emailParts[0] || slugifyName(firm.name) || "firm";
  const domainPart = emailParts[1] || "maxed.local";
  const slug = slugifyName(firm.name) || "firm";

  const defaults = {
    username: baseEmail || `${localPart}@${domainPart}`,
    password: generateStrongPassword(),
    token: "",
    metadata: "",
  };

  if (service === "mattermost") defaults.metadata = baseEmail || "";
  if (service === "bigcapital") defaults.metadata = slug;
  if (service === "n8n") defaults.username = baseEmail || `${slug}@${domainPart}`;

  return defaults;
}

module.exports = {
  SERVICES,
  PUBLIC_SERVICES,
  SERVICE_CATALOG,
  SERVICE_WORKSPACE_PATHS,
  SERVICE_ACCESS_CAPABILITIES,
  SERVICE_PROVISIONING_ADAPTERS,
  SERVICE_DEFAULT_TOKENS,
  slugifyName,
  generateStrongPassword,
  getPublicServiceUrl,
  buildPublicServiceUrl,
  getMaxedWorkspaceUrl,
  getServiceIdentityShape,
  buildCanonicalIdentity,
  buildSuggestedServiceCredential,
};
