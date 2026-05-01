"""
Leitura da linha `users` com a mesma verificação de trial que /auth/me (evita dados obsoletos).
"""
import logging
from typing import Any, Dict, Optional

from backend.app.services.supabase_client import get_supabase


def get_users_row_with_trial_sync(user_id: str, columns: str, logger: Optional[logging.Logger] = None) -> Optional[Dict[str, Any]]:
    """
    SELECT na tabela users com `columns`; se trial Pro ativo e trial expirar, refaz o SELECT.
    """
    log = logger or logging.getLogger(__name__)
    supabase = get_supabase()
    r = supabase.table("users").select(columns).eq("id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return None
    row = r.data[0]
    status = (row.get("subscription_status") or "").lower()
    tier = (row.get("subscription_tier") or "").lower()

    if status == "trial" and tier == "pro":
        try:
            from backend.app.services.trial_service import check_and_end_trial_if_needed

            tc = supabase.table("trial_claims").select("*").eq("user_id", user_id).limit(1).execute()
            if tc.data and len(tc.data) > 0:
                trial = tc.data[0]
                if check_and_end_trial_if_needed(supabase, trial):
                    r2 = supabase.table("users").select(columns).eq("id", user_id).limit(1).execute()
                    if r2.data and len(r2.data) > 0:
                        row = r2.data[0]
        except Exception as e:
            log.warning("Erro ao verificar trial (users_row): %s", e)

    return row
