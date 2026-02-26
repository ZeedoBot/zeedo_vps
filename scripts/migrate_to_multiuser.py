"""
Script de migração de dados existentes para estrutura multiusuário.
Cria usuário padrão e migra dados existentes. Usa chave para migrar conta existente.
Para novos usuários, use o Dashboard (conexão via API Wallet).
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Adiciona diretório raiz ao path para importar módulos
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

load_dotenv()

# Força uso do Supabase
os.environ.setdefault("BOT_STORAGE", "supabase")

from storage import get_storage
from auth.encryption import EncryptionManager
from datetime import datetime


def migrate_to_multiuser(admin_email: str = None, admin_private_key: str = None):
    """
    Migra dados existentes para estrutura multiusuário.
    
    Args:
        admin_email: Email do administrador (padrão: lê de ADMIN_EMAIL)
        admin_private_key: Chave privada do admin (padrão: lê de HYPER_PRIVATE_KEY)
    """
    print("=" * 60)
    print("Migracao para Multiusuario")
    print("=" * 60)
    
    storage = get_storage()
    
    if not hasattr(storage, '_client') or not storage._client:
        print("ERRO: Storage nao e Supabase ou cliente nao esta disponivel")
        return False
    
    client = storage._client
    enc_manager = EncryptionManager()
    
    # 1. Obtém credenciais
    admin_email = admin_email or os.getenv("ADMIN_EMAIL") or "admin@zeedo.com"
    admin_private_key = admin_private_key or os.getenv("HYPER_PRIVATE_KEY")
    
    if not admin_private_key:
        print("ERRO: HYPER_PRIVATE_KEY nao encontrada")
        return False
    
    print(f"\nEmail do admin: {admin_email}")
    print(f"Chave privada: {'*' * 20}...")
    
    try:
        # 2. Cria ou busca usuário admin
        print("\n1. Criando/buscando usuario admin...")
        user_result = client.table("users").select("*").eq("email", admin_email).execute()
        
        if user_result.data:
            user_id = user_result.data[0]["id"]
            print(f"   OK: Usuario encontrado: {user_id}")
        else:
            user_result = client.table("users").insert({
                "email": admin_email,
                "subscription_status": "active",
                "subscription_tier": "satoshi",
                "is_active": True
            }).execute()
            user_id = user_result.data[0]["id"]
            print(f"   OK: Usuario criado: {user_id}")
        
        # 3. Cria ou busca trading account
        print("\n2. Criando/buscando trading account...")
        wallet_address = os.getenv("HYPER_ACCOUNT_ADDRESS")
        if not wallet_address:
            from eth_account import Account
            account = Account.from_key(admin_private_key)
            wallet_address = account.address
        
        account_result = client.table("trading_accounts").select("*").eq("user_id", user_id).eq("wallet_address", wallet_address).execute()
        
        if account_result.data:
            account_id = account_result.data[0]["id"]
            print(f"   OK: Trading account encontrada: {account_id}")
        else:
            # Criptografa chave privada
            encrypted_key, salt = enc_manager.encrypt_private_key(admin_private_key, user_id)
            
            account_result = client.table("trading_accounts").insert({
                "user_id": user_id,
                "wallet_address": wallet_address,
                "encrypted_private_key": encrypted_key,
                "encryption_salt": salt,
                "network": "mainnet",
                "is_active": True
            }).execute()
            account_id = account_result.data[0]["id"]
            print(f"   OK: Trading account criada: {account_id}")
        
        # 4. Migra bot_config
        print("\n3. Migrando bot_config...")
        config_result = client.table("bot_config").select("*").limit(1).execute()
        
        if config_result.data:
            old_config = config_result.data[0]
            
            # Atualiza config existente com user_id
            update_data = {
                "user_id": user_id,
                "trading_account_id": account_id,
                "bot_enabled": True,
                "updated_at": datetime.utcnow().isoformat()
            }
            # Preserva campos existentes se não tiverem user_id
            if "symbols" in old_config:
                update_data["symbols"] = old_config["symbols"]
            if "timeframes" in old_config:
                update_data["timeframes"] = old_config["timeframes"]
            if "trade_mode" in old_config:
                update_data["trade_mode"] = old_config["trade_mode"]
            
            client.table("bot_config").update(update_data).eq("id", old_config["id"]).execute()
            print(f"   OK: Config atualizada com user_id")
        else:
            # Cria nova config
            client.table("bot_config").insert({
                "user_id": user_id,
                "trading_account_id": account_id,
                "symbols": [],
                "timeframes": [],
                "trade_mode": "BOTH",
                "bot_enabled": True,
                "target_loss_usd": 5.0,
                "max_global_exposure": 5000.0,
                "max_single_pos_exposure": 2500.0,
                "max_positions": 2
            }).execute()
            print(f"   OK: Config criada")
        
        # 5. Migra telegram_configs
        print("\n4. Migrando telegram_configs...")
        telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        telegram_chat = os.getenv("TELEGRAM_CHAT_ID")
        
        if telegram_token and telegram_chat:
            telegram_result = client.table("telegram_configs").select("*").eq("user_id", user_id).execute()
            
            if not telegram_result.data:
                client.table("telegram_configs").insert({
                    "user_id": user_id,
                    "bot_token": telegram_token,
                    "chat_id": telegram_chat,
                }).execute()
                print(f"   OK: Telegram config criada")
            else:
                print(f"   OK: Telegram config ja existe")
        
        # 6. Atualiza dados existentes com user_id
        print("\n5. Atualizando dados existentes com user_id...")
        
        # bot_tracker
        client.table("bot_tracker").update({"user_id": user_id}).is_("user_id", "null").execute()
        print(f"   OK: bot_tracker atualizado")
        
        # bot_history
        client.table("bot_history").update({"user_id": user_id}).is_("user_id", "null").execute()
        print(f"   OK: bot_history atualizado")
        
        # trades_database
        client.table("trades_database").update({"user_id": user_id}).is_("user_id", "null").execute()
        print(f"   OK: trades_database atualizado")
        
        print("\n" + "=" * 60)
        print("OK: Migracao concluida com sucesso!")
        print("=" * 60)
        print(f"\nResumo:")
        print(f"   - User ID: {user_id}")
        print(f"   - Trading Account ID: {account_id}")
        print(f"   - Wallet: {wallet_address}")
        print(f"\nProximos passos:")
        print(f"   1. Configure os simbolos e timeframes na tabela bot_configs")
        print(f"   2. Execute: python manager.py")
        
        return True
        
    except Exception as e:
        print(f"\nERRO na migracao: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migra dados para estrutura multiusuário")
    parser.add_argument("--email", help="Email do administrador")
    parser.add_argument("--private-key", help="Chave privada (ou use HYPER_PRIVATE_KEY)")
    
    args = parser.parse_args()
    
    success = migrate_to_multiuser(
        admin_email=args.email,
        admin_private_key=args.private_key
    )
    
    sys.exit(0 if success else 1)
