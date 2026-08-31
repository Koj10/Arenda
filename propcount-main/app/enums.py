from enum import Enum


class Role(str, Enum):
    landlord = "landlord"
    tenant = "tenant"


class ObjectType(str, Enum):
    office = "office"
    retail = "retail"
    warehouse = "warehouse"


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"


EXPENSE_CATEGORIES = [
    "коммунальные",
    "ремонт и обслуживание",
    "налоги и сборы",
    "страхование",
    "прочее",
]

INCOME_CATEGORIES = [
    "аренда",
    "прочее",
]

ALL_TRANSACTION_CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES


UTILITY_CRITERIA = [
    "электроэнергия",
    "вода гор/хол",
    "теплофикация",
    "управляющая компания",
    "вывоз мусора",
    "газ",
    "канализация",
    "уборка рядом",
]


class Payer(str, Enum):
    landlord = "landlord"
    tenant = "tenant"


class FileKind(str, Enum):
    title = "title"
    service = "service"
    supporting = "supporting"
    contract = "contract"


class FileLinkedType(str, Enum):
    transaction = "transaction"
    object = "object"
    lease = "lease"
    invoice = "invoice"


class Plan(str, Enum):
    start = "start"
    profi = "profi"
    tenant_free = "tenant_free"
    tenant_reports = "tenant_reports"


LANDLORD_PLANS = [Plan.start.value, Plan.profi.value]
TENANT_PLANS = [Plan.tenant_free.value, Plan.tenant_reports.value]


class SubscriptionStatus(str, Enum):
    active = "active"
    canceled = "canceled"
    past_due = "past_due"


class InvoiceKind(str, Enum):
    utility = "utility"
    rent = "rent"


class InvoiceStatus(str, Enum):
    pending = "pending"
    paid = "paid"


OBJECT_LIMIT_START = 10
TENANT_LIMIT_START = 10
UNIT_LIMIT_PROFI = 30

PLAN_LIMITS = {
    Plan.start.value: {
        "objects": OBJECT_LIMIT_START,
        "tenants": TENANT_LIMIT_START,
        "units": 0,
    },
    Plan.profi.value: {
        "objects": OBJECT_LIMIT_START,
        "tenants": TENANT_LIMIT_START,
        "units": UNIT_LIMIT_PROFI,
    },
    Plan.tenant_free.value: {
        "objects": 0,
        "tenants": 0,
        "units": 0,
    },
    Plan.tenant_reports.value: {
        "objects": 0,
        "tenants": 0,
        "units": 0,
    },
}
