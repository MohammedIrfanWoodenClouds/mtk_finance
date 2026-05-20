from fastapi import APIRouter, HTTPException

router = APIRouter()


def _not_implemented(feature: str):
    raise HTTPException(
        status_code=501,
        detail=f"{feature} is planned for a future phase",
    )


@router.get("/credit-cards")
def credit_cards_stub():
    _not_implemented("Credit cards")


@router.get("/emi/schedules")
def emi_stub():
    _not_implemented("EMI")


@router.get("/lending")
def lending_stub():
    _not_implemented("Lending")


@router.get("/investments")
def investments_stub():
    _not_implemented("Investments")


@router.get("/notifications")
def notifications_stub():
    _not_implemented("Notifications")


@router.get("/reports/monthly")
def reports_stub():
    _not_implemented("Reports")


