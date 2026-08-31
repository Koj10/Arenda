import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.services.notifier import run_notifications_job

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def scheduled_notifications_job() -> None:
    try:
        run_notifications_job()
    except Exception:
        logger.exception("Notifications job failed")


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

    scheduler.start()

    # Сразу при старте тоже проверяем уведомления.
    scheduled_notifications_job()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
