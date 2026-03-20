'use client';

type JsonRecord = Record<string, unknown>;

const COLLECTION_KEYS = ['data', 'results', 'items', 'documents', 'accounts', 'transactions', 'templates', 'submissions', 'workflows', 'executions', 'dashboards', 'questions'];

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function extractCollection(value: unknown, keys: string[] = COLLECTION_KEYS): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0);
  }

  const record = asRecord(value);
  for (const key of keys) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0);
    }
    if (nested && typeof nested === 'object') {
      const nestedRecord = asRecord(nested);
      for (const innerKey of keys) {
        if (Array.isArray(nestedRecord[innerKey])) {
          return (nestedRecord[innerKey] as unknown[])
            .map((item) => asRecord(item))
            .filter((item) => Object.keys(item).length > 0);
        }
      }
    }
  }

  return [];
}

function firstDefined(values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function stringValue(...values: unknown[]): string {
  const value = firstDefined(values);
  return value === undefined || value === null ? '' : String(value);
}

function numberValue(...values: unknown[]): number {
  const value = firstDefined(values);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function boolValue(...values: unknown[]): boolean {
  const value = firstDefined(values);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return ['true', '1', 'active', 'yes'].includes(value.toLowerCase());
  return false;
}

function dateValue(...values: unknown[]): string | null {
  const value = firstDefined(values);
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatNumber(amount: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(date: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!date) return 'Not available';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Not available';

  return parsed.toLocaleDateString(
    'en-US',
    options || { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

export function formatDateTime(date: string | null | undefined) {
  if (!date) return 'Not available';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Not available';

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDurationMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

export interface FirmDocumentRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string | null;
  paperlessDocId: string | null;
}

export interface FirmInvoiceRecord {
  id: string;
  amount: number;
  status: string;
  dueDate: string | null;
  createdAt: string | null;
  invoiceNinjaId: string | null;
}

export interface FirmMessageRecord {
  id: string;
  content: string;
  senderType: string;
  createdAt: string | null;
}

export interface FirmClientRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessType: string;
  annualRevenue: number;
  employeeCount: number;
  bigcapitalId: string | null;
  paperlessTag: string | null;
  invoiceNinjaId: string | null;
  createdAt: string | null;
  documents: FirmDocumentRecord[];
  invoices: FirmInvoiceRecord[];
  messages: FirmMessageRecord[];
}

export function normalizeFirmClients(value: unknown): FirmClientRecord[] {
  return extractCollection(value, ['clients', 'data', 'results']).map((item) => ({
    id: stringValue(item.id),
    name: stringValue(item.name || item.business_name || item.display_name || 'Client'),
    email: stringValue(item.email),
    phone: stringValue(item.phone),
    businessType: stringValue(item.businessType || item.business_type || 'Unclassified'),
    annualRevenue: numberValue(item.annualRevenue || item.annual_revenue),
    employeeCount: numberValue(item.employeeCount || item.employee_count),
    bigcapitalId: stringValue(item.bigcapitalId || item.bigcapital_id) || null,
    paperlessTag: stringValue(item.paperlessTag || item.paperless_tag) || null,
    invoiceNinjaId: stringValue(item.invoiceNinjaId || item.invoice_ninja_id) || null,
    createdAt: dateValue(item.createdAt || item.created_at),
    documents: extractCollection(item.documents, ['documents', 'data']).map((doc) => ({
      id: stringValue(doc.id),
      title: stringValue(doc.title || doc.name || 'Untitled document'),
      type: stringValue(doc.type || 'Document'),
      status: stringValue(doc.status || 'uploaded'),
      createdAt: dateValue(doc.createdAt || doc.created_at),
      paperlessDocId: stringValue(doc.paperlessDocId || doc.paperless_doc_id) || null,
    })),
    invoices: extractCollection(item.invoices, ['invoices', 'data']).map((invoice) => ({
      id: stringValue(invoice.id),
      amount: numberValue(invoice.amount),
      status: stringValue(invoice.status || 'draft'),
      dueDate: dateValue(invoice.dueDate || invoice.due_date),
      createdAt: dateValue(invoice.createdAt || invoice.created_at),
      invoiceNinjaId: stringValue(invoice.invoiceNinjaId || invoice.invoice_ninja_id) || null,
    })),
    messages: extractCollection(item.messages, ['messages', 'data']).map((message) => ({
      id: stringValue(message.id),
      content: stringValue(message.content),
      senderType: stringValue(message.senderType || message.sender_type || 'firm'),
      createdAt: dateValue(message.createdAt || message.created_at),
    })),
  }));
}

export interface PaperlessDocument {
  id: string;
  title: string;
  createdAt: string | null;
  correspondent: string;
  documentType: string;
  tags: string[];
  archiveSerialNumber: string;
  originalFileName: string;
}

export interface PaperlessTag {
  id: string;
  name: string;
  documentCount: number;
}

export function normalizePaperlessDocuments(value: unknown): PaperlessDocument[] {
  return uniqueById(
    extractCollection(value, ['results', 'documents', 'data']).map((item) => ({
      id: stringValue(item.id),
      title: stringValue(item.title || item.original_file_name || item.name || 'Untitled document'),
      createdAt: dateValue(item.created || item.created_date || item.createdAt || item.added || item.modified),
      correspondent: stringValue(
        asRecord(item.correspondent).name,
        item.correspondent_name,
        item.correspondent,
      ),
      documentType: stringValue(
        asRecord(item.document_type).name,
        item.document_type_name,
        item.document_type,
      ),
      tags: extractCollection(item.tags, ['results', 'data'])
        .map((tag) => stringValue(tag.name || tag.label || tag.id))
        .filter(Boolean),
      archiveSerialNumber: stringValue(item.archive_serial_number || item.archiveSerialNumber),
      originalFileName: stringValue(item.original_file_name || item.filename || item.file_name),
    })),
  );
}

export function normalizePaperlessTags(value: unknown): PaperlessTag[] {
  return uniqueById(
    extractCollection(value, ['results', 'tags', 'data']).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name || item.label || 'Tag'),
      documentCount: numberValue(item.document_count || item.documents_count || item.count),
    })),
  );
}

export interface DocuSealTemplate {
  id: string;
  name: string;
  updatedAt: string | null;
  fields: number;
  documents: number;
  roles: string[];
}

export interface DocuSealSubmission {
  id: string;
  title: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  templateId: string | null;
  submitters: Array<{ name: string; email: string; role: string }>;
}

export function normalizeDocuSealTemplates(value: unknown): DocuSealTemplate[] {
  return uniqueById(
    extractCollection(value, ['data', 'templates', 'results']).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name || item.title || 'Template'),
      updatedAt: dateValue(item.updated_at || item.updatedAt || item.created_at || item.createdAt),
      fields: extractCollection(item.fields, ['fields', 'data']).length,
      documents: extractCollection(item.documents, ['documents', 'data']).length || numberValue(item.documents_count),
      roles: extractCollection(item.submitters, ['submitters', 'data'])
        .map((submitter) => stringValue(submitter.role || submitter.name))
        .filter(Boolean),
    })),
  );
}

export function normalizeDocuSealSubmissions(value: unknown): DocuSealSubmission[] {
  return uniqueById(
    extractCollection(value, ['data', 'submissions', 'results']).map((item) => ({
      id: stringValue(item.id),
      title: stringValue(item.name || item.title || item.template_name || 'Submission'),
      status: stringValue(item.status || (item.completed_at ? 'completed' : 'pending')).toLowerCase(),
      createdAt: dateValue(item.created_at || item.createdAt),
      updatedAt: dateValue(item.updated_at || item.updatedAt),
      completedAt: dateValue(item.completed_at || item.completedAt),
      templateId: stringValue(item.template_id || asRecord(item.template).id) || null,
      submitters: extractCollection(item.submitters, ['submitters', 'data']).map((submitter) => ({
        name: stringValue(submitter.name || submitter.full_name),
        email: stringValue(submitter.email),
        role: stringValue(submitter.role || 'Signer'),
      })),
    })),
  );
}

export interface LedgerAccount {
  id: string;
  name: string;
  code: string;
  type: string;
  balance: number;
  currency: string;
}

export interface LedgerTransaction {
  id: string;
  date: string | null;
  description: string;
  reference: string;
  contact: string;
  amount: number;
  currency: string;
}

export interface StatementLine {
  label: string;
  amount: number;
}

export function normalizeBigcapitalAccounts(value: unknown): LedgerAccount[] {
  return uniqueById(
    extractCollection(value, ['accounts', 'data', 'results']).map((item) => ({
      id: stringValue(item.id || item.account_id),
      name: stringValue(item.name || item.account_name || item.display_name || 'Account'),
      code: stringValue(item.code || item.account_code),
      type: stringValue(item.accountType || item.account_type || item.type || 'Other'),
      balance: numberValue(item.balance || item.closing_balance || item.amount),
      currency: stringValue(item.currency_code || item.currency || 'USD'),
    })),
  );
}

export function normalizeBigcapitalTransactions(value: unknown): LedgerTransaction[] {
  return uniqueById(
    extractCollection(value, ['transactions', 'data', 'results']).map((item) => {
      const debit = numberValue(item.debit || asRecord(item.entries).debit);
      const credit = numberValue(item.credit || asRecord(item.entries).credit);
      const amount = numberValue(item.amount || item.total || credit - debit || debit - credit);

      return {
        id: stringValue(item.id || item.transaction_id),
        date: dateValue(item.date || item.transaction_date || item.created_at || item.createdAt),
        description: stringValue(item.description || item.note || item.memo || item.reference || 'Transaction'),
        reference: stringValue(item.reference || item.transaction_number || item.number),
        contact: stringValue(
          asRecord(item.contact).display_name,
          asRecord(item.contact).name,
          item.contact_name,
        ),
        amount,
        currency: stringValue(item.currency_code || item.currency || 'USD'),
      };
    }),
  );
}

function flattenStatementLines(value: unknown, bucket: StatementLine[] = []): StatementLine[] {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenStatementLines(entry, bucket));
    return bucket;
  }

  const record = asRecord(value);
  const label = stringValue(record.label || record.name || record.title || record.account_name || record.account || record.description);
  const amount = numberValue(record.total || record.amount || record.value || record.balance);

  if (label) {
    bucket.push({ label, amount });
  }

  Object.values(record).forEach((entry) => {
    if (Array.isArray(entry) || (entry && typeof entry === 'object')) {
      flattenStatementLines(entry, bucket);
    }
  });

  return bucket;
}

export function normalizeBigcapitalStatement(value: unknown): StatementLine[] {
  const lines = flattenStatementLines(value)
    .filter((line) => line.label)
    .map((line) => ({ label: line.label, amount: Number.isFinite(line.amount) ? line.amount : 0 }));

  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = `${line.label}:${line.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function findStatementAmount(lines: StatementLine[], matchers: RegExp[]) {
  const line = lines.find((entry) => matchers.some((matcher) => matcher.test(entry.label.toLowerCase())));
  return line?.amount || 0;
}

export interface MetabaseDashboard {
  id: string;
  name: string;
  description: string;
  updatedAt: string | null;
  collectionId: string;
}

export interface MetabaseQuestion {
  id: string;
  name: string;
  description: string;
  display: string;
  updatedAt: string | null;
}

export interface MetabaseDashboardDetail {
  id: string;
  name: string;
  description: string;
  cards: Array<{ id: string; name: string; display: string }>;
}

export function normalizeMetabaseDashboards(value: unknown): MetabaseDashboard[] {
  return uniqueById(
    extractCollection(value, ['dashboards', 'data', 'results']).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name || item.title || 'Dashboard'),
      description: stringValue(item.description),
      updatedAt: dateValue(item.updated_at || item.updatedAt || item.created_at || item.createdAt),
      collectionId: stringValue(item.collection_id || item.collectionId),
    })),
  );
}

export function normalizeMetabaseQuestions(value: unknown): MetabaseQuestion[] {
  return uniqueById(
    extractCollection(value, ['cards', 'questions', 'data', 'results']).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name || item.title || 'Question'),
      description: stringValue(item.description),
      display: stringValue(item.display || item.visualization_type || 'table'),
      updatedAt: dateValue(item.updated_at || item.updatedAt || item.created_at || item.createdAt),
    })),
  );
}

export function normalizeMetabaseDashboardDetail(value: unknown): MetabaseDashboardDetail | null {
  const record = asRecord(value);
  const id = stringValue(record.id);
  if (!id) return null;

  const cards = extractCollection(record.ordered_cards || record.dashcards, ['ordered_cards', 'dashcards', 'data']).map((item) => {
    const card = asRecord(item.card);
    return {
      id: stringValue(item.id || card.id),
      name: stringValue(card.name || item.name || item.card_name || 'Saved question'),
      display: stringValue(card.display || item.visualization_type || 'table'),
    };
  });

  return {
    id,
    name: stringValue(record.name || record.title || 'Dashboard'),
    description: stringValue(record.description),
    cards,
  };
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string | null;
  createdAt: string | null;
  tags: string[];
}

export interface AutomationExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  startedAt: string | null;
  stoppedAt: string | null;
  durationMinutes: number;
}

export function normalizeN8nWorkflows(value: unknown): AutomationWorkflow[] {
  return uniqueById(
    extractCollection(value, ['data', 'workflows', 'results']).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name || 'Workflow'),
      active: boolValue(item.active),
      updatedAt: dateValue(item.updatedAt || item.updated_at),
      createdAt: dateValue(item.createdAt || item.created_at),
      tags: extractCollection(item.tags, ['tags', 'data']).map((tag) => stringValue(tag.name || tag.id)).filter(Boolean),
    })),
  );
}

export function normalizeN8nExecutions(value: unknown): AutomationExecution[] {
  return uniqueById(
    extractCollection(value, ['data', 'executions', 'results']).map((item) => {
      const startedAt = dateValue(item.startedAt || item.started_at || item.createdAt || item.created_at);
      const stoppedAt = dateValue(item.stoppedAt || item.stopped_at || item.finishedAt || item.finished_at);
      const runData = asRecord(item.runData);
      const durationMs = numberValue(item.executionTime || item.duration || runData.executionTime);

      return {
        id: stringValue(item.id),
        workflowId: stringValue(item.workflowId || item.workflow_id || asRecord(item.workflowData).id),
        workflowName: stringValue(item.workflowName || asRecord(item.workflowData).name || 'Workflow'),
        status: stringValue(item.status || (boolValue(item.finished) ? 'success' : 'running')).toLowerCase(),
        startedAt,
        stoppedAt,
        durationMinutes: durationMs > 0 ? durationMs / 60000 : 0,
      };
    }),
  );
}

export interface TimesheetEntry {
  id: string;
  begin: string | null;
  end: string | null;
  durationMinutes: number;
  description: string;
  projectName: string;
  activityName: string;
  rate: number;
}

export interface KimaiProject {
  id: string;
  name: string;
}

export interface KimaiActivity {
  id: string;
  name: string;
}

export function normalizeKimaiProjects(value: unknown): KimaiProject[] {
  return uniqueById(
    extractCollection(value, ['data', 'projects', 'results']).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name || item.title || 'Project'),
    })),
  );
}

export function normalizeKimaiActivities(value: unknown): KimaiActivity[] {
  return uniqueById(
    extractCollection(value, ['data', 'activities', 'results']).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name || item.title || 'Activity'),
    })),
  );
}

export function normalizeKimaiTimesheets(value: unknown): TimesheetEntry[] {
  return uniqueById(
    extractCollection(value, ['data', 'timesheets', 'results']).map((item) => {
      const begin = dateValue(item.begin || item.start || item.date);
      const end = dateValue(item.end || item.stop);
      const durationSeconds = numberValue(item.duration || item.duration_seconds);
      const metaFields = asRecord(item.metaFields);

      return {
        id: stringValue(item.id),
        begin,
        end,
        durationMinutes: durationSeconds > 0 ? durationSeconds / 60 : 0,
        description: stringValue(item.description || metaFields.description || 'Time entry'),
        projectName: stringValue(asRecord(item.project).name, item.projectName),
        activityName: stringValue(asRecord(item.activity).name, item.activityName),
        rate: numberValue(item.rate || item.hourlyRate || item.internal_rate),
      };
    }),
  );
}
