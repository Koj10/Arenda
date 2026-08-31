from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.api.deps import AuthContext, require_landlord
from app.db import get_session
from app.schemas.reports import ReportResponse
from app.services import reports as reports_service

router = APIRouter(prefix="/landlord")


@router.get(
    "/reports",
    summary="Отчет по объекту",
    response_model=ReportResponse,
)
def landlord_reports(
    period: str,
    object_id: Optional[int] = None,
    unit_id: Optional[int] = None,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    return reports_service.get_landlord_report(
        session=session,
        user_id=auth.user.id,
        period=period,
        object_id=object_id,
        unit_id=unit_id,
    )


@router.get(
    "/reports/export",
    summary="Экспорт отчета",
)
def landlord_reports_export(
    period: str,
    object_id: Optional[int] = None,
    unit_id: Optional[int] = None,
    fields: Optional[str] = None,
    auth: AuthContext = Depends(require_landlord),
    session: Session = Depends(get_session),
):
    report = reports_service.get_landlord_report(
        session=session,
        user_id=auth.user.id,
        period=period,
        object_id=object_id,
        unit_id=unit_id,
    )

    output = reports_service.report_to_xlsx_bytes(report, fields)

    filename = f"landlord_report_{period}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
