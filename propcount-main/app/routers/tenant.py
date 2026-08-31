from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.api.deps import AuthContext, require_tenant
from app.db import get_session
from app.enums import Plan, Role
from app.schemas.tenant_panel import (
    TenantInvoicesResponse,
    TenantReportResponse,
    TenantSpacesResponse,
    TenantSubscriptionResponse,
)
from app.services import tenant_panel as tenant_panel_service
from app.services.users import get_or_create_subscription

router = APIRouter(prefix="/tenant")


@router.get(
    "/spaces",
    summary="Список помещений",
    response_model=TenantSpacesResponse,
)
def tenant_spaces(
    auth: AuthContext = Depends(require_tenant),
    session: Session = Depends(get_session),
):
    return tenant_panel_service.get_tenant_spaces(session, auth.user.id)


@router.get(
    "/invoices",
    summary="Список счетов",
    response_model=TenantInvoicesResponse,
)
def tenant_invoices(
    status: Optional[str] = None,
    auth: AuthContext = Depends(require_tenant),
    session: Session = Depends(get_session),
):
    return tenant_panel_service.get_tenant_invoices(
        session,
        auth.user.id,
        status,
    )


@router.get(
    "/reports",
    summary="Отчеты",
    response_model=TenantReportResponse,
)
def tenant_reports(
    tab: str,
    period: str,
    auth: AuthContext = Depends(require_tenant),
    session: Session = Depends(get_session),
):
    return tenant_panel_service.get_tenant_report(
        session,
        auth.user.id,
        tab,
        period,
    )


@router.get(
    "/reports/export",
    summary="Экспорт отчета",
)
def tenant_reports_export(
    tab: str,
    period: str,
    fields: Optional[str] = None,
    auth: AuthContext = Depends(require_tenant),
    session: Session = Depends(get_session),
):
    subscription = get_or_create_subscription(
        session=session,
        user_id=auth.user.id,
        role=Role.tenant.value,
    )

    if subscription.plan != Plan.tenant_reports.value:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Tenant reports export requires tenant_reports subscription",
        )

    report = tenant_panel_service.get_tenant_report(
        session,
        auth.user.id,
        tab,
        period,
    )

    output = tenant_panel_service.tenant_report_to_xlsx_bytes(report, fields)

    filename = f"tenant_report_{tab}_{period}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get(
    "/subscription",
    summary="Подписка",
    response_model=TenantSubscriptionResponse,
)
def tenant_subscription(
    auth: AuthContext = Depends(require_tenant),
    session: Session = Depends(get_session),
):
    return tenant_panel_service.get_tenant_subscription_response(
        session,
        auth.user.id,
    )


@router.post(
    "/subscription/upgrade",
    summary="Улучшение подписки",
    response_model=TenantSubscriptionResponse,
)
def tenant_subscription_upgrade(
    auth: AuthContext = Depends(require_tenant),
    session: Session = Depends(get_session),
):
    return tenant_panel_service.upgrade_tenant_subscription(
        session,
        auth.user.id,
    )
