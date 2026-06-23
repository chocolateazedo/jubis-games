<?php
declare(strict_types=1);

/**
 * Setup + diagnóstico das tabelas da área logada (schema "jubis").
 *
 * Diagnóstico seguro (sem segredos):  /setup.php?diag=1
 * Rodar a migração (cria as tabelas):  /setup.php?key=SUA_CHAVE
 *   -> precisa da env var JUBIS_SETUP_KEY definida no servidor.
 *
 * jubis_db_migrate() é idempotente (create ... if not exists). Recomendado apagar
 * este arquivo depois que o login estiver funcionando.
 */

require_once __DIR__ . '/includes/auth.php';
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

// ---- Diagnóstico (não expõe URL/senha; só SIM/NÃO) ----
if (!empty($_GET['diag'])) {
    $url = '';
    try { $url = jubis_database_url(); } catch (Throwable $e) {}
    $driver = in_array('mysql', PDO::getAvailableDrivers(), true);
    $connOk = false; $tablesOk = false;
    try {
        $pdo = jubis_db(); $connOk = true;
        try { $pdo->query('select 1 from jubis_users limit 1'); $tablesOk = true; } catch (Throwable $e) { $tablesOk = false; }
    } catch (Throwable $e) { $connOk = false; }

    echo "Diagnóstico do banco (Jubis — MySQL):\n";
    echo "  1) URL do banco definida ........ " . ($url !== '' ? 'SIM' : 'NÃO') . "\n";
    echo "  2) Driver pdo_mysql instalado ... " . ($driver ? 'SIM' : 'NÃO') . "\n";
    echo "  3) Conecta no banco ............. " . ($connOk ? 'SIM' : 'NÃO') . "\n";
    echo "  4) Tabela jubis_users existe .... " . ($tablesOk ? 'SIM' : 'NÃO') . "\n";
    echo "  --- info do servidor ---\n";
    echo "  PDO drivers ...... " . implode(',', PDO::getAvailableDrivers()) . "\n";
    echo "  PHP .............. " . PHP_VERSION . "\n\n";
    if (!$url)            echo "AÇÃO: definir JUBIS_DATABASE_URL (mysql://...) ou includes/db_config.local.php.\n";
    elseif (!$driver)    echo "AÇÃO: habilitar a extensão PHP pdo_mysql no servidor.\n";
    elseif (!$connOk)    echo "AÇÃO: conexão falhou — confira host/porta/usuário/senha da URL.\n";
    elseif (!$tablesOk)  echo "AÇÃO: rode a migração: /setup.php?key=SUA_CHAVE (com JUBIS_SETUP_KEY) OU aplique includes/schema.sql.\n";
    else                 echo "TUDO OK ✅ — o login deve funcionar.\n";
    exit;
}

// ---- Migração (cria as tabelas) — protegida por chave ----
$key = getenv('JUBIS_SETUP_KEY') ?: '';
if ($key === '' || !hash_equals($key, (string)($_GET['key'] ?? ''))) {
    http_response_code(403);
    echo "Acesso negado.\n\n";
    echo "Diagnóstico (sem chave): /setup.php?diag=1\n";
    echo "Migrar: defina a env JUBIS_SETUP_KEY e acesse /setup.php?key=SUA_CHAVE\n";
    exit;
}

try {
    jubis_db_migrate();
    echo "OK ✅ — schema 'jubis' e tabelas (users, coin_ledger) criados/atualizados.\n";
    echo "Pode apagar este setup.php agora.";
} catch (Throwable $e) {
    http_response_code(500);
    echo "FALHA ❌ — " . $e->getMessage() . "\n";
}
