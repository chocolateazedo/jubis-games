<?php
declare(strict_types=1);

/**
 * Setup das tabelas da área logada (schema "jubis").
 *
 * Roda jubis_db_migrate() (idempotente: create ... if not exists). Use UMA vez,
 * depois de configurar o banco (JUBIS_DATABASE_URL ou includes/db_config.local.php).
 *
 * Protegido por chave: defina a env var JUBIS_SETUP_KEY no servidor e acesse
 *   https://jubis-games.cloud/setup.php?key=SUA_CHAVE
 * Recomendado apagar/desabilitar este arquivo depois de rodar.
 */

require_once __DIR__ . '/includes/auth.php';
header('Content-Type: text/plain; charset=utf-8');

$key = getenv('JUBIS_SETUP_KEY') ?: '';
if ($key === '' || !hash_equals($key, (string)($_GET['key'] ?? ''))) {
    http_response_code(403);
    echo "Acesso negado.\n\n";
    echo "Como usar: defina a env var JUBIS_SETUP_KEY no servidor e acesse /setup.php?key=SUA_CHAVE\n";
    echo "(e configure antes o banco: JUBIS_DATABASE_URL ou includes/db_config.local.php).";
    exit;
}

try {
    jubis_db_migrate();
    echo "OK ✅ — schema 'jubis' e tabelas (users, coin_ledger) criados/atualizados.\n";
    echo "Pode apagar este setup.php agora.";
} catch (Throwable $e) {
    http_response_code(500);
    echo "FALHA ❌ — " . $e->getMessage() . "\n\n";
    echo "Cheque se o banco está configurado (JUBIS_DATABASE_URL ou includes/db_config.local.php)\n";
    echo "e se a extensão pdo_pgsql está instalada no PHP do servidor.";
}
