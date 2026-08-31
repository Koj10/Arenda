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
    "utilities",
    "maintenance",
    "tax",
    "insurance",
    "management",
    "other",
]

INCOME_CATEGORIES = [
    "rent",
    "other",
]

ALL_TRANSACTION_CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES


UTILITY_CRITERIA = [
    "electricity",
    "water",
    "heating",
    "management",
    "garbage",
    "gas",
    "sewerage",
    "cleaning",
]

# Услуги с показаниями счётчиков — делятся по потреблению
METERED_CRITERIA = [
    "electricity",
    "water",
    "gas",
    "sewerage",
]

# Без показаний — доля площади помещения от площади объекта
AREA_CRITERIA = [
    "heating",
    "management",
    "garbage",
    "cleaning",
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


OBJECT_LIMIT_START = 3
OBJECT_LIMIT_PROFI = 30
TENANT_LIMIT_START = 5
TENANT_LIMIT_PROFI = 60
UNIT_LIMIT_PER_OBJECT_START = 4

PLAN_LIMITS = {
    Plan.start.value: {
        "objects": OBJECT_LIMIT_START,
        "tenants": TENANT_LIMIT_START,
        "units": None,
        "units_per_object": UNIT_LIMIT_PER_OBJECT_START,
    },
    Plan.profi.value: {
        "objects": OBJECT_LIMIT_PROFI,
        "tenants": TENANT_LIMIT_PROFI,
        "units": None,
        "units_per_object": None,
    },
    Plan.tenant_free.value: {
        "objects": 0,
        "tenants": 0,
        "units": 0,
        "units_per_object": 0,
    },
    Plan.tenant_reports.value: {
        "objects": 0,
        "tenants": 0,
        "units": 0,
        "units_per_object": 0,
    },
}
