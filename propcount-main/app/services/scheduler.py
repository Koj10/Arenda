import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.services.invoice_payments import run_rent_invoices_job
from app.services.notifier import run_notifications_job

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def scheduled_notifications_job() -> None:
    try:
        run_notifications_job()
    except Exception:
        logger.exception("Notifications job failed")


def scheduled_rent_invoices_job() -> None:
    try:
        run_rent_invoices_job()
    except Exception:
        logger.exception("Rent invoices job failed")


def start_scheduler() -> None:
    if scheduler.running:
        return

    scheduler.add_job(
        scheduled_notifications_job,
        trigger="interval",
        minutes=60,
        id="notifications_job",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        scheduled_rent_invoices_job,
        trigger="interval",
        minutes=60,
        id="rent_invoices_job",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()

    scheduled_notifications_job()
    scheduled_rent_invoices_job()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
